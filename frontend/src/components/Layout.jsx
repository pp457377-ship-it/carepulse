import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Activity, Bot, LayoutDashboard, Settings as SettingsIcon, LogOut, Moon, Sun, Users, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useLiveEvents } from '../hooks/useLiveEvents'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/copilot', label: 'AI Copilot', icon: Bot },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const { connected } = useLiveEvents()
  const nav = useNavigate()
  const initials = user?.full_name?.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white dark:border-ink-600/60 dark:bg-ink-900">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-pulse-400 to-mint-500 shadow-glow">
            <svg viewBox="0 0 64 64" className="h-6 w-6"><path d="M10 34h10l5-12 8 24 7-18 4 6h10" fill="none" stroke="#07090f" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <p className="text-base font-extrabold tracking-tight">CarePulse</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">AI screening</p>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'text-pulse-600 dark:text-pulse-300' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-ink-700 dark:hover:text-slate-100'}`}>
              {({ isActive }) => (<>
                {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-pulse-500/10" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <Icon size={18} className="relative" /><span className="relative">{label}</span>
              </>)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4 dark:border-ink-600/60">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-pulse-500/30 to-mint-500/30 text-xs font-bold text-pulse-600 dark:text-pulse-300">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user?.full_name}</p>
              <p className="truncate text-[11px] text-slate-400">{user?.email}</p>
            </div>
          </div>
          <button className="btn-ghost mt-3 w-full text-xs" onClick={() => { logout(); nav('/login') }}><LogOut size={14} /> Sign out</button>
        </div>
      </aside>

      <div className="ml-64 flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-slate-50/80 px-8 py-3 backdrop-blur dark:border-ink-600/60 dark:bg-ink-950/70">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            {connected ? <><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-pulseDot rounded-full bg-mint-500" /><span className="relative inline-flex h-2 w-2 rounded-full bg-mint-500" /></span><Wifi size={14} className="text-mint-500" /> Live updates connected</>
              : <><span className="h-2 w-2 rounded-full bg-slate-400" /><WifiOff size={14} /> Reconnecting…</>}
          </div>
          <button onClick={toggle} className="btn-ghost !px-3 !py-1.5 text-xs">{dark ? <Sun size={14} /> : <Moon size={14} />} {dark ? 'Light' : 'Dark'}</button>
        </header>
        <main className="flex-1 px-8 py-8"><Outlet /></main>
      </div>
    </div>
  )
}
