const express = require('express')
const { getBudgets, upsertBudget, deleteBudget } = require('../db/queries')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  res.json(getBudgets(req.user.id))
})

router.put('/:category', (req, res) => {
  const { monthly_limit } = req.body
  const limit = parseFloat(monthly_limit)
  if (isNaN(limit) || limit <= 0) return res.status(400).json({ error: 'Límite inválido' })
  upsertBudget(decodeURIComponent(req.params.category), limit, req.user.id)
  res.json({ ok: true })
})

router.delete('/:category', (req, res) => {
  deleteBudget(decodeURIComponent(req.params.category), req.user.id)
  res.json({ ok: true })
})

module.exports = router
