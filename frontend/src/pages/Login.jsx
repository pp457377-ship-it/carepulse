import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Activity, Lock, Mail, ShieldCheck, Sparkles, User } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { errorMessages } from '../api/client'

const PERKS = [
  { icon: Sparkles, t: 'AI clinical remarks', d: 'Every remark and plan generated live by Google Gemini' },
  { icon: ShieldCheck, t: 'Strict validation', d: 'Every error surfaced together — nothing bad reaches the database' },
  { icon: Activity, t: 'Live & auditable', d: 'WebSocket updates, assessment history, full audit trail' },
]

export default function Login({ register = false }) {
  const { user, login, register: doRegister } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  if (user) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      if (register) await doRegister(form.full_name, form.email, form.password)
      else await login(form.email, form.password)
      toast.success(register ? 'Account created' : 'Welcome back')
      nav('/')
    } catch (err) { errorMessages(err).forEach((m) => toast.error(m)) }
    finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-950 p-12 text-slate-100 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-32 -top-32 h-96 w-96 animate-floaty rounded-full bg-pulse-500/20 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[28rem] w-[28rem] animate-floaty rounded-full bg-mint-500/15 blur-3xl [animation-delay:2s]" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-pulse-400 to-mint-500 shadow-glow">
            <svg viewBox="0 0 64 64" className="h-7 w-7"><path d="M10 34h10l5-12 8 24 7-18 4 6h10" fill="none" stroke="#07090f" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <span className="text-xl font-extrabold tracking-tight">CarePulse</span>
        </div>
        <div className="relative">
          <motion.h1 className="text-4xl font-extrabold leading-tight tracking-tight" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            Patient screening,<br /><span className="bg-gradient-to-r from-pulse-300 to-mint-400 bg-clip-text text-transparent">predicted in real time.</span>
          </motion.h1>
          <p className="mt-4 max-w-md text-sm text-slate-400">Enter glucose, haemoglobin and cholesterol — get a health score, risk level and AI-written clinical remarks in under a second.</p>
          <div className="mt-10 space-y-4">
            {PERKS.map(({ icon: I, t, d }, i) => (
              <motion.div key={t} className="glass flex gap-4 p-4" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .2 + i * .1 }}>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pulse-500/15 text-pulse-300"><I size={18} /></div>
                <div><p className="text-sm font-bold">{t}</p><p className="text-xs text-slate-400">{d}</p></div>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">Screening aid only — not a medical diagnosis.</p>
      </div>

      <div className="flex items-center justify-center bg-slate-50 p-6 dark:bg-ink-900">
        <motion.form onSubmit={submit} className="card w-full max-w-md p-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}>
          <h2 className="text-2xl font-extrabold">{register ? 'Create your account' : 'Sign in'}</h2>
          <p className="mt-1 text-sm text-slate-400">{register ? 'Start screening patients in minutes.' : 'Welcome back — your dashboard is waiting.'}</p>
          <div className="mt-6 space-y-4">
            {register && <Field icon={User} label="Full name" value={form.full_name} onChange={set('full_name')} placeholder="Dr. Jane Doe" />}
            <Field icon={Mail} label="Email" type="email" value={form.email} onChange={set('email')} placeholder="you@clinic.com" />
            <Field icon={Lock} label="Password" type="password" value={form.password} onChange={set('password')} placeholder="min. 8 characters" />
          </div>
          <button className="btn-primary mt-6 w-full" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
          <p className="mt-5 text-center text-xs text-slate-400">
            {register ? <>Already registered? <Link to="/login" className="font-bold text-pulse-500">Sign in</Link></>
              : <>No account? <Link to="/register" className="font-bold text-pulse-500">Create one</Link></>}
          </p>
          <p className="mt-3 text-center"><Link to="/welcome" className="text-xs text-slate-400 hover:text-pulse-500">← Back to home</Link></p>
        </motion.form>
      </div>
    </div>
  )
}

function Field({ icon: I, label, ...rest }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <I size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input !pl-10" required {...rest} />
      </div>
    </div>
  )
}
