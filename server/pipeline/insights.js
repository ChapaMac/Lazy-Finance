// Insights engine — all calculations operate on AGGREGATED data, not raw transactions
// Input: arrays of transactions / monthly summaries from queries
// Output: structured insight objects ready to serve to the frontend

// ── Burn Rate ─────────────────────────────────────────────────────────────────
// Average monthly expenses over the last N months
function calcBurnRate(monthlyTotals, months = 3) {
  const sorted = [...monthlyTotals].sort((a, b) => b.month.localeCompare(a.month))
  const window = sorted.slice(0, months).filter(m => m.total > 0)
  if (!window.length) return 0
  return window.reduce((s, m) => s + m.total, 0) / window.length
}

// ── Cashflow Ratio ────────────────────────────────────────────────────────────
// What % of income was spent this month
function calcCashflowRatio(expenses, income) {
  if (!income || income === 0) return null
  return Math.round((expenses / income) * 100)
}

// ── Subscription Detection ────────────────────────────────────────────────────
// A merchant is a "subscription" when:
//   - appears in >= 2 distinct calendar months
//   - all charges within ±8% of the median amount
//   - median amount < 2,000 MXN (filters out irregular recurring bills)
function detectSubscriptions(transactions) {
  const groups = {}
  for (const tx of transactions) {
    if (tx.amount <= 0) continue
    const key = tx.description.trim().toUpperCase()
    if (!groups[key]) groups[key] = []
    groups[key].push(tx)
  }

  const subs = []
  for (const [merchant, txs] of Object.entries(groups)) {
    const months = [...new Set(txs.map(t => t.date.slice(0, 7)))]
    if (months.length < 2) continue

    const amounts = txs.map(t => t.amount).sort((a, b) => a - b)
    const median = amounts[Math.floor(amounts.length / 2)]
    const maxDev = Math.max(...amounts.map(a => Math.abs(a - median) / median))

    if (maxDev <= 0.08 && median < 2000) {
      subs.push({
        merchant,
        amount: Math.round(median * 100) / 100,
        months: months.length,
        category: txs[txs.length - 1].category,
        lastCharge: txs.sort((a, b) => b.date.localeCompare(a.date))[0].date,
      })
    }
  }

  return subs.sort((a, b) => b.amount - a.amount)
}

// ── Anomaly Detection ─────────────────────────────────────────────────────────
// For each category, compute historical mean + stddev across months.
// Flag any month where spending > mean + 1.5 * stddev AND
// deviation is at least 30% above mean (avoids noise on tiny categories).
function detectAnomalies(monthlyByCategory) {
  const byCategory = {}
  for (const row of monthlyByCategory) {
    if (!byCategory[row.category]) byCategory[row.category] = []
    byCategory[row.category].push({ month: row.month, total: Number(row.total) })
  }

  const anomalies = []
  for (const [category, data] of Object.entries(byCategory)) {
    if (data.length < 2) continue
    const totals = data.map(d => d.total)
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length
    if (mean < 50) continue // ignore trivially small categories
    const stddev = Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length)
    const threshold = mean + 1.5 * stddev

    for (const d of data) {
      const pctAbove = (d.total - mean) / mean
      if (d.total > threshold && pctAbove > 0.3) {
        anomalies.push({
          category,
          month: d.month,
          amount: Math.round(d.total),
          avg: Math.round(mean),
          pctAbove: Math.round(pctAbove * 100),
        })
      }
    }
  }

  return anomalies.sort((a, b) => b.pctAbove - a.pctAbove).slice(0, 5)
}

// ── Fixed vs Variable Split ───────────────────────────────────────────────────
// Fixed = detected subscriptions + Servicios category
// Variable = everything else
function calcFixedVariable(categoryBreakdown, subscriptions) {
  const FIXED_CATEGORIES = new Set(['Servicios'])
  const subMerchants = new Set(subscriptions.map(s => s.merchant))

  let fixed = 0, variable = 0
  for (const cat of categoryBreakdown) {
    if (cat.category === 'Ingresos') continue
    if (FIXED_CATEGORIES.has(cat.category)) {
      fixed += cat.total
    } else {
      // Within variable categories, subscriptions count as fixed
      variable += cat.total
    }
  }
  // Move subscription amounts from variable to fixed
  const subTotal = subscriptions.reduce((s, sub) => s + sub.amount, 0)
  fixed += subTotal
  variable = Math.max(0, variable - subTotal)

  const total = fixed + variable
  return {
    fixed: Math.round(fixed),
    variable: Math.round(variable),
    fixedPct: total > 0 ? Math.round((fixed / total) * 100) : 0,
    variablePct: total > 0 ? Math.round((variable / total) * 100) : 0,
  }
}

