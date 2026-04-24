const express = require('express')
const multer = require('multer')
const crypto = require('crypto')
const Anthropic = require('@anthropic-ai/sdk')
const { parseBBVAPDF } = require('../parsers/bbva-pdf')
const { parseBBVACSV } = require('../parsers/bbva-csv')
const { parseAmExPDF } = require('../parsers/amex-pdf')
const { parseAmExXLSX } = require('../parsers/amex-xlsx')
const { parseNuPDF } = require('../parsers/nu-pdf')
const { detectBank } = require('../parsers/detect-bank')
const { categorize, typeForCategory } = require('../utils/categorize')
const { cleanMerchant } = require('../pipeline/clean')
const { insertTransactions, getExistingKeys, getMerchantRules } = require('../db/queries')
const { authMiddleware } = require('../middleware/auth')

// Banks that use the AI parser instead of custom parsers
const AI_BANKS = new Set(['SANTANDER', 'BANAMEX', 'HSBC', 'BANORTE', 'SCOTIABANK', 'OTRO'])

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

function makeKey(bank, date, desc, amount) {
  return crypto.createHash('sha256')
    .update(`${bank}|${date}|${desc.trim().toUpperCase()}|${Math.abs(amount).toFixed(2)}`)
    .digest('hex')
    .slice(0, 40)
}

async function parseFile(buffer, bank, filename, yearOverride = null) {
  const ext = filename.split('.').pop().toLowerCase()
  switch (bank) {
    case 'BBVA':
      if (ext === 'csv') return parseBBVACSV(buffer)
      if (ext === 'pdf') return parseBBVAPDF(buffer, yearOverride)
      throw new Error('BBVA soporta PDF y CSV.')
    case 'AMEX':
      if (ext === 'xlsx' || ext === 'xls') return parseAmExXLSX(buffer)
      if (ext === 'pdf') return parseAmExPDF(buffer, yearOverride)
      throw new Error('American Express soporta PDF y XLSX.')
    case 'NU':
      if (ext === 'pdf') return parseNuPDF(buffer)
      throw new Error('Nu soporta PDF.')
    default:
      throw new Error(`Banco "${bank}" no reconocido.`)
  }
}

// ─── AI Universal Parser ──────────────────────────────────────────────────────
async function parseWithAI(buffer, bankName) {
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer)
  const text = data.text.slice(0, 12000) // ~3k tokens, enough for most statements

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Eres un extractor de transacciones bancarias. Analiza este estado de cuenta de ${bankName} y extrae TODAS las transacciones.

TEXTO DEL ESTADO DE CUENTA:
${text}

INSTRUCCIONES:
- Extrae cada cargo y abono
- Cargos (gastos): amount POSITIVO
- Abonos (ingresos, pagos recibidos): amount NEGATIVO
- Formato de fecha: YYYY-MM-DD (si el año no aparece, usa el año más común en el documento)
- Limpia la descripción: quita números de referencia, deja solo el nombre del comercio
- Ignora: saldo inicial, saldo final, totales, encabezados

Responde SOLO con JSON válido, sin texto extra:
{
  "transactions": [
    { "date": "2025-03-15", "description": "OXXO REFORMA", "amount": 85.50 },
    { "date": "2025-03-14", "description": "NOMINA EMPRESA SA", "amount": -18000.00 }
  ]
}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0]?.text?.trim() || '{}'
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('La IA no pudo extraer transacciones del PDF.')

  const parsed = JSON.parse(jsonMatch[0])
  const txs = parsed.transactions || []

  if (!txs.length) throw new Error('No se encontraron transacciones en el PDF. Verifica que sea un estado de cuenta.')

  return txs.map(tx => ({
    date: tx.date,
    description: String(tx.description).trim(),
    amount: Number(tx.amount),
  }))
}

function applyLearnedRules(description, category, userId) {
  const rules = getMerchantRules(userId)
  const upper = description.toUpperCase()
  for (const rule of rules) {
    if (upper.startsWith(rule.pattern)) return rule.category
  }
  return category
}

// Debug: returns raw PDF text so we can calibrate new parsers
router.post('/debug-pdf', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' })
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(req.file.buffer)
  res.json({ text: data.text.slice(0, 5000), lines: data.text.split('\n').slice(0, 80) })
})

// Auto-detect bank from file
router.post('/detect', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ bank: null })
  const result = await detectBank(req.file.buffer, req.file.originalname)
  res.json(result)
})

router.post('/preview', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' })

  // bank can come from body (user override) or auto-detected
  let bank = req.body.bank
  if (!bank || bank === 'AUTO') {
    const detected = await detectBank(req.file.buffer, req.file.originalname)
    bank = detected.bank
  }
  if (!bank) return res.status(422).json({ error: 'No se pudo detectar el banco. Selecciónalo manualmente.' })

  const yearOverride = req.body.yearOverride ? parseInt(req.body.yearOverride) : null

  try {
    // Route to AI parser for banks without custom parsers
    const raw = AI_BANKS.has(bank)
      ? await parseWithAI(req.file.buffer, bank)
      : await parseFile(req.file.buffer, bank, req.file.originalname, yearOverride)
    const userId = req.user.id

    const transactions = raw.map(tx => {
      const description = cleanMerchant(tx.description)
      const { category: baseCategory, type: baseType } = categorize(description, tx.amount)
      const category = applyLearnedRules(description, baseCategory, userId)
      // If a learned rule changed the category, recompute the type
      const type = category !== baseCategory ? typeForCategory(category, tx.amount) : baseType
      return {
        ...tx,
        description,
        bank,
        currency: 'MXN',
        category,
        type,
        unique_key: makeKey(bank, tx.date, tx.description, tx.amount),
      }
    })

    const keys = transactions.map(t => t.unique_key)
    const existing = getExistingKeys(keys, userId)
    const withStatus = transactions.map(t => ({ ...t, isDuplicate: existing.has(t.unique_key) }))

    res.json({ transactions: withStatus, total: withStatus.length, newCount: withStatus.filter(t => !t.isDuplicate).length, bank })
  } catch (err) {
    res.status(422).json({ error: err.message })
  }
})

router.post('/confirm', authMiddleware, async (req, res) => {
  const { transactions } = req.body
  if (!Array.isArray(transactions) || !transactions.length) {
    return res.status(400).json({ error: 'No hay movimientos para guardar' })
  }
  try {
    const toSave = transactions.filter(t => !t.isDuplicate)
    if (!toSave.length) return res.json({ inserted: 0, skipped: transactions.length })
    const result = insertTransactions(toSave, req.user.id)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar: ' + err.message })
  }
})

module.exports = router
