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

// Temporary: delete transactions with wrong year (2026 that should be 2025)
router.delete('/fix-dec-2026', adminOnly, (req, res) => {
  const db = getDb()
  const result = db.prepare(`DELETE FROM transactions WHERE date >= '2026-12-01' AND date <= '2026-12-31'`).run()
  res.json({ deleted: result.changes })
})

module.exports = router
