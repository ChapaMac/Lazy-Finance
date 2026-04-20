const { getDb } = require('./schema')

// ─── Users ───────────────────────────────────────────────────────────────────

function getUserByUsername(username) {
  return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username)
}

function createUser(username, passwordHash) {
  return getDb().prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash)
}

// ─── Transactions ─────────────────────────────────────────────────────────────

function insertTransactions(transactions, userId) {
  const insert = getDb().prepare(`
    INSERT OR IGNORE INTO transactions
      (date, description, amount, currency, bank, category, category_overridden, notes, unique_key, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const run = getDb().transaction(txs => {
    let inserted = 0, skipped = 0
    for (const tx of txs) {
      const key = `${userId}_${tx.unique_key}`
      const r = insert.run(tx.date, tx.description, tx.amount, tx.currency || 'MXN', tx.bank, tx.category, tx.category_overridden || 0, tx.notes || null, key, userId)
      r.changes > 0 ? inserted++ : skipped++
    }
    return { inserted, skipped }
  })
  return run(transactions)
}

function getExistingKeys(keys, userId) {
  if (!keys.length) return new Set()
  const prefixed = keys.map(k => `${userId}_${k}`)
  const placeholders = prefixed.map(() => '?').join(',')
  const rows = getDb().prepare(`SELECT unique_key FROM transactions WHERE unique_key IN (${placeholders}) AND user_id = ?`).all(...prefixed, userId)
  // Return without the userId prefix so caller can match against original keys
  return new Set(rows.map(r => r.unique_key.replace(`${userId}_`, '')))
}

const ALLOWED_SORT_COLS = new Set(['date', 'amount', 'description', 'category', 'bank'])

function getTransactions({ startDate, endDate, bank, category, search, limit = 50, offset = 0, sortBy = 'date', sortDir = 'desc', userId } = {}) {
  const col = ALLOWED_SORT_COLS.has(sortBy) ? sortBy : 'date'
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC'
  let q = 'SELECT * FROM transactions WHERE user_id = ?'
  const p = [userId]
  if (startDate) { q += ' AND date >= ?'; p.push(startDate) }
  if (endDate) { q += ' AND date <= ?'; p.push(endDate) }
  if (bank) { q += ' AND bank = ?'; p.push(bank) }
  if (category) { q += ' AND category = ?'; p.push(category) }
  if (search) { q += ' AND (description LIKE ? OR notes LIKE ?)'; p.push(`%${search}%`, `%${search}%`) }
  q += ` ORDER BY ${col} ${dir}, id DESC LIMIT ? OFFSET ?`
  p.push(limit, offset)
  return getDb().prepare(q).all(...p)
}

function countTransactions({ startDate, endDate, bank, category, search, userId } = {}) {
  let q = 'SELECT COUNT(*) as count FROM transactions WHERE user_id = ?'
  const p = [userId]
  if (startDate) { q += ' AND date >= ?'; p.push(startDate) }
  if (endDate) { q += ' AND date <= ?'; p.push(endDate) }
  if (bank) { q += ' AND bank = ?'; p.push(bank) }
  if (category) { q += ' AND category = ?'; p.push(category) }
  if (search) { q += ' AND (description LIKE ? OR notes LIKE ?)'; p.push(`%${search}%`, `%${search}%`) }
  return getDb().prepare(q).get(...p)
}

function getAllForExport({ startDate, endDate, bank, category, search, userId } = {}) {
  let q = 'SELECT * FROM transactions WHERE user_id = ?'
  const p = [userId]
  if (startDate) { q += ' AND date >= ?'; p.push(startDate) }
  if (endDate) { q += ' AND date <= ?'; p.push(endDate) }
  if (bank) { q += ' AND bank = ?'; p.push(bank) }
  if (category) { q += ' AND category = ?'; p.push(category) }
  if (search) { q += ' AND (description LIKE ? OR notes LIKE ?)'; p.push(`%${search}%`, `%${search}%`) }
  q += ' ORDER BY date DESC'
  return getDb().prepare(q).all(...p)
}

function insertManualTransaction({ date, description, amount, category, bank, notes, userId }) {
  const unique_key = `${userId}_MANUAL-${date}-${description.slice(0, 40)}-${amount}-${Date.now()}`
  return getDb().prepare(`
    INSERT INTO transactions (date, description, amount, currency, bank, category, category_overridden, notes, unique_key, user_id)
    VALUES (?, ?, ?, 'MXN', ?, ?, 1, ?, ?, ?)
  `).run(date, description, amount, bank, category, notes || null, unique_key, userId)
}

function updateTransaction(id, { category, notes }, userId) {
  if (notes !== undefined && category !== undefined) {
    return getDb().prepare('UPDATE transactions SET category = ?, category_overridden = 1, notes = ? WHERE id = ? AND user_id = ?').run(category, notes, id, userId)
  }
  if (category !== undefined) {
    return getDb().prepare('UPDATE transactions SET category = ?, category_overridden = 1 WHERE id = ? AND user_id = ?').run(category, id, userId)
  }
  return getDb().prepare('UPDATE transactions SET notes = ? WHERE id = ? AND user_id = ?').run(notes, id, userId)
}

// ─── Dashboard / Insights ────────────────────────────────────────────────────

const EXCLUDED = `category NOT IN ('Ingresos', 'Pago TC')`

function getTotalByBank(userId) {
  return getDb().prepare(`
    SELECT bank, SUM(amount) as total FROM transactions
    WHERE amount > 0 AND ${EXCLUDED} AND user_id = ? GROUP BY bank
  `).all(userId)
}

function getMonthlySpendByCategory(year, month, userId) {
  const m = `${year}-${String(month).padStart(2, '0')}`
  return getDb().prepare(`
    SELECT category, SUM(amount) as total
    FROM transactions
    WHERE strftime('%Y-%m', date) = ? AND amount > 0 AND ${EXCLUDED} AND user_id = ?
    GROUP BY category ORDER BY total DESC
  `).all(m, userId)
}

function getLast6MonthsTrend(userId) {
  return getDb().prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
    FROM transactions
    WHERE amount > 0 AND ${EXCLUDED} AND date >= date('now', '-6 months') AND user_id = ?
    GROUP BY month ORDER BY month ASC
  `).all(userId)
}

