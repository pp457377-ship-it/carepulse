import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, Bot, CheckCircle2, ClipboardList, FileText, MessageSquareText, Pencil, RefreshCw, Sparkles } from 'lucide-react'
import api, { errorMessages, tokens } from '../api/client'
import PatientForm from '../components/PatientForm'
import { Modal, RiskBadge, ScoreGauge, SkeletonCard, scoreColor } from '../components/ui'

const STATUS = { normal: 'text-mint-500 bg-mint-500/10 border-mint-500/20', borderline: 'text-amber-500 bg-amber-500/10 border-amber-500/20', low: 'text-amber-500 bg-amber-500/10 border-amber-500/20', high: 'text-rose-500 bg-rose-500/10 border-rose-500/20', critical: 'text-rose-600 bg-rose-500/15 border-rose-500/30' }

export default function PatientDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [p, setP] = useState(null)
  const [hist, setHist] = useState([])
  const [edit, setEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState(null)
  const [planBusy, setPlanBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.get(`/api/patients/${id}`), api.get(`/api/patients/${id}/assessments`)])
      setP(a.data); setHist(b.data)
    } catch { toast.error('Patient not found'); nav('/patients') }
  }, [id, nav])
  useEffect(() => { load() }, [load])

  const regen = async () => {
    setBusy(true)
    try { await api.post(`/api/patients/${id}/regenerate-remarks`); toast.success('Assessment regenerated'); load() }
    catch (e) { errorMessages(e).forEach((m) => toast.error(m)) } finally { setBusy(false) }
  }
  const genPlan = async () => {
    setPlanBusy(true)
    try {
      const { data } = await api.post(`/api/ai/care-plan/${id}`)
      setPlan(data)
    } catch (e) { errorMessages(e).forEach((m) => toast.error(m)) } finally { setPlanBusy(false) }
  }
  const pdf = async () => {
    const r = await fetch(`/api/patients/${id}/report.pdf`, { headers: { Authorization: `Bearer ${tokens.access}` } })
    if (!r.ok) return toast.error('Could not generate report')
    const url = URL.createObjectURL(await r.blob()); const a = document.createElement('a'); a.href = url; a.download = `carepulse-report-${id}.pdf`; a.click(); URL.revokeObjectURL(url)
    toast.success('PDF report downloaded')
  }

  if (!p) return <div className="grid gap-4 lg:grid-cols-3"><SkeletonCard h="h-64" /><SkeletonCard h="h-64" /><SkeletonCard h="h-64" /></div>
  const latest = hist[0]
  const series = [...hist].reverse().map((h, i) => ({ i: i + 1, score: h.health_score, at: new Date(h.created_at + 'Z').toLocaleString() }))
  const markers = latest?.detail?.markers || []
  const recs = latest?.detail?.recommendations || []

  return (
    <div>
      <Link to="/patients" className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-pulse-500"><ArrowLeft size={14} /> All patients</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{p.full_name}</h1>
          <p className="mt-1 text-sm text-slate-400">{p.email} · DOB <span className="font-mono">{p.date_of_birth}</span> · updated {new Date(p.updated_at + 'Z').toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/copilot?patient=${id}`} className="btn-ghost"><MessageSquareText size={16} /> Ask AI</Link>
          <button className="btn-ghost" onClick={() => setEdit(true)}><Pencil size={16} /> Edit</button>
          <button className="btn-ghost" onClick={regen} disabled={busy}><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Re-run AI</button>
          <button className="btn-ghost" onClick={genPlan} disabled={planBusy}><ClipboardList size={16} className={planBusy ? 'animate-pulse' : ''} /> {planBusy ? 'Generating…' : 'Care plan'}</button>
          <button className="btn-primary" onClick={pdf}><FileText size={16} /> PDF report</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div className="card flex flex-col items-center p-6" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <ScoreGauge score={p.health_score} size={190} />
          <RiskBadge level={p.risk_level} />
          <p className="mt-3 text-center text-xs text-slate-400">100 minus deductions per abnormal marker (mild −8 · moderate −18 · severe −35)</p>
        </motion.div>

        <motion.div className="card p-6 lg:col-span-2" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 }}>
          <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold"><Bot size={16} className="text-pulse-500" /> AI remarks</h3><span className="kbd">source: {p.ai_source}</span></div>
          <p className="text-sm leading-relaxed">{p.remarks}</p>
          {recs.length > 0 && <><h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">Recommendations</h4>
            <ul className="space-y-1.5">{recs.map((r, i) => <motion.li key={i} className="flex gap-2 text-sm" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .1 + i * .05 }}><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-mint-500" />{r}</motion.li>)}</ul></>}
        </motion.div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {markers.map((m, i) => (
          <motion.div key={m.name} className={`card border p-5 ${STATUS[m.status] || ''}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 + i * .06 }}>
            <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{m.label}</p><span className="rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase">{m.status}</span></div>
            <p className="mt-2 font-mono text-3xl font-extrabold text-slate-900 dark:text-slate-100">{m.value}<span className="ml-1 text-sm font-semibold text-slate-400">{m.unit}</span></p>
            <p className="mt-2 text-xs text-slate-500">{m.note}</p>
            {m.recommendation && <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">→ {m.recommendation}</p>}
          </motion.div>))}
      </div>

      <motion.div className="card mt-4 p-6" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 }}>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold"><Sparkles size={16} className="text-pulse-500" /> Assessment history <span className="text-xs font-normal text-slate-400">· {hist.length} snapshot{hist.length === 1 ? '' : 's'}</span></h3>
        <p className="mb-4 text-xs text-slate-400">A new snapshot is stored every time lab values change or AI is re-run.</p>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3"><ResponsiveContainer width="100%" height={220}>
            <LineChart data={series}><CartesianGrid stroke="rgba(148,163,184,.15)" vertical={false} /><XAxis dataKey="i" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #243049', borderRadius: 12, fontSize: 12 }} labelFormatter={(_, pl) => pl?.[0]?.payload?.at} />
              <Line type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={3} dot={{ r: 5, fill: '#06b6d4', strokeWidth: 0 }} activeDot={{ r: 7 }} /></LineChart></ResponsiveContainer></div>
          <ul className="max-h-56 space-y-2 overflow-auto lg:col-span-2">{hist.map((h) => (
            <li key={h.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-ink-700/60">
              <div className="flex items-center gap-2"><span className="font-mono font-extrabold" style={{ color: scoreColor(h.health_score) }}>{h.health_score}</span><RiskBadge level={h.risk_level} /></div>
              <span className="text-slate-400">{new Date(h.created_at + 'Z').toLocaleString()} · <span className="font-mono">{h.ai_source}</span></span>
            </li>))}</ul>
        </div>
      </motion.div>

      <Modal open={edit} onClose={() => setEdit(false)} title={`Edit ${p.full_name}`} wide>
        <PatientForm initial={p} onSaved={() => { setEdit(false); load() }} onCancel={() => setEdit(false)} />
      </Modal>
      <Modal open={Boolean(plan)} onClose={() => setPlan(null)} title={`AI care plan — ${p.full_name}`} wide>
        {plan && <CarePlan plan={plan.plan} source={plan.source} />}
      </Modal>
    </div>
  )
}

