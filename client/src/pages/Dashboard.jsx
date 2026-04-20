import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, AlertTriangle, CreditCard, Upload, ArrowDownLeft, ArrowUpRight, FileDown, ChevronLeft, ChevronRight } from 'lucide-react'
import Card from '../components/ui/Card'
import DonutChart from '../components/charts/DonutChart'
import TrendLine from '../components/charts/TrendLine'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton'
import { formatMXN, CATEGORY_COLORS } from '../utils/formatters'
import { useI18n } from '../contexts/I18nContext'
import api from '../utils/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pctChange(current, prev) {
  if (!prev) return null
  return ((current - prev) / prev) * 100
}

function DeltaBadge({ value, invert = false }) {
  if (value === null) return null
  const positive = invert ? value < 0 : value > 0
  const color = positive ? '#22C55E' : '#EF4444'
  const Icon  = positive ? TrendingUp : TrendingDown
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color }}>
      <Icon size={11} />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ── Insight text generators ───────────────────────────────────────────────────

function expenseInsight(categoryData, budgetMap) {
  const overBudget = categoryData.filter(c => budgetMap[c.category] && c.total > budgetMap[c.category])
  if (overBudget.length)
    return `${overBudget.length} categoría${overBudget.length > 1 ? 's' : ''} sobre presupuesto`
  if (categoryData[0])
    return `Mayor gasto: ${categoryData[0].category}`
  return 'Sin movimientos este mes'
}

