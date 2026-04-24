const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const { authMiddleware } = require('../middleware/auth')
const { getDb } = require('../db/schema')
const { typeForCategory } = require('../utils/categorize')

const router = express.Router()
router.use(authMiddleware)

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── helpers ─────────────────────────────────────────────────────────────────

function getFinancialContext(userId, year, month) {
  const db = getDb()
  const m  = `${year}-${String(month).padStart(2, '0')}`

  const prevDate  = new Date(year, month - 2, 1)
  const prevY     = prevDate.getFullYear()
  const prevM     = String(prevDate.getMonth() + 1).padStart(2, '0')
  const prevLabel = `${prevY}-${prevM}`

  const expenses = db.prepare(`
    SELECT category, SUM(amount) as total, COUNT(*) as count
    FROM transactions
    WHERE strftime('%Y-%m', date) = ? AND type = 'expense' AND user_id = ?
    GROUP BY category ORDER BY total DESC
  `).all(m, userId)

  const income = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM transactions
    WHERE strftime('%Y-%m', date) = ? AND type = 'income' AND user_id = ?
  `).get(m, userId)

  const prevExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM transactions
    WHERE strftime('%Y-%m', date) = ? AND type = 'expense' AND user_id = ?
  `).get(prevLabel, userId)

  const topMerchants = db.prepare(`
    SELECT description, SUM(amount) as total
    FROM transactions
    WHERE strftime('%Y-%m', date) = ? AND type = 'expense' AND user_id = ?
    GROUP BY description ORDER BY total DESC LIMIT 10
  `).all(m, userId)

  const trend = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
    FROM transactions
    WHERE type = 'expense' AND date >= date('now', '-6 months') AND user_id = ?
    GROUP BY month ORDER BY month ASC
  `).all(userId)

  const totalExpenses = expenses.reduce((s, c) => s + c.total, 0)
  const totalIncome   = (income?.total || 0)

  return {
    month: m,
    totalExpenses,
    totalIncome,
    netBalance: totalIncome - totalExpenses,
    prevExpenses: prevExpenses?.total || 0,
    expenses,
    topMerchants,
    trend,
  }
}

function buildSystemPrompt(ctx) {
  const { month, totalExpenses, totalIncome, netBalance, prevExpenses, expenses, topMerchants, trend } = ctx
  const fmt = n => `$${Math.round(n).toLocaleString('es-MX')} MXN`
  const inDeficit = netBalance < 0
  const delta = prevExpenses > 0 ? (((totalExpenses - prevExpenses) / prevExpenses) * 100).toFixed(1) : null

  const cats = expenses.map(c => `  • ${c.category}: ${fmt(c.total)} (${c.count} movs)`).join('\n')
  const merch = topMerchants.map(m => `  • ${m.description}: ${fmt(m.total)}`).join('\n')
  const trendStr = trend.map(t => `  ${t.month}: ${fmt(t.total)}`).join('\n')

  return `Eres un asistente de finanzas personales. Responde en español.