const PLAN_SECTIONS = [
  { k: 'lifestyle', label: 'Lifestyle', tone: 'text-mint-500' },
  { k: 'diet', label: 'Diet', tone: 'text-amber-500' },
  { k: 'monitoring', label: 'Monitoring & tests', tone: 'text-pulse-500' },
  { k: 'follow_up', label: 'Follow-up', tone: 'text-violet-500' },
  { k: 'red_flags', label: 'Red flags — seek care if', tone: 'text-rose-500' },
]

function CarePlan({ plan, source }) {
  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      {plan.overview && <p className="rounded-xl bg-pulse-500/10 px-4 py-3 text-sm leading-relaxed">{plan.overview}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {PLAN_SECTIONS.filter((s) => plan[s.k]?.length).map((s) => (
          <div key={s.k} className="rounded-xl border border-slate-200 p-4 dark:border-ink-600">
            <h4 className={`mb-2 text-xs font-bold uppercase tracking-wider ${s.tone}`}>{s.label}</h4>
            <ul className="space-y-1.5">
              {plan[s.k].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <CheckCircle2 size={14} className={`mt-0.5 shrink-0 ${s.tone}`} />{item}
                </li>))}
            </ul>
          </div>))}
      </div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">source: {source} · screening aid only — not a medical diagnosis</p>
    </div>
  )
}
