import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowUpDown, Upload, BarChart3, LogOut, Globe, ShieldCheck, Settings } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../contexts/I18nContext'

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, key: 'nav.dashboard' },
  { to: '/transactions', icon: ArrowUpDown,      key: 'nav.transactions' },
  { to: '/insights',     icon: BarChart3,        key: 'nav.insights' },
  { to: '/upload',       icon: Upload,           key: 'nav.upload' },
]

// Lazy Finance logotype — geometric L + uptrend spark
function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lf-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <filter id="lf-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Background pill */}
      <rect width="28" height="28" rx="8" fill="url(#lf-grad)" opacity="0.15" />
      {/* L shape */}
      <rect x="8" y="7" width="3" height="12" rx="1.5" fill="url(#lf-grad)" filter="url(#lf-glow)" />
      <rect x="8" y="16" width="9" height="3" rx="1.5" fill="url(#lf-grad)" />
      {/* Spark line */}
      <polyline
        points="14,17 17,12 20,14 22,9"
        stroke="#34D399"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#lf-glow)"
        opacity="0.9"
      />
      <circle cx="22" cy="9" r="1.5" fill="#34D399" filter="url(#lf-glow)" />
    </svg>
  )
}

export default function Sidebar() {
  const { logout, user } = useAuth()
  const { t, lang, toggleLang } = useI18n()

  return (
    <aside
      className="fixed inset-y-0 left-0 w-52 flex flex-col z-20"
      style={{
        background: '#080C10',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div
        className="px-4 py-5 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <LogoMark size={28} />
        <div>
          <span className="block font-semibold text-white text-sm tracking-tight leading-none">
            Lazy Finance
          </span>
          <span className="block text-[10px] text-emerald-500/70 font-medium tracking-widest uppercase mt-0.5">
            MX
          </span>
        </div>
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2.5 pt-4 pb-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 group ${
                isActive
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Active indicator */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                    style={{ background: 'linear-gradient(180deg, #34D399, #059669)' }}
                  />
                )}
                {/* Active bg */}
                {isActive && (
                  <span
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: 'rgba(52,211,153,0.06)',
                      border: '1px solid rgba(52,211,153,0.1)',
                    }}
                  />
                )}
                <Icon
                  size={15}
                  className={`flex-shrink-0 relative z-10 transition-colors ${
                    isActive ? 'text-emerald-400' : 'text-slate-600 group-hover:text-slate-400'
                  }`}
                />
                <span className="relative z-10">{t(key)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Admin ─────────────────────────────────────────────────────────── */}
      {user?.id === 1 && (
        <div className="px-2.5 pb-1">
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group ${
                isActive ? 'text-violet-300' : 'text-slate-600 hover:text-slate-400 hover:bg-white/[0.03]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute inset-0 rounded-lg" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.12)' }} />
                )}
                <ShieldCheck size={15} className={`flex-shrink-0 relative z-10 ${isActive ? 'text-violet-400' : 'text-slate-700 group-hover:text-slate-500'}`} />
                <span className="relative z-10">Admin</span>
              </>
            )}
          </NavLink>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div
        className="px-2.5 py-3 space-y-0.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <button
          onClick={toggleLang}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-slate-600 hover:text-slate-300 hover:bg-white/[0.03] transition-all duration-150"
        >
          <Globe size={15} className="text-slate-700" />
          {lang === 'es' ? 'English' : 'Español'}
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-slate-600 hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-150"
        >
          <LogOut size={15} />
          {t('nav.logout')}
        </button>
      </div>
    </aside>
  )
}
