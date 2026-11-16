import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, Bot, BrainCircuit, CheckCircle2, ClipboardList, FileText,
  Gauge, ShieldCheck, Sparkles, Wand2, Wifi, Zap,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { scoreColor } from '../components/ui'

const FEATURES = [
  { icon: Gauge, t: 'Instant AI risk scoring', d: 'Glucose, haemoglobin and cholesterol go in — a 0–100 health score, risk level and written clinical remarks come out in under a second.' },
  { icon: Bot, t: 'AI Copilot', d: 'Chat with an assistant that knows each patient\'s labs, score and flags. Ask about markers, triage and next steps.' },
  { icon: Wand2, t: 'Smart intake', d: 'Paste a referral email or dictation — AI extracts name, DOB, email and lab values straight into the form.' },
  { icon: ShieldCheck, t: 'Bulletproof validation', d: 'Dates, emails, numeric ranges and duplicates — every error surfaces together, nothing bad reaches the database.' },
  { icon: Wifi, t: 'Live & auditable', d: 'WebSocket events refresh every open tab, and every mutation lands in a full audit trail.' },
  { icon: FileText, t: 'Reports & analytics', d: 'One-click PDF clinical reports, risk distribution charts, cohort trends and care plans per patient.' },
]

const STEPS = [
  { n: '01', t: 'Add or import patients', d: 'Type records, paste free text into Smart intake, or bulk-import a CSV.' },
  { n: '02', t: 'AI assesses instantly', d: 'Every save runs strict validation then the AI engine scores risk and writes remarks.' },
  { n: '03', t: 'Act on insights', d: 'Chat with Copilot, generate care plans, download PDF reports, watch the live dashboard.' },
]

const fade = (i = 0) => ({ initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: .5, delay: i * .08 } })