// ── Category Dependency ───────────────────────────────────────────────────────
// % of income consumed by each category
function calcCategoryDependency(categoryBreakdown, income) {
  if (!income || income === 0) return []
  return categoryBreakdown
    .filter(c => c.category !== 'Ingresos' && c.total > 0)
    .map(c => ({
      category: c.category,
      amount: Math.round(c.total),
      pctOfIncome: Math.round((c.total / income) * 100),
    }))
    .sort((a, b) => b.amount - a.amount)
}

// ── Payment Habits ────────────────────────────────────────────────────────────
const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function analyzePaymentHabits(allTransactions) {
  const expenses = allTransactions.filter(t => t.amount > 0 && t.category !== 'Pago TC' && t.category !== 'Ingresos')
  const ccPayments = allTransactions.filter(t => t.category === 'Pago TC').sort((a, b) => b.date.localeCompare(a.date))

  // Weekly spending pattern
  const weekMap = {}
  for (const tx of expenses) {
    const dow = new Date(tx.date + 'T12:00:00').getDay()
    if (!weekMap[dow]) weekMap[dow] = { total: 0, count: 0 }
    weekMap[dow].total += tx.amount
    weekMap[dow].count++
  }
  const weeklyPattern = [0, 1, 2, 3, 4, 5, 6].map(d => ({
    day: DAYS_ES[d],
    total: Math.round(weekMap[d]?.total || 0),
    count: weekMap[d]?.count || 0,
    avg: weekMap[d]?.count ? Math.round(weekMap[d].total / weekMap[d].count) : 0,
  }))

  // Month-period breakdown: early (1-10), mid (11-20), late (21-31)
  const periods = { early: 0, mid: 0, late: 0 }
  for (const tx of expenses) {
    const day = parseInt(tx.date.split('-')[2])
    if (day <= 10) periods.early += tx.amount
    else if (day <= 20) periods.mid += tx.amount
    else periods.late += tx.amount
  }
  const periodTotal = periods.early + periods.mid + periods.late
  const monthPeriods = [
    { label: 'Inicio (1–10)', total: Math.round(periods.early), pct: periodTotal ? Math.round(periods.early / periodTotal * 100) : 0 },
    { label: 'Medio (11–20)', total: Math.round(periods.mid), pct: periodTotal ? Math.round(periods.mid / periodTotal * 100) : 0 },
    { label: 'Fin (21–31)', total: Math.round(periods.late), pct: periodTotal ? Math.round(periods.late / periodTotal * 100) : 0 },
  ]

  // Credit card payment stats
  const ccTotal = ccPayments.reduce((s, t) => s + t.amount, 0)
  const ccAvg = ccPayments.length ? Math.round(ccTotal / ccPayments.length) : 0

  // Peak spending day label
  const peakDay = weeklyPattern.reduce((max, d) => d.total > max.total ? d : max, weeklyPattern[0])
  const quietDay = weeklyPattern.reduce((min, d) => d.total < min.total && d.count > 0 ? d : min, weeklyPattern.find(d => d.count > 0) || weeklyPattern[0])

  return {
    weeklyPattern,
    monthPeriods,
    peakDay: peakDay.day,
    quietDay: quietDay?.day || null,
    ccPayments: ccPayments.slice(0, 6),
    ccCount: ccPayments.length,
    ccAvg,
    ccTotal: Math.round(ccTotal),
  }
}

module.exports = {
  calcBurnRate,
  calcCashflowRatio,
  detectSubscriptions,
  detectAnomalies,
  calcFixedVariable,
  calcCategoryDependency,
  analyzePaymentHabits,
}
