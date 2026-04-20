const express = require('express')
const {
  getTotalByBank, getMonthlySpendByCategory, getLast6MonthsTrend,
  getTopMerchants, getMonthlyByCategoryRange, getDailySpend,
  getTotalExpenses, getTotalIncome, getYearTotals, getPagoTCTransactions, getPagoTCTotal, getLatestDataMonth,
  getAllExpenseTransactions, getAllMonthlyByCategory, getMonthlyExpenseTotals, getBudgets,
} = require('../db/queries')
const {
  calcBurnRate, calcCashflowRatio, detectSubscriptions,
  detectAnomalies, calcFixedVariable, calcCategoryDependency, analyzePaymentHabits,
} = require('../pipeline/insights')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()
router.use(authMiddleware)

router.get('/dashboard', (req, res) => {
  const uid = req.user.id
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const latestMonth = getLatestDataMonth(uid) || currentMonth
  const [latestYear, latestMonthNum] = latestMonth.split('-').map(Number)

  const year = parseInt(req.query.year) || latestYear
  const month = parseInt(req.query.month) || latestMonthNum
  const dataMonth = `${year}-${String(month).padStart(2, '0')}`

  const prevDate = new Date(year, month - 2, 1)
  const prevYear = prevDate.getFullYear()
  const prevMonth = prevDate.getMonth() + 1

  res.json({
    totalByBank: getTotalByBank(uid),
    categoryBreakdown: getMonthlySpendByCategory(year, month, uid),
    trend: getLast6MonthsTrend(uid),
    topMerchants: getTopMerchants(year, month, 5, uid),
    totalExpenses: getTotalExpenses(year, month, uid),
    totalIncome: getTotalIncome(year, month, uid),
    prevTotalExpenses: getTotalExpenses(prevYear, prevMonth, uid),
    prevTotalIncome: getTotalIncome(prevYear, prevMonth, uid),
    pagoTC: getPagoTCTotal(year, month, uid),
    pagoTCTransactions: getPagoTCTransactions(year, month, uid),
    budgets: getBudgets(uid),
    dataMonth,
    yearTotals: getYearTotals(year, uid),
  })
})

router.get('/monthly', (req, res) => {
  const uid = req.user.id
  const year = parseInt(req.query.year) || new Date().getFullYear()
  const month = parseInt(req.query.month) || new Date().getMonth() + 1

  const prevDate = new Date(year, month - 2, 1)
  const prevYear = prevDate.getFullYear()
  const prevMonth = prevDate.getMonth() + 1

  res.json({
    categoryBreakdown: getMonthlySpendByCategory(year, month, uid),
    prevCategoryBreakdown: getMonthlySpendByCategory(prevYear, prevMonth, uid),
    dailySpend: getDailySpend(year, month, uid),
    monthlyByCategory: getMonthlyByCategoryRange(uid),
    totalExpenses: getTotalExpenses(year, month, uid),
    totalIncome: getTotalIncome(year, month, uid),
  })
})

router.get('/behavior', (req, res) => {
  const uid = req.user.id
  const now = new Date()
  const latestMonth = getLatestDataMonth(uid) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = latestMonth.split('-').map(Number)

  const allTxs = getAllExpenseTransactions(uid)
  const allMonthly = getAllMonthlyByCategory(uid)
  const monthlyTotals = getMonthlyExpenseTotals(6, uid)
  const categoryBreakdown = getMonthlySpendByCategory(year, month, uid)
  const totalExpenses = getTotalExpenses(year, month, uid)
  const totalIncome = getTotalIncome(year, month, uid)

  const subscriptions = detectSubscriptions(allTxs)
  res.json({
    burnRate: Math.round(calcBurnRate(monthlyTotals)),
    cashflowRatio: calcCashflowRatio(totalExpenses, totalIncome),
    subscriptions,
    subscriptionTotal: Math.round(subscriptions.reduce((s, sub) => s + sub.amount, 0)),
    anomalies: detectAnomalies(allMonthly),
    fixedVariable: calcFixedVariable(categoryBreakdown, subscriptions),
    categoryDependency: calcCategoryDependency(categoryBreakdown, totalIncome),
    paymentHabits: analyzePaymentHabits(allTxs),
    dataMonth: latestMonth,
  })
})

router.get('/latestMonth', (req, res) => {
  const now = new Date()
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  res.json({ month: getLatestDataMonth(req.user.id) || fallback })
})

module.exports = router
