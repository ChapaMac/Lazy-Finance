const express = require('express')
const { getTransactions, countTransactions, sumTransactions, getAllForExport, updateTransaction, insertManualTransaction, upsertMerchantRule } = require('../db/queries')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  const { search, bank, category, startDate, endDate, limit = 50, offset = 0, sortBy = 'date', sortDir = 'desc' } = req.query
  const userId = req.user.id
  const filters = { search, bank, category, startDate, endDate, limit: parseInt(limit), offset: parseInt(offset), sortBy, sortDir, userId }
  const transactions = getTransactions(filters)
  const { count } = countTransactions(filters)
  const totals = sumTransactions(filters)
  res.json({ transactions, total: count, totals })
})

router.get('/export', (req, res) => {
  const { search, bank, category, startDate, endDate } = req.query
  const rows = getAllForExport({ search, bank, category, startDate, endDate, userId: req.user.id })

  const headers = ['id', 'date', 'description', 'amount', 'currency', 'bank', 'category', 'notes']
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const val = String(r[h] ?? '')
      return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
    }).join(','))
  ].join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="movimientos-${new Date().toISOString().slice(0, 10)}.csv"`)
  res.send('\uFEFF' + csv)
})

router.post('/', (req, res) => {
  const { date, description, amount, category, bank, notes } = req.body
  if (!date || !description || amount === undefined || !category || !bank) {
    return res.status(400).json({ error: 'Faltan campos requeridos' })
  }
  const parsed = parseFloat(amount)
  if (isNaN(parsed) || parsed <= 0) return res.status(400).json({ error: 'Monto inválido' })
  insertManualTransaction({ date, description, amount: parsed, category, bank, notes, userId: req.user.id })
  res.json({ ok: true })
})

router.patch('/:id', (req, res) => {
  const { id } = req.params
  const { category, notes, _description } = req.body
  if (category === undefined && notes === undefined) return res.status(400).json({ error: 'Nada que actualizar' })
  updateTransaction(parseInt(id), { category, notes }, req.user.id)
  if (category !== undefined && _description) {
    upsertMerchantRule(_description, category, req.user.id)
  }
  res.json({ ok: true })
})

module.exports = router
