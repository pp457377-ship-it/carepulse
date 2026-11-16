import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Activity, BookOpenCheck, Cpu, Database, KeyRound, Server, ShieldCheck, UserRound } from 'lucide-react'
import api, { errorMessages } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { PageHeader, SkeletonCard } from '../components/ui'

function Section({ icon: Icon, title, subtitle, children, delay = 0 }) {
  return (
    <motion.section className="card p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pulse-500/10 text-pulse-500"><Icon size={18} /></div>
        <div>
          <h3 className="font-bold">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </motion.section>
  )
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0 dark:border-ink-600/50">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-right font-semibold ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

function fmtUptime(s) {
  if (s == null) return '—'
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`
}

export default function Settings() {
  const { user, reload } = useAuth()
  const [name, setName] = useState(user?.full_name || '')
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' })
  const [status, setStatus] = useState(null)
  const [rules, setRules] = useState(null)
  const [busy, setBusy] = useState('')

  const loadStatus = useCallback(async () => setStatus((await api.get('/api/system/status')).data), [])
  useEffect(() => { loadStatus(); api.get('/api/validation/rules').then((r) => setRules(r.data.rules)) }, [loadStatus])
  useEffect(() => { const t = setInterval(loadStatus, 30000); return () => clearInterval(t) }, [loadStatus])
  useLiveEvents(loadStatus)

  const saveProfile = async (e) => {
    e.preventDefault(); setBusy('profile')
    try { await api.patch('/api/auth/me', { full_name: name }); await reload(); toast.success('Profile updated') }
    catch (err) { errorMessages(err).forEach((m) => toast.error(m)) }
    finally { setBusy('') }
  }
  const changePassword = async (e) => {
    e.preventDefault()
    if (pw.new_password !== pw.confirm) return toast.error('New passwords do not match')
    setBusy('password')
    try {
      await api.post('/api/auth/change-password', { current_password: pw.current_password, new_password: pw.new_password })
      setPw({ current_password: '', new_password: '', confirm: '' }); toast.success('Password changed')
    } catch (err) { errorMessages(err).forEach((m) => toast.error(m)) }
    finally { setBusy('') }
  }

  const ai = status?.ai
  const engineTone = ai?.active_engine === 'none' ? 'text-amber-500 bg-amber-500/10' : 'text-mint-500 bg-mint-500/10'

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your account, security and a live view of what this deployment is running." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={UserRound} title="Profile" subtitle="Shown in the sidebar and on PDF reports.">
          <form onSubmit={saveProfile} className="space-y-3">
            <div><label className="label">Full name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required /></div>
            <div><label className="label">Email</label><input className="input opacity-70" value={user?.email || ''} readOnly /></div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-400">Role <span className="font-mono">{user?.role}</span> · member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</p>
              <button className="btn-primary" disabled={busy === 'profile' || name.trim() === user?.full_name}>Save</button>
            </div>
          </form>
        </Section>

        <Section icon={KeyRound} title="Change password" subtitle="Minimum 8 characters. You stay signed in on this device." delay={0.05}>
          <form onSubmit={changePassword} className="space-y-3">
            <div><label className="label">Current password</label><input className="input" type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">New password</label><input className="input" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required /></div>
              <div><label className="label">Confirm</label><input className={`input ${pw.confirm && pw.confirm !== pw.new_password ? 'input-error' : ''}`} type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></div>
            </div>
            <div className="flex justify-end"><button className="btn-primary" disabled={busy === 'password'}>Update password</button></div>
          </form>
        </Section>

        <Section icon={Server} title="System status" subtitle="Read live from the API — refreshes every 30 s and on every event." delay={0.1}>
          {!status ? <SkeletonCard h="h-40" /> : (
            <div>
              <Row label="API version" value={status.version} mono />
              <Row label="Database" value={<span className="inline-flex items-center gap-2"><Database size={14} />{status.database.dialect} <span className={`h-2 w-2 rounded-full ${status.database.ok ? 'bg-mint-500' : 'bg-rose-500'}`} /></span>} />
              <Row label="AI engine" value={<span className={`badge ${engineTone}`}><Cpu size={12} />{ai.active_engine}</span>} />
              <Row label="Configured provider" value={ai.configured_provider} mono />
              <Row label="Gemini API key" value={ai.external_api_key_set ? 'set' : 'not set — AI features will return errors'} />
              {ai.model && <Row label="Model" value={ai.model} mono />}
              <Row label="Token lifetime" value={`${status.auth.access_token_minutes} min access · ${status.auth.refresh_token_days} d refresh`} />
              <Row label="Uptime" value={fmtUptime(status.uptime_seconds)} />
              <Row label="Server time" value={new Date(status.server_time).toLocaleString()} />
            </div>
          )}
        </Section>

        <Section icon={Activity} title="Your data" subtitle="Counts scoped to your account only." delay={0.15}>
          {!status ? <SkeletonCard h="h-24" /> : (
            <div className="grid grid-cols-3 gap-3">
              {[['Patients', status.counts.patients, 'text-pulse-500'], ['Assessments', status.counts.assessments, 'text-mint-500'], ['Audit entries', status.counts.audit_entries, 'text-violet-500']].map(([l, v, c]) => (
                <div key={l} className="rounded-xl bg-slate-50 p-4 text-center dark:bg-ink-900/60">
                  <p className={`text-2xl font-extrabold font-mono ${c}`}>{v}</p>
                  <p className="text-xs text-slate-400">{l}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={14} className="text-mint-500" /> Every record is owned by your account — other users can never read or modify it.</p>
        </Section>

        <Section icon={BookOpenCheck} title="Validation rules" subtitle="Generated from the backend validator's own constants — the UI can never drift from what the API enforces." delay={0.2}>
          {!rules ? <SkeletonCard h="h-40" /> : (
            <ul className="space-y-2 lg:columns-2 lg:gap-4 [&>li]:break-inside-avoid">
              {rules.map((r, i) => (
                <li key={i} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-ink-900/60">
                  <span className="mr-2 rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[11px] dark:bg-ink-700">{r.field}</span>{r.rule}
                  {r.min != null && <span className="ml-2 font-mono text-xs text-slate-400">[{r.min}–{r.max} {r.unit}]</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}
