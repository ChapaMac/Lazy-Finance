import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowUpDown, Upload, BarChart3, LogOut, Globe, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../contexts/I18nContext'

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, key: 'nav.dashboard' },
  { to: '/transactions', icon: ArrowUpDown,      key: 'nav.transactions' },
  { to: '/insights',     icon: BarChart3,        key: 'nav.insights' },
  { to: '/upload',       icon: Upload,           key: 'nav.upload' },
]

export default function Sidebar() {
  const { logout, user } = useAuth()
  const { t, lang, toggleLang } = useI18n()

  return (
    <aside className="fixed inset-y-0 left-0 w-52 flex flex-col z-20"
      style={{ background: '#0B0F14', borderRight: '1px solid rgba(255,255,255,0.05)' }}>

      {/* Logo */}
      <div className="px-5 py-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #22C55E 0%, #16a34a 100%)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="3" y="2" width="2" height="8" rx="1" fill="white"/>
              <rect x="3" y="8" width="7" height="2" rx="1" fill="white"/>
              <circle cx="10" cy="4" r="0.8" fill="white" opacity="0.6"/>
              <circle cx="12" cy="2.5" r="0.8" fill="white" opacity="0.8"/>
            </svg>
          </div>
          <span className="font-semibold text-gray-200 text-sm tracking-tight">Lazy Finance</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ to, icon: Icon, key }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-white/[0.07] text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={isActive ? 'text-green-400' : ''} />
                {t(key)}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Admin link — only for user id 1 */}
      {user?.id === 1 && (
        <div className="px-3 pb-2">
          <NavLink to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive ? 'bg-white/[0.07] text-white' : 'text-slate-600 hover:text-slate-300 hover:bg-white/[0.04]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <ShieldCheck size={16} className={isActive ? 'text-violet-400' : ''} />
                Admin
              </>
            )}
          </NavLink>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-4 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={toggleLang}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all duration-150">
          <Globe size={16} />
          {lang === 'es' ? 'English' : 'Español'}
        </button>
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-150">
          <LogOut size={16} />
          {t('nav.logout')}
        </button>
      </div>
    </aside>
  )
}
