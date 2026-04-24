const express = require('express')
const { authMiddleware } = require('../middleware/auth')
const { getDb } = require('../db/schema')

const router = express.Router()
router.use(authMiddleware)

// Only user_id === 1 (first registered = owner) can access admin
function adminOnly(req, res, next) {
  if (req.user.id !== 1) return res.status(403).json({ error: 'Acceso denegado' })
  next()
}

router.get('/users', adminOnly, (req, res) => {
  const db = getDb()
  const users = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.created_at,
      COUNT(DISTINCT t.id)          AS transaction_count,
      MAX(t.created_at)             AS last_upload,
      MIN(t.date)                   AS earliest_tx,
      MAX(t.date)                   AS latest_tx
    FROM users u
    LEFT JOIN transactions t ON t.user_id = u.id
    GROUP BY u.id
    ORDER BY u.id ASC
  `).all()
  res.json({ users })
})

// List all distinct year-months that have transactions (for current user's own data, admin sees all)
router.get('/months', adminOnly, (req, res) => {
  const db = getDb()
  const userId = req.query.userId ? parseInt(req.query.userId) : null
  const rows = userId
    ? db.prepare(`SELECT DISTINCT strftime('%Y-%m', date) as ym, COUNT(*) as count FROM transactions WHERE user_id = ? GROUP BY ym ORDER BY ym DESC`).all(userId)
    : db.prepare(`SELECT DISTINCT strftime('%Y-%m', date) as ym, COUNT(*) as count FROM transactions GROUP BY ym ORDER BY ym DESC`).all()
  res.json({ months: rows })
})

// Delete all transactions for a specific year-month (YYYY-MM)
router.delete('/clear-month', adminOnly, (req, res) => {
  const { month, userId } = req.body // month = "2026-12", userId optional
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month debe ser formato YYYY-MM' })
  }
  const db = getDb()
  const result = userId
    ? db.prepare(`DELETE FROM transactions WHERE strftime('%Y-%m', date) = ? AND user_id = ?`).run(month, userId)
    : db.prepare(`DELETE FROM transactions WHERE strftime('%Y-%m', date) = ?`).run(month)
  res.json({ deleted: result.changes, month })
})

// Wipe ALL transactions (nuclear)
router.delete('/wipe-all', adminOnly, (req, res) => {
  const { userId } = req.body
  const db = getDb()
  const result = userId
    ? db.prepare(`DELETE FROM transactions WHERE user_id = ?`).run(userId)
    : db.prepare(`DELETE FROM transactions`).run()
  res.json({ deleted: result.changes })
})

// Legacy: delete transactions with wrong year (2026 that should be 2025)
router.delete('/fix-dec-2026', adminOnly, (req, res) => {
  const db = getDb()
  const result = db.prepare(`DELETE FROM transactions WHERE date >= '2026-12-01' AND date <= '2026-12-31'`).run()
  res.json({ deleted: result.changes })
})

module.exports = router
