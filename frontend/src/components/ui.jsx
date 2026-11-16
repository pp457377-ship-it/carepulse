import { Component } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'

export class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 p-6 text-slate-100">
        <div className="card max-w-md p-8 text-center">
          <p className="text-lg font-extrabold">Something went wrong</p>
          <p className="mt-2 break-words font-mono text-xs text-rose-400">{String(this.state.error?.message || this.state.error)}</p>
          <button className="btn-primary mt-5" onClick={() => window.location.reload()}><RefreshCw size={15} /> Reload</button>
        </div>
      </div>
    )
  }
}

export function RiskBadge({ level }) {
  const dot = { low: 'bg-mint-500', moderate: 'bg-amber-500', high: 'bg-rose-500' }[level] || 'bg-slate-400'
  return (
    <span className={`badge badge-${level}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {level}
    </span>
  )
}

export function scoreColor(s) {
  return s >= 80 ? '#10b981' : s >= 55 ? '#f59e0b' : '#f43f5e'
}

export function ScoreGauge({ score = 0, size = 150, stroke = 12 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const arc = c * 0.75
  const filled = arc * Math.min(100, Math.max(0, score)) / 100
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-[135deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
          className="text-slate-200 dark:text-ink-600" strokeWidth={stroke}
          strokeDasharray={`${arc} ${c}`} strokeLinecap="round" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={scoreColor(score)}
          strokeWidth={stroke} strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${filled} ${c}` }}
          transition={{ duration: 1.1, ease: 'easeOut' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold tabular-nums" style={{ color: scoreColor(score) }}>{score}</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">health score</span>
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div onClick={(e) => e.stopPropagation()}
            className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} p-6`}
            initial={{ y: 24, scale: .96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: .98, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}>
            <div className="mb-5 flex items-start justify-between">
              <h2 className="text-lg font-bold">{title}</h2>
              <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-ink-600"><X size={18} /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function SkeletonRows({ rows = 6, cols = 8 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} className="px-4 py-4"><div className="skeleton h-3.5 w-full" style={{ opacity: 1 - i * 0.1 }} /></td>
      ))}
    </tr>
  ))
}

export function SkeletonCard({ h = 'h-28' }) {
  return <div className={`skeleton ${h} w-full rounded-2xl`} />
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'pulse', delay = 0 }) {
  const tones = {
    pulse: 'from-pulse-500/20 to-pulse-500/0 text-pulse-500',
    mint: 'from-mint-500/20 to-mint-500/0 text-mint-500',
    amber: 'from-amber-500/20 to-amber-500/0 text-amber-500',
    rose: 'from-rose-500/20 to-rose-500/0 text-rose-500',
    violet: 'from-violet-500/20 to-violet-500/0 text-violet-500',
  }
  return (
    <motion.div className="card relative overflow-hidden p-5"
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: .4 }}>
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${tones[tone]} blur-2xl`} />
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        {Icon && <Icon size={16} className={tones[tone].split(' ').pop()} />}
      </div>
      <p className="mt-2 text-3xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </motion.div>
  )
}

export function Empty({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <div className="mb-4 rounded-2xl bg-pulse-500/10 p-4 text-pulse-500"><Icon size={28} /></div>}
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <motion.h1 className="text-2xl font-extrabold tracking-tight" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>{title}</motion.h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
