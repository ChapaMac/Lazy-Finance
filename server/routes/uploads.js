const express = require('express')
const multer = require('multer')
const crypto = require('crypto')
const { parseBBVAPDF } = require('../parsers/bbva-pdf')
const { parseBBVACSV } = require('../parsers/bbva-csv')
const { parseAmExPDF, detectBankFromPDF } = require('../parsers/amex-pdf')
const { parseAmExXLSX } = require('../parsers/amex-xlsx')
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

async function parseFile(buffer, bank, filename) {
  const ext = filename.split('.').pop().toLowerCase()
  if (bank === 'BBVA') {
    if (ext === 'csv') return parseBBVACSV(buffer)
    if (ext === 'pdf') return parseBBVAPDF(buffer)
    throw new Error('BBVA soporta PDF y CSV. Formato no reconocido.')
  }
  if (bank === 'AMEX') {
    if (ext === 'xlsx' || ext === 'xls') return parseAmExXLSX(buffer)
    if (ext === 'pdf') return parseAmExPDF(buffer)
    throw new Error('American Express soporta PDF y XLSX. Formato no reconocido.')
  }
  throw new Error('Banco no reconocido. Selecciona BBVA o AMEX.')
}

function applyLearnedRules(description, category, userId) {
  const rules = getMerchantRules(userId)
  const upper = description.toUpperCase()
  for (const rule of rules) {
    if (upper.startsWith(rule.pattern)) return rule.category
  }
  return category
}

router.post('/debug-pdf', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' })
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(req.file.buffer)
  res.json({ text: data.text.slice(0, 5000), lines: data.text.split('\n').slice(0, 80) })
})

router.post('/detect', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ bank: null })
  const filename = req.file.originalname.toLowerCase()
  const ext = filename.split('.').pop()

  if (filename.includes('bbva') || filename.includes('bancomer')) return res.json({ bank: 'BBVA' })
  if (filename.includes('amex') || filename.includes('american') || filename.includes('express')) return res.json({ bank: 'AMEX' })

  if (ext === 'pdf') {
    const bank = await detectBankFromPDF(req.file.buffer)
    if (bank) return res.json({ bank })
  }
  if (ext === 'csv') return res.json({ bank: 'BBVA' })
  if (ext === 'xlsx' || ext === 'xls') return res.json({ bank: 'AMEX' })

  res.json({ bank: null })
})

router.post('/preview', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' })
  const { bank } = req.body
  if (!bank || !['BBVA', 'AMEX'].includes(bank)) return res.status(400).json({ error: 'Selecciona un banco válido' })

  try {
    const raw = await parseFile(req.file.buffer, bank, req.file.originalname)
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

    res.json({ transactions: withStatus, total: withStatus.length, newCount: withStatus.filter(t => !t.isDuplicate).length })
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