REGLAS DE ORO — violación = respuesta incorrecta:
1. MÁXIMO 3 líneas. Si necesitas más, estás siendo verboso.
2. NUNCA uses markdown (**negrita**, *cursiva*, ##). Solo texto plano.
3. Para listas usa "→" al inicio de línea, sin introducciones.
4. Da el número primero. Siempre. Luego el contexto en pocas palabras.
5. Si el usuario hace una afirmación ("gasté 35k"), confirma o corrige con datos reales. No expliques causas.
6. NUNCA menciones "discrepancias", "filtros", ni expliques cómo funciona la app.

EJEMPLOS CORRECTOS:
Usuario: "cuánto gasté?" → "💸 $34,200 en Comida ($8k), Transporte ($6k), Supermercado ($5k)."
Usuario: "gasté 35k" → "Sí, $34,200 exactamente. Comida fue lo mayor con $8,100."
Usuario: "en qué categorías?" → "→ Comida: $8,100\n→ Transporte: $6,200\n→ Supermercado: $5,400"

── DATOS DEL MES ${month} ─────────────────────
Gastos totales:  ${fmt(totalExpenses)}
Ingresos totales: ${fmt(totalIncome)}
Balance: ${inDeficit ? '-' : '+'}${fmt(Math.abs(netBalance))} (${inDeficit ? 'DÉFICIT' : 'superávit'})
${delta !== null ? `Vs mes anterior: ${delta > 0 ? '+' : ''}${delta}%` : ''}

Gastos por categoría:
${cats || '  (sin datos)'}

Comercios top:
${merch || '  (sin datos)'}

Tendencia últimos meses:
${trendStr || '  (sin datos)'}
────────────────────────────────────────────`
}

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────
// Body: { message, history, year, month }
// history = [{ role: 'user'|'assistant', content: string }, ...]

router.post('/chat', async (req, res) => {
  const uid = req.user.id
  const { message, history = [], year, month } = req.body

  if (!message) return res.status(400).json({ error: 'message required' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set' })

  const now   = new Date()
  const y     = parseInt(year)  || now.getFullYear()
  const m     = parseInt(month) || now.getMonth() + 1

  try {
    const ctx    = getFinancialContext(uid, y, m)
    const system = buildSystemPrompt(ctx)

    const messages = [
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')  // disable nginx/Railway buffering

    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system,
      messages,
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('[AI chat]', err.status, err.message)
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'AI error' })
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    }
  }
})

// ─── GET /api/ai/status ───────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({ ok: !!process.env.ANTHROPIC_API_KEY, keyPrefix: process.env.ANTHROPIC_API_KEY?.slice(0, 10) || 'not set' })
})

// ─── GET /api/ai/recap ────────────────────────────────────────────────────────
// 2-sentence AI narrative of the month. Cached in DB for 24h.

router.get('/recap', async (req, res) => {
  const uid = req.user.id
  const now = new Date()
  const y   = parseInt(req.query.year)  || now.getFullYear()
  const m   = parseInt(req.query.month) || now.getMonth() + 1
  const key = `recap:${uid}:${y}-${String(m).padStart(2,'0')}`

  if (!process.env.ANTHROPIC_API_KEY) return res.json({ recap: null })

  // Check cache (SQLite kv store)
  const db = getDb()
  db.exec(`CREATE TABLE IF NOT EXISTS ai_cache (key TEXT PRIMARY KEY, value TEXT, created_at TEXT)`)
  const cached = db.prepare(`SELECT value, created_at FROM ai_cache WHERE key = ?`).get(key)
  if (cached) {
    const age = Date.now() - new Date(cached.created_at).getTime()
    if (age < 24 * 60 * 60 * 1000) return res.json({ recap: cached.value })
  }

  try {
    const ctx = getFinancialContext(uid, y, m)
    if (!ctx.totalExpenses && !ctx.totalIncome) return res.json({ recap: null })

    const fmt = n => `$${Math.round(n).toLocaleString('es-MX')}`
    const cats = ctx.expenses.slice(0, 3).map(c => `${c.category} ${fmt(c.total)}`).join(', ')
    const delta = ctx.prevExpenses > 0
      ? `${ctx.totalExpenses > ctx.prevExpenses ? '+' : ''}${(((ctx.totalExpenses - ctx.prevExpenses) / ctx.prevExpenses) * 100).toFixed(0)}% vs mes anterior`
      : ''

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: `Escribe UN resumen de 1-2 oraciones (máx 25 palabras) sobre este mes financiero. Sin saludos. Directo al punto. En español.

Datos: Gastos ${fmt(ctx.totalExpenses)} ${delta}. Ingresos ${fmt(ctx.totalIncome)}. Top categorías: ${cats}.`,
      }],
    })

    const recap = response.content[0]?.text?.trim() || null
    if (recap) {
      db.prepare(`INSERT OR REPLACE INTO ai_cache (key, value, created_at) VALUES (?, ?, ?)`).run(key, recap, new Date().toISOString())
    }
    res.json({ recap })
  } catch (err) {
    console.error('[AI recap]', err.message)
    res.json({ recap: null })
  }
})

// ─── GET /api/ai/suggestions ──────────────────────────────────────────────────
// Returns 3 AI-generated action items for the DECISIÓN block

router.get('/suggestions', async (req, res) => {
  const uid = req.user.id
  const now = new Date()
  const y   = parseInt(req.query.year)  || now.getFullYear()
  const m   = parseInt(req.query.month) || now.getMonth() + 1

  if (!process.env.ANTHROPIC_API_KEY) return res.json({ suggestions: [] })

  try {
    const ctx = getFinancialContext(uid, y, m)

    if (!ctx.totalExpenses && !ctx.totalIncome) {
      return res.json({ suggestions: [] })
    }

    const fmt = n => `$${Math.round(n).toLocaleString('es-MX')} MXN`
    const cats = ctx.expenses.map(c => `${c.category}: ${fmt(c.total)}`).join(', ')

    const prompt = `Analiza estos datos financieros y devuelve exactamente 3 acciones concretas y personalizadas.

Mes: ${ctx.month}
Gastos: ${fmt(ctx.totalExpenses)} | Ingresos: ${fmt(ctx.totalIncome)} | Balance: ${ctx.netBalance >= 0 ? '+' : ''}${fmt(ctx.netBalance)}
Categorías: ${cats}
Comercios top: ${ctx.topMerchants.slice(0, 5).map(m => `${m.description} ${fmt(m.total)}`).join(', ')}

Responde SOLO con JSON válido, sin texto extra:
{
  "suggestions": [
    { "action": "acción concreta en 1 frase corta", "detail": "detalle con cifras reales en 1 frase", "category": "categoría relevante o null", "color": "amber|green|red|indigo" },
    { ... },
    { ... }
  ]
}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0]?.text?.trim() || '{}'
    // Extract JSON if model added extra text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { suggestions: [] }

    res.json(parsed)
  } catch (err) {
    console.error('[AI suggestions]', err.message)
    res.status(500).json({ error: 'AI error', suggestions: [] })
  }
})

