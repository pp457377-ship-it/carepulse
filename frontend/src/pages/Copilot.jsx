import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Bot, SendHorizonal, Sparkles, User } from 'lucide-react'
import api, { errorMessages } from '../api/client'
import { PageHeader, RiskBadge } from '../components/ui'

const SUGGESTIONS = [
  'Explain this patient\'s risk score',
  'What follow-up tests do you recommend?',
  'Suggest lifestyle changes',
  'What red-flag symptoms should we watch for?',
]

export default function Copilot() {
  const [params] = useSearchParams()
  const [patients, setPatients] = useState([])
  const [pid, setPid] = useState(params.get('patient') || '')
  const [caps, setCaps] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottom = useRef(null)

  useEffect(() => {
    api.get('/api/patients', { params: { page_size: 100 } }).then((r) => setPatients(r.data.items)).catch(() => {})
    api.get('/api/ai/capabilities').then((r) => setCaps(r.data)).catch(() => {})
  }, [])
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  const patient = patients.find((p) => String(p.id) === String(pid))

  const send = async (text) => {
    const message = (text ?? input).trim()
    if (!message || busy) return
    setInput('')
    const history = msgs.slice(-10).map(({ role, content }) => ({ role, content }))
    setMsgs((m) => [...m, { role: 'user', content: message }])
    setBusy(true)
    try {
      const { data } = await api.post('/api/ai/chat', {
        message, history, patient_id: pid ? Number(pid) : null,
      })
      setMsgs((m) => [...m, { role: 'assistant', content: data.reply, source: data.source }])
    } catch (e) {
      errorMessages(e).forEach((m) => toast.error(m))
      setMsgs((m) => m.slice(0, -1))
    } finally { setBusy(false) }
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col">
      <PageHeader title="AI Copilot" subtitle="Ask clinical questions — pick a patient for context-aware answers grounded in their labs and risk score.">
        <select className="input !w-64" value={pid} onChange={(e) => { setPid(e.target.value); setMsgs([]) }}>
          <option value="">General questions (no patient)</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.health_score}/100</option>)}
        </select>
      </PageHeader>

      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-ink-600/50">
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-pulse-400 to-mint-500 text-ink-950"><Bot size={16} /></span>
            {patient ? <span>Chatting about <span className="text-pulse-500">{patient.full_name}</span></span> : 'CarePulse Copilot'}
            {patient && <RiskBadge level={patient.risk_level} />}
          </div>
          {caps && <span className="kbd">{caps.llm_active ? `${caps.provider}${caps.model ? ' · ' + caps.model : ''}` : 'Gemini key not set'}</span>}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {msgs.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="rounded-2xl bg-pulse-500/10 p-4 text-pulse-500"><Sparkles size={28} /></div>
              <p className="mt-3 text-sm font-bold">How can I help{patient ? ` with ${patient.full_name}` : ''}?</p>
              <p className="mt-1 max-w-md text-xs text-slate-400">Screening aid only — answers are informational, not a medical diagnosis.</p>
              <div className="mt-5 flex max-w-lg flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="btn-ghost !px-3 !py-1.5 text-xs">{s}</button>)}
              </div>
            </div>
          )}
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => (
              <motion.div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${m.role === 'user' ? 'bg-slate-200 text-slate-600 dark:bg-ink-600 dark:text-slate-200' : 'bg-gradient-to-br from-pulse-400 to-mint-500 text-ink-950'}`}>
                  {m.role === 'user' ? <User size={15} /> : <Bot size={15} />}
                </span>
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-pulse-500/15' : 'bg-slate-50 dark:bg-ink-700/60'}`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.source && <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-slate-400">source: {m.source}</p>}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {busy && (
            <div className="flex gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-pulse-400 to-mint-500 text-ink-950"><Bot size={15} /></span>
              <div className="flex items-center gap-1.5 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-ink-700/60">
                {[0, 1, 2].map((i) => <motion.span key={i} className="h-2 w-2 rounded-full bg-pulse-500" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />)}
              </div>
            </div>
          )}
          <div ref={bottom} />
        </div>

        <form className="flex gap-2 border-t border-slate-100 p-4 dark:border-ink-600/50" onSubmit={(e) => { e.preventDefault(); send() }}>
          <input className="input" placeholder={patient ? `Ask about ${patient.full_name}…` : 'Ask a clinical question…'} value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn-primary shrink-0" disabled={busy || !input.trim()}><SendHorizonal size={16} /> Send</button>
        </form>
      </div>
    </div>
  )
}