export default function Landing() {
  const { user, loading } = useAuth()
  if (!loading && user) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100">
      {/* ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] animate-floaty rounded-full bg-pulse-500/15 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-[26rem] w-[26rem] animate-floaty rounded-full bg-mint-500/10 blur-3xl [animation-delay:2s]" />
        <div className="absolute -bottom-40 left-1/3 h-[24rem] w-[24rem] rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-pulse-400 to-mint-500 shadow-glow">
            <svg viewBox="0 0 64 64" className="h-6 w-6"><path d="M10 34h10l5-12 8 24 7-18 4 6h10" fill="none" stroke="#07090f" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <span className="text-lg font-extrabold tracking-tight">CarePulse</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-400 md:flex">
          <a href="#features" className="hover:text-slate-100">Features</a>
          <a href="#how" className="hover:text-slate-100">How it works</a>
        </nav>
        <div className="flex gap-2">
          <Link to="/login" className="btn-ghost !border-ink-600 !bg-ink-800/60 !text-slate-200 hover:!bg-ink-700">Sign in</Link>
          <Link to="/register" className="btn-primary">Get started <ArrowRight size={15} /></Link>
        </div>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-10 lg:grid-cols-2 lg:pt-16">
        <div>
          <motion.span {...fade()} className="inline-flex items-center gap-2 rounded-full border border-pulse-500/30 bg-pulse-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-pulse-300">
            <Sparkles size={13} /> AI-assisted patient screening
          </motion.span>
          <motion.h1 {...fade(1)} className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Patient risk,<br />
            <span className="bg-gradient-to-r from-pulse-300 via-mint-400 to-pulse-300 bg-clip-text text-transparent">predicted in real time.</span>
          </motion.h1>
          <motion.p {...fade(2)} className="mt-6 max-w-lg text-base leading-relaxed text-slate-400">
            Enter three lab markers and CarePulse validates the record, scores the patient's
            health, writes clinical remarks and builds a care plan — every insight
            generated dynamically by Google Gemini.
          </motion.p>
          <motion.div {...fade(3)} className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="btn-primary !px-6 !py-3 text-base">Start screening free <ArrowRight size={17} /></Link>
            <Link to="/login" className="btn-ghost !border-ink-600 !bg-ink-800/60 !px-6 !py-3 !text-base !text-slate-200 hover:!bg-ink-700">Sign in</Link>
          </motion.div>
          <motion.div {...fade(4)} className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs font-semibold text-slate-500">
            {['<1s scoring', '4 AI providers', '55 automated tests', 'HIPAA-style audit trail'].map((s) => (
              <span key={s} className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-mint-500" />{s}</span>
            ))}
          </motion.div>
        </div>

        {/* mock app preview */}
        <motion.div {...fade(2)} className="relative">
          <div className="glass relative overflow-hidden p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2"><span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-pulseDot rounded-full bg-mint-500" /><span className="relative h-2 w-2 rounded-full bg-mint-500" /></span><span className="text-xs font-bold text-slate-300">Live assessment</span></div>
              <span className="kbd !border-ink-600 !bg-ink-700">ai: gemini</span>
            </div>
            <div className="flex items-center gap-6">
              <MiniGauge score={46} />
              <div className="min-w-0 flex-1 space-y-3">
                <MarkerBar label="Glucose" value={145} max={300} tone="#f43f5e" note="diabetes range" delay={.3} />
                <MarkerBar label="Haemoglobin" value={11.2} max={20} tone="#f59e0b" note="anaemia risk" delay={.45} />
                <MarkerBar label="Cholesterol" value={262} max={350} tone="#f43f5e" note="elevated" delay={.6} />
              </div>
            </div>
            <motion.div className="mt-5 rounded-xl bg-ink-800/80 p-4" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: .9 }}>
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-pulse-300"><Bot size={12} /> AI remarks</p>
              <Typewriter text="Glucose 145 mg/dL is in the diabetic range and haemoglobin 11.2 suggests anaemia — repeat fasting glucose with HbA1c and order a CBC with ferritin." />
            </motion.div>
          </div>
          <motion.div className="glass absolute -bottom-5 -left-5 hidden items-center gap-3 px-4 py-3 md:flex" animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity }}>
            <BrainCircuit size={18} className="text-pulse-300" />
            <div><p className="text-xs font-bold">Panel insights</p><p className="text-[10px] text-slate-400">3 high-risk patients flagged</p></div>
          </motion.div>
          <motion.div className="glass absolute -right-4 -top-5 hidden items-center gap-3 px-4 py-3 md:flex" animate={{ y: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity, delay: 1 }}>
            <ClipboardList size={18} className="text-mint-400" />
            <div><p className="text-xs font-bold">Care plan ready</p><p className="text-[10px] text-slate-400">6 actions generated</p></div>
          </motion.div>
        </motion.div>
      </section>

      {/* providers strip */}
      <section className="relative z-10 border-y border-ink-700/60 bg-ink-900/40 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 text-xs font-bold uppercase tracking-widest text-slate-500">
          <span className="text-slate-400">Runs on</span>
          {['Google Gemini', 'AI copilot', 'Smart intake', 'Panel insights', 'Care plans'].map((p) => <span key={p} className="flex items-center gap-1.5"><Zap size={13} className="text-pulse-400" />{p}</span>)}
        </div>
      </section>

      {/* features */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <motion.h2 {...fade()} className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">Everything a screening workflow needs</motion.h2>
        <motion.p {...fade(1)} className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-400">From free-text intake to PDF reports — a complete pipeline, not just a form.</motion.p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: I, t, d }, i) => (
            <motion.div key={t} {...fade(i)} className="glass group p-6 transition hover:border-pulse-500/40">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-pulse-500/15 text-pulse-300 transition group-hover:scale-110"><I size={20} /></div>
              <p className="mt-4 font-bold">{t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="relative z-10 border-y border-ink-700/60 bg-ink-900/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <motion.h2 {...fade()} className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">Three steps to an AI assessment</motion.h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map(({ n, t, d }, i) => (
              <motion.div key={n} {...fade(i)} className="relative">
                <span className="bg-gradient-to-br from-pulse-400 to-mint-500 bg-clip-text font-mono text-5xl font-extrabold text-transparent">{n}</span>
                <p className="mt-3 font-bold">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{d}</p>
                {i < 2 && <ArrowRight size={20} className="absolute -right-4 top-4 hidden text-ink-600 md:block" />}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24 text-center">
        <motion.h2 {...fade()} className="text-3xl font-extrabold tracking-tight md:text-4xl">Ready to screen smarter?</motion.h2>
        <motion.p {...fade(1)} className="mx-auto mt-3 max-w-md text-sm text-slate-400">Create an account in seconds — AI remarks, copilot and care plans are generated live by Gemini.</motion.p>
        <motion.div {...fade(2)} className="mt-8 flex justify-center gap-3">
          <Link to="/register" className="btn-primary !px-8 !py-3 text-base">Create free account</Link>
          <Link to="/login" className="btn-ghost !border-ink-600 !bg-ink-800/60 !px-8 !py-3 !text-base !text-slate-200 hover:!bg-ink-700">Sign in</Link>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-ink-700/60 py-8 text-center text-xs text-slate-500">
        <p>CarePulse · AI-assisted patient screening</p>
        <p className="mt-1">Screening aid only — CarePulse does not provide a medical diagnosis.</p>
      </footer>
    </div>
  )
}

function MiniGauge({ score }) {
  const size = 120, stroke = 10, r = (size - stroke) / 2, c = 2 * Math.PI * r, arc = c * 0.75
  const filled = arc * score / 100
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-[135deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-ink-600" strokeWidth={stroke} strokeDasharray={`${arc} ${c}`} strokeLinecap="round" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={scoreColor(score)} strokeWidth={stroke} strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${c}` }} whileInView={{ strokeDasharray: `${filled} ${c}` }} viewport={{ once: true }} transition={{ duration: 1.4, ease: 'easeOut' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold" style={{ color: scoreColor(score) }}>{score}</span>
        <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">health score</span>
      </div>
    </div>
  )
}

function MarkerBar({ label, value, max, tone, note, delay }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]"><span className="font-bold text-slate-300">{label}</span><span className="font-mono text-slate-400">{value}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
        <motion.div className="h-full rounded-full" style={{ background: tone }} initial={{ width: 0 }} whileInView={{ width: `${Math.min(100, value / max * 100)}%` }} viewport={{ once: true }} transition={{ duration: 1, delay }} />
      </div>
      <p className="mt-0.5 text-[10px] text-slate-500">{note}</p>
    </div>
  )
}

function Typewriter({ text }) {
  return (
    <motion.p className="mt-1.5 text-xs leading-relaxed text-slate-300"
      initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
      {text.split('').map((ch, i) => (
        <motion.span key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1 + i * 0.012 }}>{ch}</motion.span>
      ))}
    </motion.p>
  )
}
