const express = require('express')
const multer = require('multer')
const crypto = require('crypto')
const { parseBBVAPDF } = require('../parsers/bbva-pdf')
const { parseBBVACSV } = require('../parsers/bbva-csv')
const { parseAmExPDF } = require('../parsers/amex-pdf')
const { parseAmExXLSX } = require('../parsers/amex-xlsx')
const { parseNuPDF } = require('../parsers/nu-pdf')
const { parseSantanderPDF } = require('../parsers/santander-pdf')
const { parseBanamexPDF } = require('../parsers/banamex-pdf')
const { parseHSBCPDF } = require('../parsers/hsbc-pdf')
const { parseBanortePDF } = require('../parsers/banorte-pdf')
const { parseScotiabankPDF } = require('../parsers/scotiabank-pdf')
const { detectBank } = require('../parsers/detect-bank')
const { categorize } = require('../utils/categorize')
const { cleanMerchant } = require('../pipeline/clean')
const { insertTransactions, getExistingKeys, getMerchantRules } = require('../db/queries')
const { authMiddleware } = require('../middleware/auth')

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
    case 'SANTANDER':
      if (ext === 'pdf') return parseSantanderPDF(buffer)
      throw new Error('Santander soporta PDF.')
    case 'BANAMEX':
      if (ext === 'pdf') return parseBanamexPDF(buffer)
      throw new Error('Banamex soporta PDF.')
    case 'HSBC':
      if (ext === 'pdf') return parseHSBCPDF(buffer)
      throw new Error('HSBC soporta PDF.')
    case 'BANORTE':
      if (ext === 'pdf') return parseBanortePDF(buffer)
      throw new Error('Banorte soporta PDF.')
    case 'SCOTIABANK':
      if (ext === 'pdf') return parseScotiabankPDF(buffer)
      throw new Error('Scotiabank soporta PDF.')
    default:
      throw new Error(`Banco "${bank}" no reconocido.`)
  }
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
    const raw = await parseFile(req.file.buffer, bank, req.file.originalname, yearOverride)
    const userId = req.user.id

    const transactions = raw.map(tx => {
      const description = cleanMerchant(tx.description)
      const baseCategory = categorize(description, tx.amount)
      const category = applyLearnedRules(description, baseCategory, userId)
      return {
        ...tx,
        description,
        bank,
        currency: 'MXN',
        category,
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
