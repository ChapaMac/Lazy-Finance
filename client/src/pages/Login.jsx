import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import { Eye, EyeOff, Globe } from 'lucide-react'

const inputCls = 'w-full rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none transition-colors'
const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
}
const inputFocusStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(34,197,94,0.4)',
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5 tracking-wide">{label}</label>
      {children}
    </div>
  )
}

export default function Login() {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const { t, lang, toggleLang } = useI18n()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (mode === 'register' && password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(username, password)
      } else {
        await register(username, password)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Error de autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0B0F14' }}>
      {/* Lang toggle */}
      <button
        onClick={toggleLang}
        className="fixed top-4 right-4 flex items-center gap-1.5 text-slate-600 hover:text-slate-300 text-sm transition-colors"
      >
        <Globe size={14} />
        {lang === 'es' ? 'EN' : 'ES'}
      </button>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #22C55E 0%, #15803d 100%)' }}>
              <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                <rect x="11" y="9" width="4" height="15" rx="2" fill="white"/>
                <rect x="11" y="20" width="13" height="4" rx="2" fill="white"/>
                <circle cx="22" cy="15" r="1.5" fill="white" opacity="0.5"/>
                <circle cx="25" cy="12" r="1.5" fill="white" opacity="0.65"/>
                <circle cx="28" cy="9" r="1.5" fill="white" opacity="0.85"/>
              </svg>
            </div>
          </div>
          <p className="text-emerald-400 font-semibold text-base tracking-tight mb-1">Lazy Finance</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {mode === 'login' ? t('auth.welcome') : t('auth.createAccount')}
          </h1>
          <p className="text-slate-600 text-sm mt-1">{t('auth.subtitle')}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.07)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={t('auth.username')}>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                className={inputCls}
                style={inputStyle}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)}
                placeholder="tu_usuario"
              />
            </Field>

            <Field label={t('auth.password')}>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className={`${inputCls} pr-10`}
                  style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.target.style, inputStyle)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            {mode === 'register' && (
              <Field label={t('auth.confirmPassword')}>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={inputCls}
                  style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.target.style, inputStyle)}
                  placeholder="••••••••"
                />
              </Field>
            )}

            {error && (
              <div className="rounded-lg px-3 py-2.5 text-red-300 text-sm" role="alert"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-[#0B0F14] font-semibold py-2.5 rounded-lg text-sm transition-colors mt-1"
            >
              {loading ? t('common.loading') : mode === 'login' ? t('auth.loginButton') : t('auth.registerButton')}
            </button>
          </form>

          <div className="mt-5 text-center">
            <span className="text-slate-600 text-sm">
              {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}{' '}
            </span>
            <button
              onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}
              className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
            >
              {mode === 'login' ? t('auth.register') : t('auth.login')}
            </button>
          </div>
        </div>

        {/* Subtle footer */}
        <p className="text-center text-slate-700 text-xs mt-6">
          Tus datos son privados y se guardan solo en tu dispositivo.
        </p>
      </div>
    </div>
  )
}