function incomeInsight(income, expenses) {
  if (!income) return 'Sin ingresos registrados'
  const savings = income - expenses
  const rate = income > 0 ? ((savings / income) * 100).toFixed(0) : 0
  if (savings >= 0) return `Tasa de ahorro: ${rate}%`
  return `Déficit del ${Math.abs(rate)}% del ingreso`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const [data, setData]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(false)
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [initialized, setInitialized]     = useState(false)

  useEffect(() => {
    api.get('/api/insights/latestMonth').then(res => {
      if (res.data.month) {
        const [y, m] = res.data.month.split('-').map(Number)
        setSelectedYear(y)
        setSelectedMonth(m)
      }
      setInitialized(true)
    }).catch(() => setInitialized(true))
  }, [])

  useEffect(() => {
    if (!initialized) return
    setLoading(true)
    setError(false)
    api.get(`/api/insights/dashboard?year=${selectedYear}&month=${selectedMonth}`)
      .then(res => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [selectedYear, selectedMonth, initialized])

  function fetchData() {
    setLoading(true); setError(false)
    api.get(`/api/insights/dashboard?year=${selectedYear}&month=${selectedMonth}`)
      .then(res => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  function prevMonth() {
    if (selectedMonth === 1) { setSelectedYear(y => y - 1); setSelectedMonth(12) }
    else setSelectedMonth(m => m - 1)
  }
  function nextMonth() {
    if (selectedMonth === 12) { setSelectedYear(y => y + 1); setSelectedMonth(1) }
    else setSelectedMonth(m => m + 1)
  }

  async function exportPDF() {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const monthLabel = new Date(selectedYear, selectedMonth - 1, 1)
      .toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase())
    const bg = [11, 15, 20]; const cardC = [15, 23, 42]
    const green = [34, 197, 94]; const slate = [100, 116, 139]; const white = [229, 231, 235]
    doc.setFillColor(...bg); doc.rect(0, 0, 210, 297, 'F')
    doc.setFillColor(...cardC); doc.rect(0, 0, 210, 26, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...white)
    doc.text('Lazy Finance', 14, 11)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...slate)
    doc.text('Resumen mensual', 14, 19)
    doc.setTextColor(...green); doc.text(monthLabel, 196, 11, { align: 'right' })
    let y = 36
    const kpis = [
      { label: 'Gastos',      value: formatMXN(totalExpenses), color: [239,68,68] },
      { label: 'Ingresos',    value: formatMXN(totalIncome),   color: [...green] },
      { label: 'Balance',     value: (netBalance >= 0 ? '+' : '') + formatMXN(Math.abs(netBalance)), color: netBalance >= 0 ? [...green] : [239,68,68] },
    ]
    kpis.forEach((k, i) => {
      const x = 14 + i * 62
      doc.setFillColor(...cardC); doc.roundedRect(x, y, 58, 20, 2, 2, 'F')
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(...slate)
      doc.text(k.label.toUpperCase(), x+4, y+6)
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...k.color)
      doc.text(k.value, x+4, y+15)
    })
    y += 28
    categoryData.slice(0,10).forEach(cat => {
      const pct = monthTotal > 0 ? ((cat.total / monthTotal)*100).toFixed(0) : 0
      const bw  = monthTotal > 0 ? (cat.total / monthTotal) * 110 : 0
      doc.setFillColor(...cardC); doc.roundedRect(14, y, 182, 8, 1, 1, 'F')
      doc.setFillColor(...green); if (bw > 0) doc.roundedRect(14, y, bw, 8, 1, 1, 'F')
      doc.setFontSize(7); doc.setFont('helvetica','normal')
      doc.setTextColor(...white); doc.text(cat.category, 17, y+5.5)
      doc.setTextColor(...slate); doc.text(`${formatMXN(cat.total)}  ${pct}%`, 193, y+5.5, { align:'right' })
      y += 11
    })
    data?.topMerchants?.forEach((m, i) => {
      doc.setFillColor(...cardC); doc.roundedRect(14, y, 182, 8, 1, 1, 'F')
      doc.setFontSize(7); doc.setFont('helvetica','normal')
      doc.setTextColor(...slate); doc.text(`${i+1}`, 18, y+5.5)
      doc.setTextColor(...white); doc.text(m.description.slice(0,55), 26, y+5.5)
      doc.setTextColor(...green); doc.text(formatMXN(m.total), 193, y+5.5, { align:'right' })
      y += 11
    })
    doc.setFontSize(7); doc.setTextColor(...slate)
    doc.text(`Lazy Finance · ${new Date().toLocaleDateString('es-MX')}`, 105, 291, { align:'center' })
    doc.save(`resumen-${selectedYear}-${String(selectedMonth).padStart(2,'0')}.pdf`)
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-8 w-48" />
      </div>
      <SkeletonCard><Skeleton className="h-16 w-56 mb-3" /><Skeleton className="h-4 w-40" /></SkeletonCard>
      <div className="grid grid-cols-3 gap-4">
        {[0,1,2].map(i => <SkeletonCard key={i}><Skeleton className="h-3 w-16 mb-3" /><Skeleton className="h-6 w-28 mb-2" /><Skeleton className="h-3 w-32" /></SkeletonCard>)}
      </div>
      <div className="grid grid-cols-2 gap-5">
        <SkeletonCard><Skeleton className="h-4 w-32 mb-4" /><Skeleton className="h-48 w-full" /></SkeletonCard>
        <SkeletonCard><Skeleton className="h-4 w-28 mb-4" /><Skeleton className="h-48 w-full" /></SkeletonCard>
      </div>
    </div>
  )

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-slate-500 text-sm">No se pudo conectar al servidor.</p>
      <button onClick={fetchData}
        className="px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-xl text-sm transition-colors">
        Reintentar
      </button>
    </div>
  )

  // ── Empty state ─────────────────────────────────────────────────────────────
  const isEmpty = !data?.totalExpenses && !data?.categoryBreakdown?.length
  if (isEmpty) {
    const emptyMonthLabel = new Date(selectedYear, selectedMonth - 1, 1)
      .toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return (
      <div className="space-y-5">
        {/* Keep navigation so user isn't trapped */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-200">Dashboard</h1>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth}
              className="p-2 rounded-xl text-slate-500 hover:text-gray-300 transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm text-slate-400 capitalize min-w-32 text-center">{emptyMonthLabel}</span>
            <button onClick={nextMonth}
              className="p-2 rounded-xl text-slate-500 hover:text-gray-300 transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-80 gap-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <CreditCard size={24} className="text-slate-600" />
          </div>
          <div className="text-center">
            <h2 className="text-gray-200 font-semibold text-base">Sin datos este mes</h2>
            <p className="text-slate-500 text-sm mt-1">No hay movimientos para {emptyMonthLabel}</p>
          </div>
          <button onClick={() => navigate('/upload')}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
            <Upload size={15} />
            Cargar estado de cuenta
          </button>
        </div>
      </div>
    )
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const totalExpenses  = data?.totalExpenses  || 0
  const totalIncome    = data?.totalIncome    || 0
  const netBalance     = totalIncome - totalExpenses
  const ytd            = data?.yearTotals || { expenses: 0, income: 0, balance: 0 }
  const prevExpenses   = data?.prevTotalExpenses || 0
  const prevIncome     = data?.prevTotalIncome   || 0
  const prevNet        = prevIncome - prevExpenses
  const netDelta       = pctChange(netBalance, prevNet)
  const expenseDelta   = pctChange(totalExpenses, prevExpenses)
  const incomeDelta    = pctChange(totalIncome, prevIncome)
  const dataMonth      = data?.dataMonth || ''
  const categoryData   = (data?.categoryBreakdown || []).filter(c => c.category !== 'Ingresos' && c.category !== 'Pago TC')
  const pagoTC         = data?.pagoTC || { total: 0, count: 0 }
  const pagoTCTxs      = data?.pagoTCTransactions || []
  const budgets        = data?.budgets || []
  const budgetMap      = Object.fromEntries(budgets.map(b => [b.category, b.monthly_limit]))
  const monthTotal     = categoryData.reduce((s, c) => s + c.total, 0)

  // Alerts
  const alertCategories = categoryData.filter(c => {
    if (budgetMap[c.category] != null) return c.total > budgetMap[c.category]
    return monthTotal > 0 && (c.total / monthTotal) > 0.30
  })

  const monthLabel = new Date(selectedYear, selectedMonth - 1, 1)
    .toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5 animate-fade-up">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-200">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth}
            className="p-2 rounded-xl text-slate-500 hover:text-gray-300 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm text-slate-400 capitalize min-w-32 text-center">{monthLabel}</span>
          <button onClick={nextMonth}
            className="p-2 rounded-xl text-slate-500 hover:text-gray-300 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <ChevronRight size={14} />
          </button>
          <button onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-gray-300 transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <FileDown size={13} />
            PDF
          </button>
        </div>
      </div>

      {/* ── Year-to-date banner ───────────────────────────────────────────── */}
      <div className="rounded-2xl px-5 py-4 flex items-center gap-6 flex-wrap"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {selectedYear} · Acumulado
          </span>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-xs text-slate-600 mb-0.5">Gastos</p>
            <p className="text-base font-bold font-mono text-red-400">{formatMXN(ytd.expenses)}</p>
          </div>
          <div className="w-px h-8 bg-white/[0.06]" />
          <div>
            <p className="text-xs text-slate-600 mb-0.5">Ingresos</p>
            <p className="text-base font-bold font-mono text-emerald-400">{formatMXN(ytd.income)}</p>
          </div>
          <div className="w-px h-8 bg-white/[0.06]" />
          <div>
            <p className="text-xs text-slate-600 mb-0.5">Balance neto</p>
            <p className="text-base font-bold font-mono" style={{ color: ytd.balance >= 0 ? '#22C55E' : '#EF4444' }}>
              {ytd.balance >= 0 ? '+' : ''}{formatMXN(ytd.balance)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Hero KPI ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Ambient glow behind number */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: netBalance >= 0
            ? 'radial-gradient(ellipse 60% 50% at 15% 60%, rgba(34,197,94,0.07) 0%, transparent 70%)'
            : 'radial-gradient(ellipse 60% 50% at 15% 60%, rgba(239,68,68,0.07) 0%, transparent 70%)',
        }} />

        <div className="relative flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-3">
              Balance neto · {monthLabel}
            </p>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-5xl font-bold tracking-tight font-mono"
                style={{ color: netBalance >= 0 ? '#22C55E' : '#EF4444' }}>
                <AnimatedNumber
                  value={Math.abs(netBalance)}
                  formatter={v => (netBalance < 0 ? '-' : '+') + formatMXN(v)}
                />
              </span>
              {netDelta !== null && (
                <DeltaBadge value={netDelta} />
              )}
            </div>
            <p className="text-sm text-slate-500">
              {netBalance >= 0 ? 'Ahorraste este mes' : 'Gastaste más de lo que ingresó'}
              {netDelta !== null && prevNet !== 0 && (
                <span className="ml-1">· vs {new Date(selectedYear, selectedMonth - 2, 1).toLocaleDateString('es-MX', { month: 'long' })}</span>
              )}
            </p>
          </div>

          {/* Mini trend */}
          <div className="hidden md:block w-44 opacity-60">
            <TrendLine data={data?.trend || []} />
          </div>
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Gastos */}
        <div className="rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Gastos</p>
            <ArrowUpRight size={14} style={{ color: '#EF4444' }} />
          </div>
          <p className="text-2xl font-bold font-mono text-gray-100 mb-1">
            <AnimatedNumber value={totalExpenses} formatter={formatMXN} />
          </p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{expenseInsight(categoryData, budgetMap)}</p>
            {expenseDelta !== null && <DeltaBadge value={expenseDelta} invert />}
          </div>
        </div>

        {/* Ingresos */}
        <div className="rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Ingresos</p>
            <ArrowDownLeft size={14} style={{ color: '#22C55E' }} />
          </div>
          <p className="text-2xl font-bold font-mono mb-1" style={{ color: '#22C55E' }}>
            <AnimatedNumber value={totalIncome} formatter={formatMXN} />
          </p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{incomeInsight(totalIncome, totalExpenses)}</p>
            {incomeDelta !== null && <DeltaBadge value={incomeDelta} />}
          </div>
        </div>

        {/* Pago TC */}
        <div className="rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Pago TC</p>
            <CreditCard size={14} className="text-slate-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-400 mb-1">
            <AnimatedNumber value={pagoTC.total} formatter={formatMXN} />
          </p>
          <p className="text-xs text-slate-600">
            {pagoTC.count > 0 ? `${pagoTC.count} pago${pagoTC.count > 1 ? 's' : ''} · excluido del análisis` : 'Sin pagos a tarjeta'}
          </p>
        </div>
      </div>

      {/* ── Smart Alerts ──────────────────────────────────────────────────── */}
      {alertCategories.map(cat => {
        const limit = budgetMap[cat.category]
        return (
          <div key={cat.category}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <AlertTriangle size={14} style={{ color: '#F59E0B', flexShrink: 0 }} />
            <p className="text-sm" style={{ color: '#FCD34D' }}>
              {limit != null
                ? <><strong>{cat.category}</strong> superó el presupuesto — {formatMXN(cat.total)} de {formatMXN(limit)} ({((cat.total / limit) * 100).toFixed(0)}%)</>
                : <><strong>{cat.category}</strong> representa el {((cat.total / monthTotal) * 100).toFixed(0)}% del gasto total este mes</>
              }
            </p>
          </div>
        )
      })}

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-2xl p-5" style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-medium text-gray-300">{t('dashboard.spendByCategory')}</p>
            <button onClick={() => navigate('/transactions')}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors">ver todo →</button>
          </div>
          <DonutChart
            data={categoryData}
            colors={CATEGORY_COLORS}
            onSliceClick={(category) => navigate(`/transactions?category=${encodeURIComponent(category)}&month=${dataMonth}`)}
          />
        </div>

        <div className="rounded-2xl p-5" style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-sm font-medium text-gray-300 mb-5">{t('dashboard.monthlyTrend')}</p>
          <TrendLine data={data?.trend || []} />

          {/* Inline trend insight */}
          {data?.trend?.length >= 2 && (() => {
            const trend = data.trend
            const last  = trend[trend.length - 1]?.total || 0
            const prev  = trend[trend.length - 2]?.total || 0
            const delta = pctChange(last, prev)
            const up    = delta > 0
            return delta !== null ? (
              <p className="text-xs mt-4 pt-4" style={{ color: '#94A3B8', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: up ? '#EF4444' : '#22C55E' }}>
                  {up ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
                </span>
                {' '}vs mes anterior
              </p>
            ) : null
          })()}
        </div>
      </div>

      {/* ── Top Merchants ─────────────────────────────────────────────────── */}
      {data?.topMerchants?.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-medium text-gray-300">{t('dashboard.topMerchants')}</p>
            <p className="text-xs text-slate-600">Top 5 del mes</p>
          </div>
          <div className="space-y-3">
            {data.topMerchants.map((m, i) => {
              const barW = (m.total / data.topMerchants[0].total) * 100
              return (
                <div key={m.description} className="group">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-xs font-mono text-slate-600 w-4 flex-shrink-0">{i + 1}</span>
                    <p className="text-sm text-gray-300 flex-1 truncate">{m.description}</p>
                    <span className="text-sm font-mono font-medium text-gray-200 flex-shrink-0">
                      {formatMXN(m.total)}
                    </span>
                  </div>
                  <div className="ml-7 h-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${barW}%`,
                        background: i === 0 ? '#22C55E' : 'rgba(255,255,255,0.12)',
                      }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Pago TC detail ────────────────────────────────────────────────── */}
      {pagoTC.count > 0 && (
        <div className="rounded-2xl p-5" style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard size={14} className="text-slate-600" />
              <p className="text-sm font-medium text-gray-300">Pagos a tarjeta de crédito</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono font-semibold text-slate-400">{formatMXN(pagoTC.total)}</p>
              <p className="text-xs text-slate-600">{pagoTC.count} pago{pagoTC.count !== 1 ? 's' : ''} · excluido</p>
            </div>
          </div>
          <div className="space-y-2">
            {pagoTCTxs.map((tx, i) => (
              <div key={i} className="flex items-center gap-3 py-2"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-xs font-mono text-slate-600 w-20 flex-shrink-0">
                  {tx.date.split('-').reverse().join('/')}
                </span>
                <span className="text-sm text-slate-400 flex-1 truncate">{tx.description}</span>
                <span className="text-sm font-mono text-slate-500 flex-shrink-0">{formatMXN(tx.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
