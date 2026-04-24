import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Download, ChevronLeft, ChevronRight, Check, X, Plus, Calendar, Sparkles, Loader2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { Skeleton } from '../components/ui/Skeleton'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { formatMXN, formatDate, CATEGORIES } from '../utils/formatters'
import { useI18n } from '../contexts/I18nContext'
import api from '../utils/api'

const PAGE_SIZE = 50

const inputCls = 'w-full bg-[#0B0F14] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-colors'
const selectCls = 'bg-[#0B0F14] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/60 transition-colors'

export default function Transactions() {
  const { t } = useI18n()
  const toast = useToast()
  const [searchParams] = useSearchParams()

  const initialCategory = searchParams.get('category') || ''
  const initialMonth = searchParams.get('month') || '' // "YYYY-MM"

  // Parse initialMonth into year/month ints (or default to null = all)
  const initYear  = initialMonth ? parseInt(initialMonth.split('-')[0]) : null
  const initMonth = initialMonth ? parseInt(initialMonth.split('-')[1]) : null

  const [selYear,  setSelYear]  = useState(initYear)
  const [selMonth, setSelMonth] = useState(initMonth)

  // Derive dateFrom/dateTo from selYear+selMonth
  function monthToDates(y, m) {
    if (!y || !m) return { dateFrom: '', dateTo: '' }
    const from = `${y}-${String(m).padStart(2, '0')}-01`
    const to   = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
    return { dateFrom: from, dateTo: to }
  }

  const [filters, setFilters] = useState(() => {
    const { dateFrom, dateTo } = monthToDates(initYear, initMonth)
    return { search: '', bank: '', category: initialCategory, dateFrom, dateTo }
  })
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [data, setData] = useState({ transactions: [], total: 0, totals: { expenses: 0, income: 0, net: 0 } })
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ date: new Date().toISOString().slice(0, 10), description: '', amount: '', category: 'Otros', bank: 'Efectivo', notes: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [aiRecatLoading, setAiRecatLoading] = useState(false)
  const [aiRecatResult, setAiRecatResult] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        sortBy,
        sortDir,
        ...(filters.search && { search: filters.search }),
        ...(filters.bank && { bank: filters.bank }),
        ...(filters.category && { category: filters.category }),
        ...(filters.dateFrom && { startDate: filters.dateFrom }),
        ...(filters.dateTo && { endDate: filters.dateTo }),
      })
      const res = await api.get(`/api/transactions?${params}`)
      setData(res.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [filters, page, sortBy, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  function setFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val }))
    setPage(0)
  }

  function applyMonth(y, m) {
    setSelYear(y); setSelMonth(m)
    const { dateFrom, dateTo } = monthToDates(y, m)
    setFilters(f => ({ ...f, dateFrom, dateTo }))
    setPage(0)
  }

  function clearMonth() {
    setSelYear(null); setSelMonth(null)
    setFilters(f => ({ ...f, dateFrom: '', dateTo: '' }))
    setPage(0)
  }

  function prevMonth() {
    const y = selYear || new Date().getFullYear()
    const m = selMonth || new Date().getMonth() + 1
    if (m === 1) applyMonth(y - 1, 12)
    else applyMonth(y, m - 1)
  }

  function nextMonth() {
    const y = selYear || new Date().getFullYear()
    const m = selMonth || new Date().getMonth() + 1
    if (m === 12) applyMonth(y + 1, 1)
    else applyMonth(y, m + 1)
  }

  const monthLabel = selYear && selMonth
    ? new Date(selYear, selMonth - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    : null

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
    setPage(0)
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <span className="ml-1 opacity-20">↕</span>
    return <span className="ml-1 text-emerald-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function startEdit(tx) {
    setEditingId(tx.id)
    setEditValues({ category: tx.category, notes: tx.notes || '' })
  }

  async function handleAddManual(e) {
    e.preventDefault()
    setAddError('')
    if (!addForm.description.trim()) return setAddError('La descripción es requerida')
    if (!addForm.amount || isNaN(parseFloat(addForm.amount)) || parseFloat(addForm.amount) <= 0) return setAddError('Monto inválido')
    setAddSaving(true)
    try {
      await api.post('/api/transactions', { ...addForm, amount: parseFloat(addForm.amount) })
      setShowAddModal(false)
      setAddForm({ date: new Date().toISOString().slice(0, 10), description: '', amount: '', category: 'Otros', bank: 'Efectivo', notes: '' })
      fetchData()
      toast('Gasto agregado ✓')
    } catch (err) {
      setAddError(err.response?.data?.error || 'Error al guardar')
    } finally {
      setAddSaving(false)
    }
  }

  async function saveEdit(id, description) {
    try {
      await api.patch(`/api/transactions/${id}`, { ...editValues, _description: description })
      setEditingId(null)
      fetchData()
      toast('Categoría guardada ✓')
    } catch {
      toast('Error al guardar', 'error')
    }
  }

  async function exportCsv() {
    const params = new URLSearchParams({
      ...(filters.search && { search: filters.search }),
      ...(filters.bank && { bank: filters.bank }),
      ...(filters.category && { category: filters.category }),
      ...(filters.dateFrom && { startDate: filters.dateFrom }),
      ...(filters.dateTo && { endDate: filters.dateTo }),
    })
    const res = await api.get(`/api/transactions/export?${params}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `movimientos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function runAiRecat() {
    setAiRecatLoading(true)
    setAiRecatResult(null)
    try {
      const res = await api.post('/api/ai/recategorize-all')
      const { updated = 0, total = 0, message } = res.data
      setAiRecatResult(message || `${updated} de ${total} recategorizadas`)
      if (updated > 0) fetchData()
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al recategorizar'
      setAiRecatResult(`Error: ${msg}`)
    } finally {
      setAiRecatLoading(false)
    }
  }

  const totalPages = Math.ceil(data.total / PAGE_SIZE)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-white">{t('transactions.title')}</h1>
        <div className="flex items-center gap-2">

          {/* AI Recategorize */}
          <div className="flex items-center gap-2">
            <button
              onClick={runAiRecat}
              disabled={aiRecatLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.15)',
                color: '#A5B4FC',
              }}
              title="Recategoriza automáticamente las transacciones en 'Otros' usando IA"
            >
              {aiRecatLoading
                ? <Loader2 size={13} className="animate-spin" />
                : <Sparkles size={13} />
              }
              <span>{aiRecatLoading ? 'Analizando...' : 'Recategorizar IA'}</span>
            </button>
            {aiRecatResult && (
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{
                  background: aiRecatResult.startsWith('Error')
                    ? 'rgba(248,113,113,0.08)'
                    : 'rgba(52,211,153,0.08)',
                  border: `1px solid ${aiRecatResult.startsWith('Error') ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.15)'}`,
                  color: aiRecatResult.startsWith('Error') ? '#F87171' : '#34D399',
                }}
              >
                {aiRecatResult}
              </span>
            )}
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 font-semibold px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ background: '#34D399', color: '#000' }}
          >
            <Plus size={14} />
            Agregar
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white px-3 py-2 rounded-lg text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Download size={14} />
            {t('transactions.exportCsv')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card className="!p-4 space-y-3">
        {/* Month navigator */}
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-slate-600 flex-shrink-0" />
          <button onClick={prevMonth}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <ChevronLeft size={13} />
          </button>
          <span className="text-sm text-slate-300 capitalize min-w-36 text-center font-medium">
            {monthLabel || <span className="text-slate-600">Todos los meses</span>}
          </span>
          <button onClick={nextMonth}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <ChevronRight size={13} />
          </button>
          {monthLabel && (
            <button onClick={clearMonth}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:text-white transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <X size={11} /> Todos
            </button>
          )}
        </div>

        {/* Search / bank / category */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder={t('transactions.search')}
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>

          <select value={filters.bank} onChange={e => setFilter('bank', e.target.value)} className={selectCls}>
            <option value="">{t('transactions.allBanks')}</option>
            <option value="BBVA">BBVA</option>
            <option value="AMEX">AmEx</option>
            <option value="NU">Nu</option>
            <option value="Efectivo">Efectivo</option>
          </select>

          <select value={filters.category} onChange={e => setFilter('category', e.target.value)} className={selectCls}>
            <option value="">{t('transactions.allCategories')}</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
          </select>
        </div>
      </Card>

      {/* Totals bar */}
      {!loading && data.total > 0 && (() => {
        const { expenses = 0, income = 0, net = 0 } = data.totals || {}
        return (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl px-4 py-3 flex flex-col gap-0.5" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <span className="text-slate-500 text-xs">Gastos</span>
              <span className="text-red-400 text-lg font-bold font-mono">{formatMXN(expenses)}</span>
            </div>
            <div className="rounded-xl px-4 py-3 flex flex-col gap-0.5" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
              <span className="text-slate-500 text-xs">Ingresos</span>
              <span className="text-emerald-400 text-lg font-bold font-mono">{formatMXN(income)}</span>
            </div>
            <div className="rounded-xl px-4 py-3 flex flex-col gap-0.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-slate-500 text-xs">Balance</span>
              <span className="text-lg font-bold font-mono" style={{ color: net <= 0 ? '#22c55e' : '#ef4444' }}>{formatMXN(Math.abs(net))}{net <= 0 ? ' ↑' : ' ↓'}</span>
            </div>
          </div>
        )
      })()}

      {/* Table */}
      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-slate-500 text-xs">{t('transactions.total', { count: data.total })}</p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-md text-slate-500 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-slate-500 text-xs px-2 font-mono">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-md text-slate-500 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-28" />       {/* Fecha */}
              <col />                         {/* Descripción — fills remaining */}
              <col className="w-32" />       {/* Monto */}
              <col className="w-20" />       {/* Banco */}
              <col className="w-36" />       {/* Categoría */}
              <col className="w-36" />       {/* Notas */}
              <col className="w-16" />       {/* Acciones */}
            </colgroup>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs cursor-pointer hover:text-slate-200 select-none transition-colors" onClick={() => toggleSort('date')}>
                  {t('transactions.date')}<SortIcon col="date" />
                </th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs cursor-pointer hover:text-slate-200 select-none transition-colors" onClick={() => toggleSort('description')}>
                  {t('transactions.description')}<SortIcon col="description" />
                </th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs cursor-pointer hover:text-slate-200 select-none transition-colors" onClick={() => toggleSort('amount')}>
                  {t('transactions.amount')}<SortIcon col="amount" />
                </th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs cursor-pointer hover:text-slate-200 select-none transition-colors" onClick={() => toggleSort('bank')}>
                  {t('transactions.bank')}<SortIcon col="bank" />
                </th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs cursor-pointer hover:text-slate-200 select-none transition-colors" onClick={() => toggleSort('category')}>
                  {t('transactions.category')}<SortIcon col="category" />
                </th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs">{t('transactions.notes')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody style={{ borderTop: 'none' }}>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="px-4 py-3"><Skeleton className="h-3.5 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3.5 w-48" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3.5 w-20 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-12 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3.5 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3.5 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3.5 w-8" /></td>
                  </tr>
                ))
              ) : data.transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-600 text-sm">{t('transactions.noResults')}</td>
                </tr>
              ) : data.transactions.map((tx, idx) => (
                <tr
                  key={tx.id}
                  className="group transition-colors"
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="px-4 py-3 text-white text-sm overflow-hidden">
                    <span className="truncate block" title={tx.description}>{tx.description}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    <span className={tx.amount < 0 ? 'text-emerald-400' : 'text-slate-200'}>{formatMXN(tx.amount)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={tx.bank === 'BBVA' ? 'bbva' : tx.bank === 'AMEX' ? 'amex' : 'gray'}>{tx.bank}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === tx.id ? (
                      <select
                        value={editValues.category}
                        onChange={e => setEditValues(v => ({ ...v, category: e.target.value }))}
                        className="bg-[#0B0F14] border border-emerald-500/60 rounded px-2 py-1 text-white text-xs focus:outline-none"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
                      </select>
                    ) : (
                      <span className="text-slate-400 text-xs">{t(`category.${tx.category}`)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === tx.id ? (
                      <input
                        type="text"
                        value={editValues.notes}
                        onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))}
                        placeholder="Nota..."
                        className="bg-[#0B0F14] border border-emerald-500/60 rounded px-2 py-1 text-white text-xs focus:outline-none w-full"
                      />
                    ) : (
                      <span className="text-slate-600 text-xs truncate block max-w-24" title={tx.notes}>{tx.notes || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === tx.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => saveEdit(tx.id, tx.description)} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"><Check size={13} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-slate-600 hover:text-white transition-colors"><X size={13} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(tx)}
                        className="text-slate-700 hover:text-slate-300 text-xs transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add manual transaction modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div
            className="relative rounded-2xl p-6 w-full max-w-md shadow-2xl"
            style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-base">Agregar gasto manual</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-600 hover:text-white transition-colors">
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleAddManual} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 text-xs mb-1.5 block">Fecha</label>
                  <input type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} required className={inputCls} />
                </div>
                <div>
                  <label className="text-slate-500 text-xs mb-1.5 block">Monto (MXN)</label>
                  <input type="number" min="0.01" step="0.01" placeholder="0.00" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} required className={inputCls} />
                </div>
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-1.5 block">Descripción</label>
                <input type="text" placeholder="Ej. Mercado, Gasolina..." value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} required className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 text-xs mb-1.5 block">Categoría</label>
                  <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} className={`${selectCls} w-full`}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 text-xs mb-1.5 block">Origen</label>
                  <select value={addForm.bank} onChange={e => setAddForm(f => ({ ...f, bank: e.target.value }))} className={`${selectCls} w-full`}>
                    <option value="Efectivo">Efectivo</option>
                    <option value="BBVA">BBVA</option>
                    <option value="AMEX">AmEx</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-1.5 block">Nota (opcional)</label>
                <input type="text" placeholder="Ej. Compra en el mercado" value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} />
              </div>

              {addError && <p className="text-red-400 text-xs">{addError}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={addSaving}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-[#0B0F14] font-semibold py-2.5 rounded-lg text-sm transition-colors"
                >
                  {addSaving ? 'Guardando...' : 'Guardar gasto'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 text-slate-400 hover:text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