function getTopMerchants(year, month, limit = 5, userId) {
  const m = `${year}-${String(month).padStart(2, '0')}`
  return getDb().prepare(`
    SELECT description, SUM(amount) as total, COUNT(*) as count
    FROM transactions
    WHERE strftime('%Y-%m', date) = ? AND amount > 0 AND ${EXCLUDED} AND user_id = ?
    GROUP BY description ORDER BY total DESC LIMIT ?
  `).all(m, userId, limit)
}

function getMonthlyByCategoryRange(userId) {
  return getDb().prepare(`
    SELECT strftime('%Y-%m', date) as month, category, SUM(amount) as total
    FROM transactions
    WHERE amount > 0 AND ${EXCLUDED} AND date >= date('now', '-6 months') AND user_id = ?
    GROUP BY month, category ORDER BY month ASC
  `).all(userId)
}

function getDailySpend(year, month, userId) {
  const m = `${year}-${String(month).padStart(2, '0')}`
  return getDb().prepare(`
    SELECT date, SUM(amount) as total
    FROM transactions
    WHERE strftime('%Y-%m', date) = ? AND amount > 0 AND ${EXCLUDED} AND user_id = ?
    GROUP BY date ORDER BY date ASC
  `).all(m, userId)
}

function getAllExpenseTransactions(userId) {
  return getDb().prepare(`
    SELECT id, date, description, amount, category, bank
    FROM transactions WHERE amount > 0 AND user_id = ? ORDER BY date ASC
  `).all(userId)
}

function getAllMonthlyByCategory(userId) {
  return getDb().prepare(`
    SELECT strftime('%Y-%m', date) as month, category, SUM(amount) as total
    FROM transactions WHERE amount > 0 AND ${EXCLUDED} AND user_id = ?
    GROUP BY month, category ORDER BY month ASC
  `).all(userId)
}