// ─── POST /api/ai/categorize ──────────────────────────────────────────────────
// Body: { transactions: [{ id, description, amount }] }
// Returns: { results: [{ id, category }] }

router.post('/categorize', async (req, res) => {
  const { transactions } = req.body
  if (!Array.isArray(transactions) || !transactions.length) {
    return res.status(400).json({ error: 'transactions array required' })
  }

  const CATEGORIES = [
    'Comida', 'Transporte', 'Supermercado', 'Entretenimiento',
    'Salud', 'Ropa', 'Hogar', 'Servicios', 'Viajes', 'Alcohol',
    'Educación', 'Mascotas', 'Otros'
  ]

  const list = transactions
    .slice(0, 50)  // max 50 per call
    .map((t, i) => `${i}. "${t.description}" $${Math.abs(t.amount)} MXN`)
    .join('\n')

  const prompt = `Clasifica cada transacción en UNA de estas categorías: ${CATEGORIES.join(', ')}.

Transacciones:
${list}

Responde SOLO con JSON válido:
{ "results": [{ "index": 0, "category": "Comida" }, ...] }`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw  = response.content[0]?.text?.trim() || '{}'
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { results: [] }

    // Map indices back to transaction ids
    const results = (parsed.results || []).map(r => ({
      id: transactions[r.index]?.id,
      category: CATEGORIES.includes(r.category) ? r.category : 'Otros',
    })).filter(r => r.id != null)

    res.json({ results })
  } catch (err) {
    console.error('[AI categorize]', err.message)
    res.status(500).json({ error: 'AI error', results: [] })
  }
})

// ─── POST /api/ai/recategorize-all ───────────────────────────────────────────
// Admin: re-categorize all 'Otros' transactions for this user using AI

router.post('/recategorize-all', async (req, res) => {
  const uid = req.user.id
  const db  = getDb()

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set', updated: 0, total: 0 })
  }

  const otros = db.prepare(`
    SELECT id, description, amount FROM transactions
    WHERE category = 'Otros' AND category_overridden = 0 AND user_id = ?
    ORDER BY id ASC
  `).all(uid)

  if (!otros.length) return res.json({ updated: 0, message: 'No hay transacciones en Otros' })

  const BATCH = 40
  let updated = 0

  for (let i = 0; i < otros.length; i += BATCH) {
    const batch = otros.slice(i, i + BATCH)
    const CATEGORIES = [
      'Comida', 'Transporte', 'Supermercado', 'Entretenimiento',
      'Salud', 'Ropa', 'Hogar', 'Servicios', 'Viajes', 'Alcohol',
      'Educación', 'Mascotas', 'Otros'
    ]

    const list = batch.map((t, idx) => `${idx}. "${t.description}" $${Math.abs(t.amount)} MXN`).join('\n')
    const prompt = `Clasifica cada transacción en UNA de: ${CATEGORIES.join(', ')}.

${list}

Responde SOLO con JSON:
{ "results": [{ "index": 0, "category": "..." }] }`

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw = response.content[0]?.text?.trim() || '{}'
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { results: [] }

      const update = db.prepare(`
        UPDATE transactions SET category = ?, type = ? WHERE id = ? AND user_id = ? AND category_overridden = 0
      `)
      const runBatch = db.transaction(results => {
        for (const r of results) {
          const tx = batch[r.index]
          if (!tx) continue
          const cat = CATEGORIES.includes(r.category) ? r.category : 'Otros'
          if (cat === 'Otros') continue
          const type = typeForCategory(cat, tx.amount)
          update.run(cat, type, tx.id, uid)
          updated++
        }
      })
      runBatch(parsed.results || [])
    } catch (err) {
      console.error('[AI recategorize batch]', err.status, err.message)
      // If first batch fails with auth error, abort entire operation
      if (err.status === 401 || err.status === 403) {
        return res.status(503).json({ error: 'API key inválida', updated, total: otros.length })
      }
    }
  }

  res.json({ updated, total: otros.length })
})

module.exports = router
