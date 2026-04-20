import { useState, useRef, useCallback } from 'react'
import { Upload as UploadIcon, FileText, X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { formatMXN, formatDate, CATEGORIES, CATEGORY_COLORS } from '../utils/formatters'
import { useI18n } from '../contexts/I18nContext'
import api from '../utils/api'

const FORMAT_HINTS = {
  'BBVA-pdf': 'upload.formatHint.bbva-pdf',
  'BBVA-csv': 'upload.formatHint.bbva-csv',
  'AMEX-pdf': 'upload.formatHint.amex-pdf',
  'AMEX-xlsx': 'upload.formatHint.amex-xlsx',
}

const selectCls = 'bg-[#0B0F14] border border-white/[0.08] hover:border-white/[0.15] focus:border-emerald-500/60 rounded px-2 py-1 text-white text-xs focus:outline-none transition-colors cursor-pointer'

export default function Upload() {
  const { t } = useI18n()
  const [bank, setBank] = useState('')
  const [autoDetected, setAutoDetected] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [parseError, setParseError] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const inputRef = useRef()

  const fileType = file ? (file.name.endsWith('.csv') ? 'csv' : file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? 'xlsx' : 'pdf') : ''
  const hintKey = bank && fileType ? FORMAT_HINTS[`${bank}-${fileType}`] || FORMAT_HINTS[`${bank}-pdf`] : ''

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }

  async function handleFile(f) {
    setFile(f)
    setPreview(null)
    setParseError('')
    setResult(null)
    setAutoDetected(false)

    setDetecting(true)
    try {
      const form = new FormData()
      form.append('file', f)
      const res = await api.post('/api/uploads/detect', form)
      if (res.data.bank) {
        setBank(res.data.bank)
        setAutoDetected(true)
      }
    } catch { /* silent — user can still pick manually */ }
    finally { setDetecting(false) }
  }

  async function parseFile() {
    if (!file || !bank) return
    setParsing(true)
    setParseError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('bank', bank)
      const res = await api.post('/api/uploads/preview', form)
      setPreview(res.data.transactions)
    } catch (err) {
      setParseError(err.response?.data?.error || t('upload.error'))
    } finally {
      setParsing(false)
    }
  }

  async function confirmSave() {
    if (!preview?.length) return
    setSaving(true)
    try {
      const res = await api.post('/api/uploads/confirm', { transactions: preview })
      setResult(res.data)
      setPreview(null)
      setFile(null)
    } catch (err) {
      setParseError(err.response?.data?.error || t('upload.error'))
    } finally {
      setSaving(false)
    }
  }

  function setTxCategory(index, category) {
    setPreview(prev => prev.map((tx, i) => i === index ? { ...tx, category } : tx))
  }

  const newCount = preview?.filter(t => !t.isDuplicate).length || 0
  const dupCount = preview?.filter(t => t.isDuplicate).length || 0

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white tracking-tight">{t('upload.title')}</h1>

      {/* Success result */}
      {result && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3.5" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <CheckCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-emerald-300 text-sm font-medium">{t('upload.success', { inserted: result.inserted, skipped: result.skipped })}</p>
        </div>
      )}

      {/* Drop + bank selector — single card */}
      <Card>
        {/* Dropzone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl p-8 text-center cursor-pointer transition-all"
          style={{
            border: `2px dashed ${dragging ? 'rgba(34,197,94,0.6)' : file ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.1)'}`,
            background: dragging ? 'rgba(34,197,94,0.04)' : file ? 'rgba(34,197,94,0.03)' : 'transparent',
          }}
        >
          <input ref={inputRef} type="file" accept=".pdf,.csv,.xlsx,.xls" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText size={18} className="text-emerald-400" />
              <div className="text-left">
                <p className="text-white font-medium text-sm">{file.name}</p>
                <p className="text-slate-500 text-xs">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); setParseError(''); setBank(''); setAutoDetected(false) }}
                className="ml-2 text-slate-600 hover:text-red-400 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <>
              <UploadIcon size={26} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-medium text-sm">{t('upload.dropzone')}</p>
              <p className="text-slate-500 text-sm mt-1">{t('upload.dropzoneOr')}</p>
              <p className="text-slate-700 text-xs mt-2">{t('upload.formats')}</p>
            </>
          )}
        </div>

        {/* Bank selector */}
        <div className="mt-4 space-y-2">
          <span className="text-slate-600 text-xs font-medium uppercase tracking-wider">Banco</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'BBVA',       label: 'BBVA',       color: '#004481', ready: true },
              { id: 'AMEX',       label: 'AmEx',        color: '#B8972B', ready: true },
              { id: 'NU',         label: 'Nu',          color: '#820AD1', ready: false },
              { id: 'SANTANDER',  label: 'Santander',   color: '#EC0000', ready: false },
              { id: 'BANAMEX',    label: 'Banamex',     color: '#005DAA', ready: false },
              { id: 'HSBC',       label: 'HSBC',        color: '#DB0011', ready: false },
              { id: 'BANORTE',    label: 'Banorte',     color: '#E2001A', ready: false },
              { id: 'SCOTIABANK', label: 'Scotiabank',  color: '#EC111A', ready: false },
            ].map(b => (
              <button
                key={b.id}
                onClick={() => b.ready && (setBank(b.id), setAutoDetected(false))}
                title={b.ready ? b.label : 'Próximamente'}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  bank === b.id
                    ? 'text-[#0B0F14] shadow-sm border-transparent'
                    : b.ready
                      ? 'text-slate-400 hover:text-white border-white/[0.06] hover:border-white/[0.15]'
                      : 'text-slate-700 border-white/[0.04] cursor-not-allowed'
                }`}
                style={bank === b.id ? { background: b.color } : {}}
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: b.color, opacity: b.ready ? 1 : 0.35 }} />
                {b.label}
                {!b.ready && <span className="text-slate-700 text-xs">pronto</span>}
              </button>
            ))}
          </div>
        </div>

          {detecting && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Detectando banco...
            </span>
          )}
          {autoDetected && !detecting && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle size={11} />
              Auto-detectado
            </span>
          )}
          {!bank && !detecting && file && (
            <span className="text-xs text-amber-500">Selecciona el banco para continuar</span>
          )}
        </div>

        {/* Format hint */}
        {hintKey && (
          <div className="mt-3 flex gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <Info size={12} className="text-slate-600 flex-shrink-0 mt-0.5" />
            <p className="text-slate-600 text-xs">{t(hintKey)}</p>
          </div>
        )}

        {/* Analyze button */}
        {file && bank && !preview && (
          <button
            onClick={parseFile}
            disabled={parsing}
            className="mt-4 w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-[#0B0F14] font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            {parsing ? t('upload.parsing') : 'Analizar archivo'}
          </button>
        )}

        {parseError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-red-300 text-sm">
              {parseError}
              {file && file.name.endsWith('.pdf') && (
                <button
                  onClick={async () => {
                    const form = new FormData(); form.append('file', file)
                    const res = await api.post('/api/uploads/debug-pdf', form)
                    window.__pdfDebug = res.data
                    alert('Texto extraído guardado. Líneas: ' + res.data.lines.length)
                  }}
                  className="ml-2 underline text-xs opacity-50 hover:opacity-100"
                >
                  [diagnóstico]
                </button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Preview table */}
      {preview && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('upload.preview')}</h2>
            <div className="flex gap-2">
              <Badge variant="emerald">{newCount} nuevos</Badge>
              {dupCount > 0 && <Badge variant="gray">{dupCount} duplicados</Badge>}
            </div>
          </div>
          <p className="text-slate-600 text-xs mb-4">{t('upload.previewDesc')}</p>

          <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th className="text-left px-3 py-2.5 text-slate-500 font-medium text-xs">Fecha</th>
                  <th className="text-left px-3 py-2.5 text-slate-500 font-medium text-xs">Descripción</th>
                  <th className="text-right px-3 py-2.5 text-slate-500 font-medium text-xs">Monto</th>
                  <th className="text-left px-3 py-2.5 text-slate-500 font-medium text-xs">Categoría</th>
                  <th className="text-left px-3 py-2.5 text-slate-500 font-medium text-xs"></th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((tx, i) => (
                  <tr key={i} className={tx.isDuplicate ? 'opacity-35' : ''} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="px-3 py-2 text-slate-500 text-xs font-mono">{formatDate(tx.date)}</td>
                    <td className="px-3 py-2 text-slate-200 text-xs max-w-xs truncate" title={tx.description}>{tx.description}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-emerald-400">{formatMXN(tx.amount)}</td>
                    <td className="px-3 py-2">
                      {tx.isDuplicate
                        ? <span className="text-xs text-slate-600">{t(`category.${tx.category}`)}</span>
                        : (
                          <select
                            value={tx.category}
                            onChange={e => setTxCategory(i, e.target.value)}
                            className={selectCls}
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
                          </select>
                        )
                      }
                    </td>
                    <td className="px-3 py-2">
                      {tx.isDuplicate
                        ? <Badge variant="gray">{t('common.duplicate')}</Badge>
                        : <Badge variant="emerald">{t('common.new')}</Badge>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 50 && (
              <p className="text-center text-slate-600 text-xs py-2">... y {preview.length - 50} más</p>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={confirmSave}
              disabled={saving || newCount === 0}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-[#0B0F14] font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              {saving ? t('common.loading') : t('upload.confirm', { count: newCount })}
            </button>
            <button
              onClick={() => { setPreview(null); setFile(null) }}
              className="px-5 text-slate-400 hover:text-white font-medium py-2.5 rounded-lg text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {t('upload.cancel')}
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