function getMonthlyExpenseTotals(limitMonths = 6, userId) {
  return getDb().prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
    FROM transactions
    WHERE amount > 0 AND ${EXCLUDED} AND date >= date('now', '-${limitMonths} months') AND user_id = ?
    GROUP BY month ORDER BY month DESC
  `).all(userId)
}

function getTotalExpenses(year, month, userId) {
  const m = `${year}-${String(month).padStart(2, '0')}`
  return getDb().prepare(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE strftime('%Y-%m', date) = ? AND amount > 0 AND ${EXCLUDED} AND user_id = ?`).get(m, userId)?.total || 0
}

function getTotalIncome(year, month, userId) {
  const m = `${year}-${String(month).padStart(2, '0')}`
  return getDb().prepare(`SELECT COALESCE(ABS(SUM(amount)),0) as total FROM transactions WHERE strftime('%Y-%m', date) = ? AND amount < 0 AND user_id = ?`).get(m, userId)?.total || 0
}

function getYearTotals(year, userId) {
  const y = String(year)
  const expenses = getDb().prepare(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE strftime('%Y', date) = ? AND amount > 0 AND ${EXCLUDED} AND user_id = ?`).get(y, userId)?.total || 0
  const income   = getDb().prepare(`SELECT COALESCE(ABS(SUM(amount)),0) as total FROM transactions WHERE strftime('%Y', date) = ? AND amount < 0 AND user_id = ?`).get(y, userId)?.total || 0
  return { expenses, income, balance: income - expenses }
}

function getPagoTCTransactions(year, month, userId) {
  const m = `${year}-${String(month).padStart(2, '0')}`
  return getDb().prepare(`
    SELECT date, description, amount
    FROM transactions
    WHERE strftime('%Y-%m', date) = ? AND category = 'Pago TC' AND amount > 0 AND user_id = ?
    ORDER BY date DESC
  `).all(m, userId)
}

function getPagoTCTotal(year, month, userId) {
  const m = `${year}-${String(month).padStart(2, '0')}`
  return getDb().prepare(`
    SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
    FROM transactions
    WHERE strftime('%Y-%m', date) = ? AND category = 'Pago TC' AND amount > 0 AND user_id = ?
  `).get(m, userId) || { total: 0, count: 0 }
}

function getLatestDataMonth(userId) {
  const row = getDb().prepare(`
    SELECT strftime('%Y-%m', date) as month FROM transactions
    WHERE amount > 0 AND user_id = ? ORDER BY date DESC LIMIT 1
  `).get(userId)
  return row?.month || null
}

function hasAnyTransactions(userId) {
  return getDb().prepare('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?').get(userId).count > 0
}

// ─── Migrations (run once on startup, no user scope needed) ──────────────────

function migrateIncomeCategory() {
  getDb().prepare(`UPDATE transactions SET category = 'Ingresos' WHERE amount < 0 AND category_overridden = 0 AND category != 'Ingresos'`).run()
}

function migrateRecategorizeOtros() {
  const { categorize } = require('../utils/categorize')
  const rows = getDb().prepare(`SELECT id, description, amount FROM transactions WHERE category = 'Otros' AND category_overridden = 0`).all()
  const update = getDb().prepare(`UPDATE transactions SET category = ? WHERE id = ?`)
  getDb().transaction(() => { for (const r of rows) { const c = categorize(r.description, r.amount); if (c !== 'Otros') update.run(c, r.id) } })()
}

function migrateRecategorizeAll() {
  const { categorize } = require('../utils/categorize')
  const rows = getDb().prepare(`SELECT id, description, amount, category FROM transactions WHERE category_overridden = 0`).all()
  const update = getDb().prepare(`UPDATE transactions SET category = ? WHERE id = ?`)
  getDb().transaction(() => { for (const r of rows) { const c = categorize(r.description, r.amount); if (c !== r.category) update.run(c, r.id) } })()
}

function migrateTransferenciasCategory() {
  getDb().prepare(`
    UPDATE transactions SET category = 'Transferencias'
    WHERE category_overridden = 0 AND category NOT IN ('Pago TC','Ingresos','Transferencias') AND amount > 0
    AND (description LIKE '%SPEI%' OR description LIKE '%PAGO CUENTA DE TERCERO%')
  `).run()
}

function migratePagoTCCategory() {
  getDb().prepare(`
    UPDATE transactions SET category = 'Pago TC'
    WHERE category_overridden = 0 AND category != 'Pago TC' AND amount > 0
    AND (
      description LIKE '%AMERICAN EXPRESS%' OR description LIKE '%PAGO TDC%'
      OR description LIKE '%PAGO TARJETA%' OR description LIKE '%PAGO TC %'
      OR description LIKE '%PAGO BANAMEX%' OR description LIKE '%PAGO BANCOMER%'
      OR description LIKE '%PAGO CITIBANAMEX%' OR description LIKE '%PAGO SANTANDER%'
      OR description LIKE '%PAGO HSBC%' OR description LIKE '%PAGO BANORTE%'
      OR description LIKE '%PAGO INBURSA%'
    )
  `).run()
}

// ─── Merchant Rules ───────────────────────────────────────────────────────────

function extractPattern(description) {
  const upper = (description || '').trim().toUpperCase()
  return upper.split(/\s+/).slice(0, 3).join(' ').slice(0, 22)
}

function upsertMerchantRule(description, category, userId) {
  const pattern = extractPattern(description)
  if (!pattern) return
  getDb().prepare(`
    INSERT INTO merchant_rules (pattern, category, user_id) VALUES (?, ?, ?)
    ON CONFLICT(user_id, pattern) DO UPDATE SET category = excluded.category, updated_at = CURRENT_TIMESTAMP
  `).run(pattern, category, userId)
  getDb().prepare(`
    UPDATE transactions SET category = ?
    WHERE UPPER(description) LIKE ? AND category_overridden = 0 AND user_id = ?
  `).run(category, `${pattern}%`, userId)
}

function getMerchantRules(userId) {
  return getDb().prepare('SELECT pattern, category FROM merchant_rules WHERE user_id = ?').all(userId)
}

function applyMerchantRules(userId) {
  const rules = userId ? getMerchantRules(userId) : getDb().prepare('SELECT pattern, category, user_id FROM merchant_rules').all()
  const update = getDb().prepare(`UPDATE transactions SET category = ? WHERE UPPER(description) LIKE ? AND category_overridden = 0 AND user_id = ?`)
  getDb().transaction(() => {
    for (const rule of rules) {
      update.run(rule.category, `${rule.pattern}%`, rule.user_id ?? userId)
    }
  })()
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

function getBudgets(userId) {
  return getDb().prepare('SELECT category, monthly_limit FROM budgets WHERE user_id = ?').all(userId)
}

function upsertBudget(category, monthly_limit, userId) {
  return getDb().prepare(`
    INSERT INTO budgets (category, monthly_limit, user_id) VALUES (?, ?, ?)
    ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit, updated_at = CURRENT_TIMESTAMP
  `).run(category, monthly_limit, userId)
}

function deleteBudget(category, userId) {
  return getDb().prepare('DELETE FROM budgets WHERE category = ? AND user_id = ?').run(category, userId)
}

module.exports = {
  getUserByUsername, createUser,
  insertTransactions, getExistingKeys, insertManualTransaction,
  getTransactions, countTransactions, getAllForExport, updateTransaction,
  getTotalByBank, getMonthlySpendByCategory, getLast6MonthsTrend,
  getTopMerchants, getMonthlyByCategoryRange, getDailySpend,
  getTotalExpenses, getTotalIncome, getYearTotals, getPagoTCTransactions, getPagoTCTotal,
  migrateIncomeCategory, migratePagoTCCategory, migrateTransferenciasCategory,
  migrateRecategorizeOtros, migrateRecategorizeAll,
  getAllExpenseTransactions, getAllMonthlyByCategory, getMonthlyExpenseTotals,
  getLatestDataMonth, hasAnyTransactions,
  getBudgets, upsertBudget, deleteBudget,
  upsertMerchantRule, getMerchantRules, applyMerchantRules,
}
