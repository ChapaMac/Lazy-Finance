require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const { initSchema, migrateExpandBankOptions, migrateAddUserId } = require('./db/schema')
const { seedIfEmpty } = require('./utils/seed')
const { migrateIncomeCategory, migratePagoTCCategory, migrateTransferenciasCategory, migrateRecategorizeOtros, migrateRecategorizeAll, applyMerchantRules } = require('./db/queries')
const authRoutes = require('./routes/auth')
const transactionRoutes = require('./routes/transactions')
const uploadRoutes = require('./routes/uploads')
const insightRoutes = require('./routes/insights')
const budgetRoutes = require('./routes/budgets')
const adminRoutes = require('./routes/admin')

const app = express()
const PORT = process.env.PORT || 3001
const isProd = process.env.NODE_ENV === 'production'

// ── Middleware ────────────────────────────────────────────────────────────────
if (!isProd) {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
}
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── DB init ───────────────────────────────────────────────────────────────────
initSchema()
migrateExpandBankOptions()
migrateAddUserId()
seedIfEmpty()
migrateIncomeCategory()
migratePagoTCCategory()
migrateTransferenciasCategory()
migrateRecategorizeOtros()
migrateRecategorizeAll()
applyMerchantRules()

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/uploads', uploadRoutes)
app.use('/api/insights', insightRoutes)
app.use('/api/budgets', budgetRoutes)
app.use('/api/admin', adminRoutes)
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

// ── Serve React build in production ──────────────────────────────────────────
if (isProd) {
  const clientDist = path.join(__dirname, '../client/dist')
  app.use(express.static(clientDist))
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')))
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} [${isProd ? 'production' : 'development'}]`)
})
