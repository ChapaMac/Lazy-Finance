import { useState, useEffect } from 'react'
import { Users, Activity, Trash2, CalendarX, AlertTriangle, Sparkles, Loader2 } from 'lucide-react'
import Card from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import api from '../utils/api'

function stat(label, value, sub) {
  return (
    <div className="rounded-xl px-4 py-3.5 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="text-white text-xl font-bold font-mono">{value}</span>
      {sub && <span className="text-slate-600 text-xs">{sub}</span>}
    </div>
  )
}

export default function Admin() {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  // months state
  const [months, setMonths]       = useState([])
  const [loadingMonths, setLoadingMonths] = useState(false)
  const [clearingMonth, setClearingMonth] = useState(null)
  const [clearedResult, setClearedResult] = useState({}) // { 'YYYY-MM': count }

  // wipe all state
  const [wiping, setWiping]       = useState(false)
  const [wipeResult, setWipeResult] = useState(null)
  const [wipeConfirm, setWipeConfirm] = useState(false)

  // AI recategorize state
  const [aiRecatLoading, setAiRecatLoading] = useState(false)
  const [aiRecatResult, setAiRecatResult]   = useState(null)

  const loadData = () => {
    setLoading(true)
    api.get('/api/admin/users')
      .then(res => setData(res.data))
      .catch(() => setError('Sin acceso o error al cargar.'))
      .finally(() => setLoading(false))
  }

  const loadMonths = () => {
    setLoadingMonths(true)
    api.get('/api/admin/months')
      .then(res => setMonths(res.data.months || []))
      .finally(() => setLoadingMonths(false))
  }

  useEffect(() => {
    loadData()
    loadMonths()
  }, [])

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-red-400 text-sm">{error}</p>
    </div>
  )

  async function clearMonth(ym) {
    if (!confirm(`¿Borrar TODAS las transacciones de ${ym}?`)) return
    setClearingMonth(ym)
    try {
      const res = await api.delete('/api/admin/clear-month', { data: { month: ym } })
      setClearedResult(prev => ({ ...prev, [ym]: res.data.deleted }))
      setMonths(prev => prev.filter(m => m.ym !== ym))
      loadData() // refresh stats
    } catch {
      alert('Error al borrar el mes')
    } finally {
      setClearingMonth(null)
    }
  }

  async function wipeAll() {
    setWiping(true)
    try {
      const res = await api.delete('/api/admin/wipe-all')
      setWipeResult(res.data.deleted)
      setMonths([])
      setWipeConfirm(false)
      loadData()
    } catch {
      alert('Error al borrar')
    } finally {
      setWiping(false)
    }
  }

  async function aiRecategorize() {
    if (!confirm('¿Re-categorizar todas las transacciones en "Otros" con IA? Esto puede tardar unos segundos.')) return
    setAiRecatLoading(true)
    setAiRecatResult(null)
    try {
      const res = await api.post('/api/ai/recategorize-all')
      setAiRecatResult(res.data)
      loadData()
      loadMonths()
    } catch {
      alert('Error al re-categorizar')
    } finally {
      setAiRecatLoading(false)
    }
  }

  const users = data?.users || []
  const totalTx = users.reduce((s, u) => s + u.transaction_count, 0)
  const activeUsers = users.filter(u => u.transaction_count > 0).length

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
          <Activity size={15} className="text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Admin</h1>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {loading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            {stat('Usuarios registrados', users.length)}
            {stat('Con movimientos', activeUsers, `${users.length - activeUsers} sin actividad`)}
            {stat('Total movimientos', totalTx.toLocaleString())}
          </>
        )}
      </div>

      {/* ── Clear by month ──────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <CalendarX size={14} className="text-amber-400" />
          <p className="text-white text-sm font-medium">Borrar por mes</p>
          <span className="text-slate-600 text-xs">— selecciona el mes que quieres eliminar</span>
        </div>

        {loadingMonths ? (
          <div className="flex flex-wrap gap-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-lg" />)}
          </div>
        ) : months.length === 0 ? (
          <p className="text-slate-600 text-sm">No hay transacciones guardadas.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {months.map(m => {
              const done = clearedResult[m.ym] !== undefined
              const clearing = clearingMonth === m.ym
              return (
                <button
                  key={m.ym}
                  onClick={() => !done && clearMonth(m.ym)}
                  disabled={clearing || done}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all disabled:cursor-not-allowed"
                  style={{
                    background: done
                      ? 'rgba(34,197,94,0.08)'
                      : 'rgba(251,191,36,0.08)',
                    border: `1px solid ${done ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.2)'}`,
                    color: done ? '#4ade80' : '#fbbf24',
                    opacity: clearing ? 0.5 : 1,
                  }}
                >
                  {done
                    ? `${m.ym} ✓ ${clearedResult[m.ym]} borradas`
                    : clearing
                    ? `${m.ym}...`
                    : <><Trash2 size={10} />{m.ym} <span style={{ color: 'rgba(255,255,255,0.25)' }}>({m.count})</span></>
                  }
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── AI Re-categorize ────────────────────────────────────────────── */}
      <div className="rounded-xl px-4 py-4 space-y-3" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-indigo-400" />
          <p className="text-white text-sm font-medium">Re-categorizar con IA</p>
          <span className="text-slate-600 text-xs">— clasifica todas las transacciones en "Otros" usando Claude</span>
        </div>
        {aiRecatResult ? (
          <p className="text-emerald-400 text-sm font-mono">
            {aiRecatResult.updated} de {aiRecatResult.total} transacciones re-categorizadas ✓
          </p>
        ) : (
          <button
            onClick={aiRecategorize}
            disabled={aiRecatLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-300 transition-all disabled:opacity-50"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}
          >
            {aiRecatLoading
              ? <><Loader2 size={13} className="animate-spin" /> Procesando...</>
              : <><Sparkles size={13} /> Re-categorizar Otros con IA</>
            }
          </button>
        )}
      </div>

      {/* ── Wipe ALL ────────────────────────────────────────────────────── */}
      <div className="rounded-xl px-4 py-4 space-y-3" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-400" />
          <p className="text-white text-sm font-medium">Borrar todo</p>
          <span className="text-slate-600 text-xs">— elimina TODAS las transacciones de todos los usuarios</span>
        </div>

        {wipeResult !== null ? (
          <p className="text-emerald-400 text-sm font-mono">{wipeResult} transacciones eliminadas ✓ — sube los estados de cuenta de nuevo.</p>
        ) : !wipeConfirm ? (
          <button
            onClick={() => setWipeConfirm(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 transition-all"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            Borrar todo ahora
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-red-300 text-sm">¿Seguro? Esto no se puede deshacer.</p>
            <button
              onClick={wipeAll}
              disabled={wiping}
              className="px-3 py-1.5 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.5)', border: '1px solid rgba(239,68,68,0.6)' }}
            >
              {wiping ? 'Borrando...' : 'Sí, borrar todo'}
            </button>
            <button
              onClick={() => setWipeConfirm(false)}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-400"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Users table */}
      <Card className="!p-0 overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
            <Users size={14} className="text-slate-600" />
            Usuarios
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs">ID</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs">Usuario</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs">Registro</th>
                <th className="text-right px-5 py-3 text-slate-500 font-medium text-xs">Movimientos</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs">Último upload</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs">Rango de fechas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {[...Array(6)].map((_, j) => <td key={j} className="px-5 py-3"><Skeleton className="h-3.5 w-24" /></td>)}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-600 text-sm">Sin usuarios</td></tr>
              ) : users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td className="px-5 py-3 text-slate-600 text-xs font-mono">#{u.id}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: u.id === 1 ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.06)', color: u.id === 1 ? '#a78bfa' : '#64748b' }}>
                        {u.username[0].toUpperCase()}
                      </div>
                      <span className="text-white text-sm">{u.username}</span>
                      {u.id === 1 && <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>admin</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs font-mono">{u.created_at?.slice(0, 10) || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-mono text-sm ${u.transaction_count > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {u.transaction_count.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs font-mono">{u.last_upload?.slice(0, 10) || '—'}</td>
                  <td className="px-5 py-3 text-slate-600 text-xs font-mono">
                    {u.earliest_tx ? `${u.earliest_tx} → ${u.latest_tx}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
