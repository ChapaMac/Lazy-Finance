import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, Zap, CreditCard, Calendar, Target, Pencil, Check, X } from 'lucide-react'
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton'
import Card from '../components/ui/Card'
import DonutChart from '../components/charts/DonutChart'
import BarComparison from '../components/charts/BarComparison'
import HeatmapCalendar from '../components/charts/HeatmapCalendar'
import { formatMXN, formatMonthLong, CATEGORY_COLORS } from '../utils/formatters'
import { useI18n } from '../contexts/I18nContext'
import api from '../utils/api'

const TABS = ['overview', 'trends', 'behavior']
const TAB_LABELS = { overview: 'Resumen', trends: 'Tendencias', behavior: 'Comportamiento' }

const inputCls = 'w-full bg-[#0B0F14] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/60 transition-colors'

export default function Insights() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [budgets, setBudgets] = useState([])
  const [editingBudget, setEditingBudget] = useState(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [data, setData] = useState(null)
  const [behavior, setBehavior] = useState(null)
  const [loading, setLoading] = useState(true)
  const [behaviorLoading, setBehaviorLoading] = useState(true)
  const [dataError, setDataError] = useState(false)
  const [behaviorError, setBehaviorError] = useState(false)

  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    api.get('/api/budgets').then(res => setBudgets(res.data)).catch(() => {})
  }, [])

  const budgetMap = Object.fromEntries(budgets.map(b => [b.category, b.monthly_limit]))

  async function saveBudget(category) {
    const val = parseFloat(budgetInput)
    if (isNaN(val) || val <= 0) { setEditingBudget(null); return }
    await api.put(`/api/budgets/${encodeURIComponent(category)}`, { monthly_limit: val })
    setBudgets(prev => {
      const existing = prev.find(b => b.category === category)
      if (existing) return prev.map(b => b.category === category ? { ...b, monthly_limit: val } : b)
      return [...prev, { category, monthly_limit: val }]
    })
    setEditingBudget(null)
  }

  async function removeBudget(category) {
    await api.delete(`/api/budgets/${encodeURIComponent(category)}`)
    setBudgets(prev => prev.filter(b => b.category !== category))
  }

  useEffect(() => {
    api.get('/api/insights/latestMonth').then(res => {
      if (res.data.month) {
        const [y, m] = res.data.month.split('-').map(Number)
        setSelectedYear(y)
        setSelectedMonth(m)
      }
      setInitialized(true)
    }).catch(() => setInitialized(true))

    api.get('/api/insights/behavior')
      .then(res => { setBehavior(res.data); setBehaviorError(false) })
      .catch(() => setBehaviorError(true))
      .finally(() => setBehaviorLoading(false))
  }, [])

  useEffect(() => {
    if (!initialized) return
    setLoading(true)
    setDataError(false)
    api.get(`/api/insights/monthly?year=${selectedYear}&month=${selectedMonth}`)
      .then(res => { setData(res.data); setDataError(false) })
      .catch(() => setDataError(true))
      .finally(() => setLoading(false))
  }, [selectedYear, selectedMonth, initialized])

  function retryMonthly() {
    setLoading(true); setDataError(false)
    api.get(`/api/insights/monthly?year=${selectedYear}&month=${selectedMonth}`)
      .then(res => { setData(res.data); setDataError(false) })
      .catch(() => setDataError(true))
      .finally(() => setLoading(false))
  }

  function retryBehavior() {
    setBehaviorLoading(true); setBehaviorError(false)
    api.get('/api/insights/behavior')
      .then(res => { setBehavior(res.data); setBehaviorError(false) })
      .catch(() => setBehaviorError(true))
      .finally(() => setBehaviorLoading(false))
  }

  function prevMonth() {
    if (selectedMonth === 1) { setSelectedYear(y => y - 1); setSelectedMonth(12) }
    else setSelectedMonth(m => m - 1)
  }
  function nextMonth() {
    if (selectedMonth === 12) { setSelectedYear(y => y + 1); setSelectedMonth(1) }
    else setSelectedMonth(m => m + 1)
  }

  const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
  const prevMonthDate = new Date(selectedYear, selectedMonth - 2, 1)
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`
  const currentCats = (data?.categoryBreakdown || []).filter(c => c.category !== 'Ingresos')
  const prevCats = data?.prevCategoryBreakdown || []
  const dailyData = data?.dailySpend || []
  const biggestDay = dailyData.reduce((max, d) => (!max || d.total > max.total) ? d : max, null)

  const navBtnCls = 'p-1.5 rounded-lg text-slate-500 hover:text-white transition-all'
  const navBtnStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }

  const retryBtnCls = 'px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0B0F14] font-semibold rounded-lg text-sm transition-colors'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('insights.title')}</h1>

        {tab !== 'behavior' && (
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className={navBtnCls} style={navBtnStyle}>
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none"><path d="M15 18l-6-6 6-6" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
            <span className="text-white font-medium text-sm min-w-36 text-center capitalize">
              {new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={nextMonth} className={navBtnCls} style={navBtnStyle}>
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none"><path d="M9 18l6-6-6-6" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 rounded-xl p-1 w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map(tabKey => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === tabKey
                ? 'bg-emerald-500 text-[#0B0F14]'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            {TAB_LABELS[tabKey]}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        loading ? (
          <div className="space-y-6">
            <SkeletonCard>
              <Skeleton className="h-4 w-32 mb-4" />
              {[0,1,2].map(i => <Skeleton key={i} className="h-7 w-full mb-2" />)}
            </SkeletonCard>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SkeletonCard><Skeleton className="h-4 w-36 mb-4" /><Skeleton className="h-52 w-full" /></SkeletonCard>
              <SkeletonCard><Skeleton className="h-4 w-32 mb-4" /><Skeleton className="h-52 w-full" /></SkeletonCard>
            </div>
          </div>
        ) :
        dataError ? (
          <div className="text-center py-24 space-y-3">
            <p className="text-slate-500">No se pudo cargar la información.</p>
            <button onClick={retryMonthly} className={retryBtnCls}>Reintentar</button>
          </div>
        ) : (
          <div className="space-y-6">
            {currentCats.length > 0 && (
              <Card>
                <h2 className="text-sm font-semibold text-white mb-4">{t('insights.summary')}</h2>
                {biggestDay && (
                  <div className="mb-4 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-slate-400 text-sm">
                      {t('insights.biggestDay', { day: parseInt(biggestDay.date.split('-')[2]), amount: formatMXN(biggestDay.total) })}
                    </p>
                  </div>
                )}
                <div className="space-y-2.5">
                  {currentCats.slice(0, 5).map(cat => {
                    const prev = prevCats.find(p => p.category === cat.category)
                    const diff = prev ? cat.total - prev.total : null
                    return (
                      <div key={cat.category} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[cat.category] || '#6B7280' }} />
                        <p className="text-slate-300 text-sm flex-1">
                          {t('insights.spentOn', { amount: formatMXN(cat.total), category: t(`category.${cat.category}`) })}
                        </p>
                        {diff !== null && (
                          <div className={`flex items-center gap-1 text-xs font-medium ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {diff > 0 ? <TrendingUp size={11} /> : diff < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                            {diff === 0 ? t('insights.vsLastMonth.same')
                              : diff > 0 ? t('insights.vsLastMonth.more', { amount: formatMXN(Math.abs(diff)) })
                              : t('insights.vsLastMonth.less', { amount: formatMXN(Math.abs(diff)) })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h2 className="text-sm font-semibold text-white mb-4">{t('insights.categoryShare')}</h2>
                <DonutChart
                  data={currentCats}
                  colors={CATEGORY_COLORS}
                  onSliceClick={(category) => navigate(`/transactions?category=${encodeURIComponent(category)}&month=${monthStr}`)}
                />
              </Card>
              <Card>
                <h2 className="text-sm font-semibold text-white mb-4">{t('insights.dailyHeatmap')}</h2>
                {dailyData.length > 0
                  ? <HeatmapCalendar data={dailyData} year={selectedYear} month={selectedMonth} />
                  : <p className="text-center text-slate-600 text-sm py-8">{t('insights.noData')}</p>
                }
              </Card>
            </div>

            {/* Budget editor */}
            {currentCats.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Target size={15} className="text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white">Presupuestos mensuales</h2>
                </div>
                <div className="space-y-1">
                  {currentCats.map(cat => {
                    const limit = budgetMap[cat.category]
                    const pct = limit ? Math.min((cat.total / limit) * 100, 100) : null
                    const over = limit && cat.total > limit
                    return (
                      <div key={cat.category} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[cat.category] || '#6B7280' }} />
                        <span className="text-slate-300 text-sm flex-1">{t(`category.${cat.category}`)}</span>

                        {editingBudget === cat.category ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600 text-xs">$</span>
                            <input
                              type="number"
                              min="1"
                              autoFocus
                              value={budgetInput}
                              onChange={e => setBudgetInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveBudget(cat.category); if (e.key === 'Escape') setEditingBudget(null) }}
                              className="w-24 bg-[#0B0F14] border border-emerald-500/60 rounded px-2 py-1 text-white text-xs focus:outline-none"
                            />
                            <button onClick={() => saveBudget(cat.category)} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"><Check size={13} /></button>
                            <button onClick={() => setEditingBudget(null)} className="p-1 text-slate-600 hover:text-white transition-colors"><X size={13} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            {limit ? (
                              <>
                                <div className="w-20 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                  <div className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className={`text-xs font-mono ${over ? 'text-red-400' : 'text-slate-500'}`}>{formatMXN(cat.total)} / {formatMXN(limit)}</span>
                                <button onClick={() => removeBudget(cat.category)} className="p-1 text-slate-700 hover:text-red-400 transition-colors"><X size={11} /></button>
                              </>
                            ) : (
                              <span className="text-slate-700 text-xs">Sin límite</span>
                            )}
                            <button
                              onClick={() => { setEditingBudget(cat.category); setBudgetInput(limit ? String(limit) : '') }}
                              className="p-1 text-slate-700 hover:text-slate-300 transition-colors"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className="text-slate-700 text-xs mt-3">Haz clic en ✏ para fijar un límite mensual. Las alertas del Dashboard se activan al superarlo.</p>
              </Card>
            )}
          </div>
        )
      )}

      {/* ── TRENDS TAB ── */}
      {tab === 'trends' && (
        loading ? (
          <SkeletonCard><Skeleton className="h-4 w-40 mb-4" /><Skeleton className="h-64 w-full" /></SkeletonCard>
        ) :
        dataError ? (
          <div className="text-center py-24 space-y-3">
            <p className="text-slate-500">No se pudo cargar la información.</p>
            <button onClick={retryMonthly} className={retryBtnCls}>Reintentar</button>
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <h2 className="text-sm font-semibold text-white mb-4">{t('insights.monthComparison')}</h2>
              <BarComparison data={data?.monthlyByCategory || []} months={[prevMonthStr, monthStr]} />
            </Card>
          </div>
        )
      )}

      {/* ── BEHAVIOR TAB ── */}
      {tab === 'behavior' && (
        behaviorLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0,1,2].map(i => <SkeletonCard key={i}><Skeleton className="h-3 w-24 mb-3" /><Skeleton className="h-7 w-28" /></SkeletonCard>)}
            </div>
            <SkeletonCard><Skeleton className="h-4 w-40 mb-4" />{[0,1,2].map(i => <Skeleton key={i} className="h-10 w-full mb-2" />)}</SkeletonCard>
          </div>
        ) :
        behaviorError ? (
          <div className="text-center py-24 space-y-3">
            <p className="text-slate-500">No se pudo cargar el análisis.</p>
            <button onClick={retryBehavior} className={retryBtnCls}>Reintentar</button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Burn rate + cashflow */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={13} className="text-amber-400" />
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Burn Rate</p>
                </div>
                <p className="text-2xl font-bold text-white font-mono">{formatMXN(behavior?.burnRate || 0)}</p>
                <p className="text-slate-600 text-xs mt-1">Promedio mensual (6 meses)</p>
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw size={13} className="text-purple-400" />
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Suscripciones</p>
                </div>
                <p className="text-2xl font-bold text-white font-mono">{formatMXN(behavior?.subscriptionTotal || 0)}</p>
                <p className="text-slate-600 text-xs mt-1">{behavior?.subscriptions?.length || 0} servicios detectados</p>
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-2">
                  {(behavior?.cashflowRatio || 0) <= 80
                    ? <TrendingUp size={13} className="text-emerald-400" />
                    : <TrendingDown size={13} className="text-red-400" />
                  }
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Gasto / Ingreso</p>
                </div>
                <p className={`text-2xl font-bold font-mono ${(behavior?.cashflowRatio || 0) <= 80 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {behavior?.cashflowRatio != null ? `${behavior.cashflowRatio}%` : '—'}
                </p>
                <p className="text-slate-600 text-xs mt-1">Del ingreso mensual usado en gastos</p>
              </Card>
            </div>

            {/* Fixed vs Variable */}
            {behavior?.fixedVariable && (
              <Card>
                <h2 className="text-sm font-semibold text-white mb-4">Gastos fijos vs variables</h2>
                <div className="flex gap-3 mb-4">
                  <div className="flex-1 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-slate-500 text-xs mb-1">Fijos</p>
                    <p className="text-white font-bold font-mono text-lg">{formatMXN(behavior.fixedVariable.fixed)}</p>
                    <p className="text-slate-600 text-xs">{behavior.fixedVariable.fixedPct}% del gasto</p>
                  </div>
                  <div className="flex-1 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-slate-500 text-xs mb-1">Variables</p>
                    <p className="text-white font-bold font-mono text-lg">{formatMXN(behavior.fixedVariable.variable)}</p>
                    <p className="text-slate-600 text-xs">{behavior.fixedVariable.variablePct}% del gasto</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${behavior.fixedVariable.fixedPct}%` }} />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-emerald-400 text-xs">Fijos</span>
                  <span className="text-slate-600 text-xs">Variables</span>
                </div>
              </Card>
            )}

            {/* Subscriptions */}
            {behavior?.subscriptions?.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <RefreshCw size={15} className="text-purple-400" />
                  <h2 className="text-sm font-semibold text-white">Suscripciones detectadas</h2>
                </div>
                <div className="space-y-1">
                  {behavior.subscriptions.map((sub, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.15)' }}>
                        <RefreshCw size={13} className="text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{sub.merchant}</p>
                        <p className="text-slate-600 text-xs">{sub.months} meses · {t(`category.${sub.category}`)}</p>
                      </div>
                      <span className="text-white font-mono font-semibold text-sm flex-shrink-0">
                        {formatMXN(sub.amount)}<span className="text-slate-600 text-xs font-normal">/mes</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Anomalies */}
            {behavior?.anomalies?.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={15} className="text-amber-400" />
                  <h2 className="text-sm font-semibold text-white">Gastos inusuales</h2>
                </div>
                <div className="space-y-1">
                  {behavior.anomalies.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: CATEGORY_COLORS[a.category] || '#6B7280' }} />
                      <div className="flex-1">
                        <p className="text-white text-sm">
                          <span className="font-medium">{t(`category.${a.category}`)}</span>
                          <span className="text-slate-500"> en {new Date(a.month + '-02').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</span>
                        </p>
                        <p className="text-slate-600 text-xs">Promedio: {formatMXN(a.avg)} · Este mes: {formatMXN(a.amount)}</p>
                      </div>
                      <span className="text-amber-400 font-mono font-semibold text-sm flex-shrink-0">+{a.pctAbove}%</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Category dependency */}
            {behavior?.categoryDependency?.length > 0 && behavior?.cashflowRatio != null && (
              <Card>
                <h2 className="text-sm font-semibold text-white mb-4">% del ingreso por categoría</h2>
                <div className="space-y-3">
                  {behavior.categoryDependency.slice(0, 6).map(c => (
                    <div key={c.category}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-slate-400 text-xs">{t(`category.${c.category}`)}</span>
                        <span className="text-slate-500 text-xs font-mono">{formatMXN(c.amount)} · {c.pctOfIncome}%</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(c.pctOfIncome, 100)}%`, background: CATEGORY_COLORS[c.category] || '#6B7280' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Payment habits */}
            {behavior?.paymentHabits && (
              <>
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar size={15} className="text-blue-400" />
                    <h2 className="text-sm font-semibold text-white">Patrón semanal de gasto</h2>
                  </div>
                  {behavior.paymentHabits.peakDay && (
                    <p className="text-slate-500 text-xs mb-4">
                      Gastas más los <span className="text-slate-300 font-medium">{behavior.paymentHabits.peakDay}</span>
                      {behavior.paymentHabits.quietDay && <> y menos los <span className="text-slate-300 font-medium">{behavior.paymentHabits.quietDay}</span></>}
                    </p>
                  )}
                  <div className="space-y-2">
                    {(() => {
                      const maxTotal = Math.max(...behavior.paymentHabits.weeklyPattern.map(d => d.total))
                      return behavior.paymentHabits.weeklyPattern.map(d => (
                        <div key={d.day} className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-8 flex-shrink-0">{d.day}</span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: maxTotal > 0 ? `${(d.total / maxTotal) * 100}%` : '0%' }} />
                          </div>
                          <span className="text-slate-500 text-xs font-mono w-24 text-right flex-shrink-0">
                            {d.total > 0 ? formatMXN(d.total) : '—'}
                          </span>
                        </div>
                      ))
                    })()}
                  </div>
                </Card>

                <Card>
                  <h2 className="text-sm font-semibold text-white mb-4">¿Cuándo gastas en el mes?</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {behavior.paymentHabits.monthPeriods.map(p => (
                      <div key={p.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-slate-500 text-xs mb-1">{p.label}</p>
                        <p className="text-white font-bold font-mono text-sm">{formatMXN(p.total)}</p>
                        <p className={`text-xs font-medium mt-1 ${p.pct > 40 ? 'text-amber-400' : 'text-slate-600'}`}>{p.pct}%</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {behavior.paymentHabits.ccCount > 0 && (
                  <Card>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <CreditCard size={15} className="text-slate-500" />
                        <h2 className="text-sm font-semibold text-white">Pagos a tarjeta de crédito</h2>
                      </div>
                      <span className="text-xs text-slate-600">{behavior.paymentHabits.ccCount} pago{behavior.paymentHabits.ccCount !== 1 ? 's' : ''} · prom. {formatMXN(behavior.paymentHabits.ccAvg)}</span>
                    </div>
                    <div className="space-y-1">
                      {behavior.paymentHabits.ccPayments.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <span className="text-slate-500 text-xs font-mono">{p.date.split('-').reverse().join('/')}</span>
                          <span className="text-slate-400 text-xs flex-1 px-3 truncate">{p.description}</span>
                          <span className="text-white font-mono text-sm font-semibold flex-shrink-0">{formatMXN(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-slate-700 text-xs mt-3">Estos pagos no se cuentan en tus gastos — son transferencias internas a tu tarjeta.</p>
                  </Card>
                )}
              </>
            )}

            {!behavior?.subscriptions?.length && !behavior?.anomalies?.length && !behavior?.paymentHabits?.ccCount && (
              <p className="text-center text-slate-600 text-sm py-12">{t('insights.noData')}</p>
            )}
          </div>
        )
      )}
    </div>
  )
}
