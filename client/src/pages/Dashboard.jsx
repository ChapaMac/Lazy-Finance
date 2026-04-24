import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Upload, CreditCard,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft,
  AlertTriangle, Zap, FileDown, Sparkles, Loader2,
} from 'lucide-react'
import DonutChart from '../components/charts/DonutChart'
import TrendLine from '../components/charts/TrendLine'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton'
import { formatMXN, CATEGORY_COLORS } from '../utils/formatters'
import { useI18n } from '../contexts/I18nContext'
import api from '../utils/api'

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(a, b) { return b ? ((a - b) / b) * 100 : null }

function DeltaChip({ value, invert = false, size = 'sm' }) {
  if (value === null || value === undefined) return null
  const good  = invert ? value <= 0 : value >= 0
  const color = good ? '#34D399' : '#F87171'
  const Icon  = value >= 0 ? TrendingUp : TrendingDown
  const cls   = size === 'lg' ? 'text-sm gap-1.5' : 'text-xs gap-1'
  return (
    <span className={`inline-flex items-center font-semibold ${cls}`} style={{ color }}>
      <Icon size={size === 'lg' ? 13 : 10} />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

function projectEndOfMonth(expenses, year, month) {
  const now = new Date()
  const isCurrentMonth = now.getFullYear() === year && (now.getMonth() + 1) === month
  if (!isCurrentMonth) return null
  const day = now.getDate()
  const daysInMonth = new Date(year, month, 0).getDate()
  if (day < 3) return null
  return Math.round((expenses / day) * daysInMonth)
}

// ── Card primitive ────────────────────────────────────────────────────────────

function Panel({ children, className = '', style = {} }) {
  return (
    <div
      className={`relative rounded-2xl ${className}`}
      style={{
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const [data, setData]                       = useState(null)
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState(false)
  const [selectedYear, setSelectedYear]       = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth]     = useState(new Date().getMonth() + 1)
  const [initialized, setInitialized]         = useState(false)
  const [aiSuggestions, setAiSuggestions]     = useState([])
  const [aiLoading, setAiLoading]             = useState(false)
  const [recap, setRecap]                     = useState(null)

  useEffect(() => {
    api.get('/api/insights/latestMonth').then(res => {
      if (res.data.month) {
        const [y, m] = res.data.month.split('-').map(Number)
        setSelectedYear(y); setSelectedMonth(m)
      }
      setInitialized(true)
    }).catch(() => setInitialized(true))
  }, [])

  useEffect(() => {
    if (!initialized) return
    setLoading(true); setError(false)
    setAiSuggestions([]); setRecap(null)
    api.get(`/api/insights/dashboard?year=${selectedYear}&month=${selectedMonth}`)
      .then(res => {
        setData(res.data)
        setAiLoading(true)
        Promise.all([
          api.get(`/api/ai/suggestions?year=${selectedYear}&month=${selectedMonth}`)
            .then(r => setAiSuggestions(r.data?.suggestions || [])).catch(() => {}),
          api.get(`/api/ai/recap?year=${selectedYear}&month=${selectedMonth}`)
            .then(r => setRecap(r.data?.recap || null)).catch(() => {}),
        ]).finally(() => setAiLoading(false))
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [selectedYear, selectedMonth, initialized])

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
    const bg = [13, 17, 23]; const cardC = [17, 24, 39]
    const green = [52, 211, 153]; const slate = [100, 116, 139]; const white = [229, 231, 235]
    doc.setFillColor(...bg); doc.rect(0, 0, 210, 297, 'F')
    doc.setFillColor(...cardC); doc.rect(0, 0, 210, 26, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...white)
    doc.text('Lazy Finance', 14, 11)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...slate)
    doc.text('Resumen mensual', 14, 19)
    doc.setTextColor(...green); doc.text(monthLabel, 196, 11, { align: 'right' })
    doc.save(`resumen-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.pdf`)
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-28" /><Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <SkeletonCard key={i}><Skeleton className="h-24 w-full" /></SkeletonCard>)}
      </div>
      <SkeletonCard><Skeleton className="h-32 w-full" /></SkeletonCard>
      <SkeletonCard><Skeleton className="h-20 w-full" /></SkeletonCard>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-slate-500 text-sm">No se pudo conectar al servidor.</p>
      <button
        onClick={() => {
          setLoading(true)
          api.get(`/api/insights/dashboard?year=${selectedYear}&month=${selectedMonth}`)
            .then(r => setData(r.data)).catch(() => setError(true)).finally(() => setLoading(false))
        }}
        className="px-4 py-2 rounded-xl text-sm font-semibold text-black transition-colors"
        style={{ background: '#34D399' }}
      >
        Reintentar
      </button>
    </div>
  )

  // ── Empty ─────────────────────────────────────────────────────────────────
  const isEmpty = !data?.totalExpenses && !data?.categoryBreakdown?.length
  const monthLabel = new Date(selectedYear, selectedMonth - 1, 1)
    .toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  if (isEmpty) return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-white">Dashboard</h1>
        <MonthNav
          monthLabel={monthLabel}
          onPrev={prevMonth}
          onNext={nextMonth}
          onExport={exportPDF}
        />
      </div>
      <div className="flex flex-col items-center justify-center h-80 gap-5">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.12)' }}
        >
          <CreditCard size={24} className="text-emerald-600" />
        </div>
        <div className="text-center">
          <h2 className="text-white font-semibold text-base">Sin datos este mes</h2>
          <p className="text-slate-500 text-sm mt-1">No hay movimientos para {monthLabel}</p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="flex items-center gap-2 font-semibold px-5 py-2.5 rounded-xl text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: '#34D399', color: '#000' }}
        >
          <Upload size={15} /> Cargar estado de cuenta
        </button>
      </div>
    </div>
  )

  // ── Derived data ──────────────────────────────────────────────────────────
  const totalExpenses = data?.totalExpenses  || 0
  const totalIncome   = data?.totalIncome    || 0
  const netBalance    = totalIncome - totalExpenses
  const ytd           = data?.yearTotals || { expenses: 0, income: 0, balance: 0 }
  const prevExpenses  = data?.prevTotalExpenses || 0
  const prevIncome    = data?.prevTotalIncome   || 0
  const dataMonth     = data?.dataMonth || ''
  const pagoTC        = data?.pagoTC || { total: 0, count: 0 }
  const pagoTCTxs     = data?.pagoTCTransactions || []
  const budgets       = data?.budgets || []
  const budgetMap     = Object.fromEntries(budgets.map(b => [b.category, b.monthly_limit]))

  const categoryData  = (data?.categoryBreakdown || []).filter(c => c.category !== 'Ingresos' && c.category !== 'Pago TC')
  const prevCatData   = (data?.prevCategoryBreakdown || []).filter(c => c.category !== 'Ingresos' && c.category !== 'Pago TC')
  const prevCatMap    = Object.fromEntries(prevCatData.map(c => [c.category, c.total]))
  const monthTotal    = categoryData.reduce((s, c) => s + c.total, 0)

  const inDeficit     = netBalance < 0
  const overSpendPct  = totalIncome > 0 ? ((totalExpenses - totalIncome) / totalIncome * 100) : null
  const savingsRate   = totalIncome > 0 ? ((netBalance / totalIncome) * 100) : null
  const topCategory   = categoryData[0]
  const topCatPct     = monthTotal > 0 && topCategory ? (topCategory.total / monthTotal * 100) : 0

  const projected     = projectEndOfMonth(totalExpenses, selectedYear, selectedMonth)
  const projBalance   = projected !== null ? totalIncome - projected : null
  const weeklyBudget  = totalIncome > 0 ? Math.round(totalIncome / 4.33) : null
  const savingFromCut = topCategory ? Math.round(topCategory.total * 0.20) : 0

  const categoryChanges = categoryData.map(c => ({
    ...c,
    prev: prevCatMap[c.category] || 0,
    change: pct(c.total, prevCatMap[c.category] || 0),
  })).filter(c => c.prev > 0 || c.total > 0)

  const expenseDelta  = pct(totalExpenses, prevExpenses)
  const incomeDelta   = pct(totalIncome, prevIncome)

  const alertCategories = categoryData.filter(c => {
    if (budgetMap[c.category] != null) return c.total > budgetMap[c.category]
    return monthTotal > 0 && (c.total / monthTotal) > 0.35
  })

  const accentGreen  = '#34D399'
  const accentRed    = '#F87171'
  const situationColor  = inDeficit ? accentRed : accentGreen
  const situationBg     = inDeficit ? 'rgba(248,113,113,0.05)' : 'rgba(52,211,153,0.05)'
  const situationBorder = inDeficit ? 'rgba(248,113,113,0.14)' : 'rgba(52,211,153,0.14)'

  return (
    <div className="animate-fade-up space-y-5">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">Resumen</h1>
          <p className="text-xs text-slate-600 mt-0.5 capitalize">{monthLabel}</p>
        </div>
        <MonthNav
          monthLabel={monthLabel}
          onPrev={prevMonth}
          onNext={nextMonth}
          onExport={exportPDF}
        />
      </div>

      {/* ── KPI BAR — 3 hero cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Gastos */}
        <button
          onClick={() => navigate(`/transactions?month=${dataMonth}`)}
          className="group rounded-2xl p-5 text-left transition-all hover:brightness-110 active:scale-[0.99]"
          style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Gastos</span>
            <ArrowUpRight size={13} style={{ color: accentRed }} className="opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-bold font-mono tracking-tight leading-none" style={{ color: accentRed }}>
            <AnimatedNumber value={totalExpenses} formatter={formatMXN} />
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            {expenseDelta !== null && <DeltaChip value={expenseDelta} invert />}
            <span className="text-xs text-slate-700">vs mes ant.</span>
          </div>
        </button>

        {/* Ingresos */}
        <button
          onClick={() => navigate(`/transactions?category=${encodeURIComponent('Ingresos')}&month=${dataMonth}`)}
          className="group rounded-2xl p-5 text-left transition-all hover:brightness-110 active:scale-[0.99]"
          style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ingresos</span>
            <ArrowDownLeft size={13} style={{ color: accentGreen }} className="opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-bold font-mono tracking-tight leading-none" style={{ color: accentGreen }}>
            <AnimatedNumber value={totalIncome} formatter={formatMXN} />
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            {incomeDelta !== null && <DeltaChip value={incomeDelta} />}
            <span className="text-xs text-slate-700">vs mes ant.</span>
          </div>
        </button>

        {/* Balance / Ahorro */}
        <button
          onClick={() => navigate(`/transactions?month=${dataMonth}`)}
          className="group rounded-2xl p-5 text-left transition-all hover:brightness-110 active:scale-[0.99]"
          style={{
            background: situationBg,
            border: `1px solid ${situationBorder}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {inDeficit ? 'Déficit' : 'Ahorro'}
            </span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: inDeficit ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.12)',
                color: situationColor,
              }}
            >
              {savingsRate !== null ? `${Math.abs(savingsRate).toFixed(0)}%` : '—'}
            </span>
          </div>
          <p
            className="text-3xl font-bold font-mono tracking-tight leading-none"
            style={{ color: situationColor }}
          >
            <AnimatedNumber
              value={Math.abs(netBalance)}
              formatter={v => (inDeficit ? '-' : '+') + formatMXN(v)}
            />
          </p>
          <div className="mt-2.5">
            <span className="text-xs text-slate-600">
              {inDeficit
                ? `${overSpendPct?.toFixed(0)}% más de lo que entra`
                : 'del ingreso mensual guardado'}
            </span>
          </div>
        </button>

      </div>

      {/* ── AI RECAP ───────────────────────────────────────────────────────── */}
      {(recap || aiLoading) && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}
        >
          {aiLoading && !recap
            ? <Loader2 size={12} className="text-indigo-500 animate-spin flex-shrink-0 mt-0.5" />
            : <Sparkles size={12} className="text-indigo-400 flex-shrink-0 mt-0.5" />
          }
          <p className="text-sm text-slate-300 leading-relaxed">
            {recap || <span className="text-slate-600 italic">Analizando tu mes...</span>}
          </p>
        </div>
      )}

      {/* ── SPENDING NUDGES ────────────────────────────────────────────────── */}
      {categoryChanges.filter(c => c.change !== null && Math.abs(c.change) >= 20 && c.total > 200).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categoryChanges
            .filter(c => c.change !== null && Math.abs(c.change) >= 20 && c.total > 200)
            .slice(0, 5)
            .map(c => {
              const up = c.change > 0
              return (
                <button
                  key={c.category}
                  onClick={() => navigate(`/transactions?category=${encodeURIComponent(c.category)}&month=${dataMonth}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:brightness-125 active:scale-95"
                  style={{
                    background: up ? 'rgba(248,113,113,0.07)' : 'rgba(52,211,153,0.07)',
                    border: `1px solid ${up ? 'rgba(248,113,113,0.18)' : 'rgba(52,211,153,0.18)'}`,
                    color: up ? accentRed : accentGreen,
                  }}
                >
                  {up ? '↑' : '↓'} {c.category} {Math.abs(c.change).toFixed(0)}%
                </button>
              )
            })}
        </div>
      )}

      {/* ── 2-COLUMN GRID ──────────────────────────────────────────────────── */}
      <div className="lg:grid lg:grid-cols-[3fr_2fr] lg:gap-5 lg:items-start space-y-5 lg:space-y-0">

        {/* ── LEFT: SITUACIÓN + DECISIÓN + ALERTAS + TENDENCIA ─────────────── */}
        <div className="space-y-4">

          {/* SITUACIÓN */}
          <Panel style={{ background: situationBg, border: `1px solid ${situationBorder}` }}>
            {/* Radial glow */}
            <div
              className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden"
              style={{
                background: inDeficit
                  ? 'radial-gradient(ellipse 70% 50% at 0% 50%, rgba(248,113,113,0.07) 0%, transparent 70%)'
                  : 'radial-gradient(ellipse 70% 50% at 0% 50%, rgba(52,211,153,0.07) 0%, transparent 70%)',
              }}
            />
            <div className="relative p-6">
              {/* Status pill */}
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-5"
                style={{
                  background: inDeficit ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.12)',
                  color: situationColor,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: situationColor }} />
                {inDeficit ? 'Déficit este mes' : 'Mes en positivo'}
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    className="text-5xl font-bold font-mono tracking-tight leading-none mb-3"
                    style={{ color: situationColor }}
                  >
                    <AnimatedNumber
                      value={Math.abs(netBalance)}
                      formatter={v => (inDeficit ? '-' : '+') + formatMXN(v)}
                    />
                  </p>

                  <div className="space-y-1.5">
                    {inDeficit && overSpendPct !== null && (
                      <p className="text-sm text-slate-400">
                        Gastas{' '}
                        <span className="font-semibold" style={{ color: accentRed }}>
                          {overSpendPct.toFixed(0)}% más
                        </span>{' '}
                        de lo que ingresa
                      </p>
                    )}
                    {!inDeficit && savingsRate !== null && (
                      <p className="text-sm text-slate-400">
                        Ahorraste{' '}
                        <span className="font-semibold" style={{ color: accentGreen }}>
                          {savingsRate.toFixed(0)}%
                        </span>{' '}
                        de tus ingresos
                      </p>
                    )}
                    {topCategory && (
                      <button
                        onClick={() => navigate(`/transactions?category=${encodeURIComponent(topCategory.category)}&month=${dataMonth}`)}
                        className="text-sm text-slate-500 text-left hover:text-white transition-colors group block mt-2"
                      >
                        Mayor gasto:{' '}
                        <span className="text-slate-300 font-medium group-hover:underline underline-offset-2">
                          {topCategory.category}
                        </span>
                        <span className="text-slate-600"> ({topCatPct.toFixed(0)}%) →</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* YTD */}
                <button
                  onClick={() => navigate(`/transactions?month=${selectedYear}-01&year=${selectedYear}`)}
                  className="flex-shrink-0 text-right hover:opacity-80 transition-opacity group"
                >
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5 group-hover:text-slate-400">
                    {selectedYear} acumulado →
                  </p>
                  <p
                    className="text-sm font-mono font-bold"
                    style={{ color: ytd.balance >= 0 ? accentGreen : accentRed }}
                  >
                    {ytd.balance >= 0 ? '+' : ''}{formatMXN(ytd.balance)}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 space-x-1">
                    <span style={{ color: accentRed }}>{formatMXN(ytd.expenses)}</span>
                    <span>/</span>
                    <span style={{ color: accentGreen }}>{formatMXN(ytd.income)}</span>
                  </p>
                </button>
              </div>
            </div>
          </Panel>

          {/* DECISIÓN */}
          {(weeklyBudget || projected !== null || aiSuggestions.length > 0 || aiLoading) && (
            <Panel className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {aiSuggestions.length > 0
                    ? <><Sparkles size={13} className="text-indigo-400" /><p className="text-sm font-semibold text-white">Qué puedes hacer</p><span className="text-[10px] text-indigo-500/70 ml-1 font-medium uppercase tracking-wider">IA</span></>
                    : <><Zap size={13} className="text-amber-400" /><p className="text-sm font-semibold text-white">Qué puedes hacer</p></>
                  }
                </div>
                {aiLoading && <Loader2 size={12} className="text-slate-700 animate-spin" />}
              </div>

              <div className="space-y-2.5">
                {aiSuggestions.length > 0 ? aiSuggestions.map((s, i) => {
                  const colorMap = {
                    amber:  { bg: 'rgba(251,191,36,0.05)',  border: 'rgba(251,191,36,0.11)',  arrow: '#F59E0B' },
                    green:  { bg: 'rgba(52,211,153,0.05)',  border: 'rgba(52,211,153,0.11)',  arrow: '#34D399' },
                    red:    { bg: 'rgba(248,113,113,0.05)', border: 'rgba(248,113,113,0.11)', arrow: '#F87171' },
                    indigo: { bg: 'rgba(99,102,241,0.05)',  border: 'rgba(99,102,241,0.11)',  arrow: '#818CF8' },
                  }
                  const colors = colorMap[s.color] || colorMap.amber
                  return (
                    <button
                      key={i}
                      onClick={() => s.category
                        ? navigate(`/transactions?category=${encodeURIComponent(s.category)}&month=${dataMonth}`)
                        : navigate(`/transactions?month=${dataMonth}`)
                      }
                      className="w-full flex items-start gap-3 rounded-xl px-4 py-3 text-left hover:brightness-125 transition-all active:scale-[0.98]"
                      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                    >
                      <span className="mt-0.5 flex-shrink-0 font-mono text-sm" style={{ color: colors.arrow }}>→</span>
                      <div>
                        <p className="text-sm text-slate-300">{s.action}</p>
                        {s.detail && <p className="text-xs text-slate-600 mt-0.5">{s.detail}</p>}
                      </div>
                    </button>
                  )
                }) : (
                  <>
                    {topCategory && savingFromCut > 0 && (
                      <button
                        onClick={() => navigate(`/transactions?category=${encodeURIComponent(topCategory.category)}&month=${dataMonth}`)}
                        className="w-full flex items-start gap-3 rounded-xl px-4 py-3 text-left hover:brightness-125 transition-all active:scale-[0.98]"
                        style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.11)' }}
                      >
                        <span className="text-amber-400 mt-0.5 flex-shrink-0 font-mono text-sm">→</span>
                        <div>
                          <p className="text-sm text-slate-300">
                            Reduce <span className="text-white font-medium">{topCategory.category}</span> un 20%{' '}
                            y ahorras{' '}
                            <span className="font-mono font-semibold" style={{ color: accentGreen }}>{formatMXN(savingFromCut)}</span>
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {categoryData.find(c => c.category === topCategory.category)?.count || ''} movimientos →
                          </p>
                        </div>
                      </button>
                    )}
                    {weeklyBudget && (
                      <button
                        onClick={() => navigate(`/transactions?month=${dataMonth}`)}
                        className="w-full flex items-start gap-3 rounded-xl px-4 py-3 text-left hover:brightness-125 transition-all active:scale-[0.98]"
                        style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.11)' }}
                      >
                        <span className="text-indigo-400 mt-0.5 flex-shrink-0 font-mono text-sm">→</span>
                        <div>
                          <p className="text-sm text-slate-300">
                            Límite semanal:{' '}
                            <span className="text-white font-mono font-semibold">{formatMXN(weeklyBudget)}</span>
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">{formatMXN(totalIncome)} ÷ 4.33 semanas</p>
                        </div>
                      </button>
                    )}
                    {projected !== null && (
                      <button
                        onClick={() => navigate(`/transactions?month=${dataMonth}`)}
                        className="w-full flex items-start gap-3 rounded-xl px-4 py-3 text-left hover:brightness-125 transition-all active:scale-[0.98]"
                        style={{
                          background: projBalance !== null && projBalance < 0 ? 'rgba(248,113,113,0.05)' : 'rgba(52,211,153,0.05)',
                          border: `1px solid ${projBalance !== null && projBalance < 0 ? 'rgba(248,113,113,0.11)' : 'rgba(52,211,153,0.11)'}`,
                        }}
                      >
                        <span
                          className="mt-0.5 flex-shrink-0 font-mono text-sm"
                          style={{ color: projBalance !== null && projBalance < 0 ? accentRed : accentGreen }}
                        >→</span>
                        <div>
                          <p className="text-sm text-slate-300">
                            Proyección fin de mes:{' '}
                            <span
                              className="font-mono font-semibold"
                              style={{ color: projBalance !== null && projBalance < 0 ? accentRed : accentGreen }}
                            >
                              {projBalance !== null ? (projBalance >= 0 ? '+' : '') + formatMXN(projBalance) : '...'}
                            </span>
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {formatMXN(totalExpenses)} / {new Date().getDate()} días
                          </p>
                        </div>
                      </button>
                    )}
                  </>
                )}
              </div>
            </Panel>
          )}

          {/* ALERTAS */}
          {alertCategories.map(cat => {
            const limit = budgetMap[cat.category]
            const catPct = monthTotal > 0 ? (cat.total / monthTotal * 100).toFixed(0) : 0
            const prevAmt = prevCatMap[cat.category]
            const prevTotal = prevCatData.reduce((s, c) => s + c.total, 0)
            const prevPct = prevAmt && prevTotal > 0 ? (prevAmt / prevTotal * 100).toFixed(0) : null
            return (
              <button
                key={cat.category}
                onClick={() => navigate(`/transactions?category=${encodeURIComponent(cat.category)}&month=${dataMonth}`)}
                className="w-full flex items-start gap-3 rounded-xl px-4 py-3.5 text-left hover:brightness-110 transition-all active:scale-[0.99]"
                style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}
              >
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#F87171' }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: '#FCA5A5' }}>
                    {cat.category} · {catPct}% del gasto total
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {limit != null
                      ? `Superaste tu límite — ${formatMXN(cat.total)} de ${formatMXN(limit)}`
                      : prevPct !== null
                        ? `Antes fue ${prevPct}% — subió ${Math.abs(Number(catPct) - Number(prevPct))} puntos`
                        : 'Categoría dominante del mes'
                    }
                  </p>
                </div>
                <span className="text-xs text-slate-600 flex-shrink-0 mt-0.5">ver →</span>
              </button>
            )
          })}

          {/* TENDENCIA */}
          <Panel className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white">Últimos 6 meses</p>
              {data?.trend?.length >= 2 && (() => {
                const t2 = data.trend
                const last  = t2[t2.length - 1]?.total || 0
                const prev2 = t2[t2.length - 2]?.total || 0
                const d = pct(last, prev2)
                const up = d > 0
                return d !== null ? (
                  <span className="text-xs font-medium" style={{ color: up ? accentRed : accentGreen }}>
                    {up ? '▲' : '▼'} {Math.abs(d).toFixed(0)}% vs mes anterior
                  </span>
                ) : null
              })()}
            </div>
            <TrendLine data={data?.trend || []} />
          </Panel>

        </div>{/* end LEFT */}

        {/* ── RIGHT: PATRÓN + DONUT + MERCHANTS + PAGO TC ──────────────────── */}
        <div className="space-y-4">

          {/* PATRÓN + DONUT */}
          <div className="grid grid-cols-2 gap-4">
            <Panel className="p-4">
              <p className="text-xs font-medium text-slate-400 mb-0.5">¿Dónde se fue?</p>
              <p className="text-[10px] text-slate-600 mb-3 uppercase tracking-wider">vs mes anterior</p>
              <div className="space-y-2.5">
                {categoryChanges.slice(0, 6).map(c => {
                  const barW = monthTotal > 0 ? (c.total / monthTotal * 100) : 0
                  const changeColor =
                    c.change === null ? '#64748B'
                    : c.change > 10   ? accentRed
                    : c.change < -10  ? accentGreen
                    : '#64748B'
                  return (
                    <div
                      key={c.category}
                      className="cursor-pointer group"
                      onClick={() => navigate(`/transactions?category=${encodeURIComponent(c.category)}&month=${dataMonth}`)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: CATEGORY_COLORS[c.category] || '#6B7280' }}
                        />
                        <span className="text-[11px] text-slate-500 flex-1 truncate group-hover:text-white transition-colors">
                          {c.category}
                        </span>
                        {c.change !== null && (
                          <span className="text-[10px] font-mono font-semibold flex-shrink-0" style={{ color: changeColor }}>
                            {c.change > 0 ? '↑' : '↓'}{Math.abs(c.change).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div className="h-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(barW, 100)}%`,
                            background: CATEGORY_COLORS[c.category] || '#6B7280',
                            opacity: 0.65,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>

            <Panel className="p-4">
              <p className="text-xs font-medium text-slate-400 mb-4">Distribución</p>
              <DonutChart
                data={categoryData}
                colors={CATEGORY_COLORS}
                onSliceClick={category => navigate(`/transactions?category=${encodeURIComponent(category)}&month=${dataMonth}`)}
              />
            </Panel>
          </div>

          {/* TOP MERCHANTS */}
          {data?.topMerchants?.length > 0 && (
            <Panel className="p-4">
              <p className="text-xs font-medium text-slate-400 mb-3">Top 5 comercios</p>
              <div className="space-y-2.5">
                {data.topMerchants.map((m, i) => {
                  const barW = (m.total / data.topMerchants[0].total) * 100
                  return (
                    <div key={m.description}>
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className="text-[10px] font-mono text-slate-700 w-3 flex-shrink-0">{i + 1}</span>
                        <p className="text-xs text-slate-400 flex-1 truncate">{m.description}</p>
                        <span className="text-xs font-mono font-medium text-slate-300 flex-shrink-0">
                          {formatMXN(m.total)}
                        </span>
                      </div>
                      <div className="ml-5 h-px rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${barW}%`,
                            background: i === 0 ? accentGreen : 'rgba(255,255,255,0.1)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}

          {/* PAGO TC */}
          {pagoTC.count > 0 && (
            <Panel className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard size={12} className="text-slate-600" />
                  <p className="text-xs font-medium text-slate-400">Pagos tarjeta · excluidos</p>
                </div>
                <p className="text-xs font-mono text-slate-500">{formatMXN(pagoTC.total)}</p>
              </div>
              <div className="space-y-0">
                {pagoTCTxs.map((tx, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  >
                    <span className="text-[10px] font-mono text-slate-700 w-16 flex-shrink-0">
                      {tx.date.split('-').reverse().join('/')}
                    </span>
                    <span className="text-xs text-slate-500 flex-1 truncate">{tx.description}</span>
                    <span className="text-xs font-mono text-slate-600 flex-shrink-0">{formatMXN(tx.amount)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

        </div>{/* end RIGHT */}
      </div>{/* end 2-col */}
    </div>
  )
}

// ── Month Nav component ───────────────────────────────────────────────────────

function MonthNav({ monthLabel, onPrev, onNext, onExport }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onPrev}
        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 transition-colors"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <ChevronLeft size={14} />
      </button>
      <span className="text-xs text-slate-400 capitalize min-w-[7rem] text-center font-medium">
        {monthLabel}
      </span>
      <button
        onClick={onNext}
        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 transition-colors"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <ChevronRight size={14} />
      </button>
      <button
        onClick={onExport}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-300 transition-all"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <FileDown size={12} /> PDF
      </button>
    </div>
  )
}
