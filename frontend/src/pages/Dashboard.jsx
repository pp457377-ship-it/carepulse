import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowRight, BrainCircuit, Gauge, HeartPulse, ShieldAlert, ShieldCheck, Users } from 'lucide-react'
import api from '../api/client'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { PageHeader, RiskBadge, SkeletonCard, StatCard, scoreColor } from '../components/ui'

const RISK_COLORS = { low: '#10b981', moderate: '#f59e0b', high: '#f43f5e' }
const tip = { contentStyle: { background: '#111827', border: '1px solid #243049', borderRadius: 12, fontSize: 12, color: '#e2e8f0' } }

export default function Dashboard() {
  const [s, setS] = useState(null)
  const [t, setT] = useState(null)
  const [insight, setInsight] = useState(null)
  const [insightBusy, setInsightBusy] = useState(false)
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([api.get('/api/analytics/summary'), api.get('/api/analytics/trends')])
    setS(a.data); setT(b.data)
  }, [])
  useEffect(() => { load() }, [load])
  const { events } = useLiveEvents(load)

  const genInsights = async () => {
    setInsightBusy(true)
    try { const { data } = await api.post('/api/ai/panel-insights'); setInsight(data) }
    catch { /* toast-less: card stays in empty state */ } finally { setInsightBusy(false) }
  }

  if (!s) return <div className="grid gap-4 md:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}</div>

  const pie = Object.entries(s.risk_counts).map(([name, value]) => ({ name, value })).filter((d) => d.value)
  const avgs = [
    { name: 'Glucose', value: s.avg_glucose }, { name: 'Haemoglobin', value: s.avg_haemoglobin }, { name: 'Cholesterol', value: s.avg_cholesterol },
  ]

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live overview of screened patients, risk flags and AI health scores.">
        <Link to="/patients" className="btn-primary">Manage patients <ArrowRight size={16} /></Link>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard icon={Users} label="Patients" value={s.total_patients} hint="records in database" tone="pulse" />
        <StatCard icon={ShieldAlert} label="High risk" value={s.risk_counts.high} hint="need clinical follow-up" tone="rose" delay={.05} />
        <StatCard icon={AlertTriangle} label="Moderate" value={s.risk_counts.moderate} hint="borderline markers" tone="amber" delay={.1} />
        <StatCard icon={ShieldCheck} label="Low risk" value={s.risk_counts.low} hint="within normal range" tone="mint" delay={.15} />
        <StatCard icon={Gauge} label="Avg score" value={s.avg_health_score} hint="0–100 health score" tone="violet" delay={.2} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Risk distribution">
          {pie.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3} stroke="none">
                {pie.map((d) => <Cell key={d.name} fill={RISK_COLORS[d.name]} />)}</Pie><Tooltip {...tip} /></PieChart>
            </ResponsiveContainer>) : <Blank />}
          <div className="flex justify-center gap-4 text-xs">{Object.entries(RISK_COLORS).map(([k, c]) => <span key={k} className="flex items-center gap-1.5 capitalize text-slate-400"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{k}</span>)}</div>
        </Card>
        <Card title="Average lab values">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={avgs} barSize={38}><XAxis dataKey="name" interval={0} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><Tooltip {...tip} cursor={{ fill: 'rgba(148,163,184,.08)' }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>{avgs.map((_, i) => <Cell key={i} fill={['#06b6d4', '#10b981', '#8b5cf6'][i]} />)}</Bar></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Live activity">
          {events.length === 0 ? <p className="py-8 text-center text-xs text-slate-400">No events yet — add a patient and watch it appear here.</p> : (
            <ul className="space-y-2">{events.slice(0, 7).map((e, i) => (
              <motion.li key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-ink-700/60" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                <span className="truncate"><span className="font-bold">{e.data.full_name || `${e.data.created} imported`}</span> <span className="text-slate-400">{e.event.split('.')[1]}</span></span>
                <time className="ml-2 shrink-0 font-mono text-slate-400">{e.at.toLocaleTimeString()}</time>
              </motion.li>))}</ul>)}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card title="Glucose distribution" className="lg:col-span-3">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={t?.glucose_distribution || []} barSize={44}><XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><Tooltip {...tip} cursor={{ fill: 'rgba(148,163,184,.08)' }} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>{(t?.glucose_distribution || []).map((_, i) => <Cell key={i} fill={['#10b981', '#10b981', '#f59e0b', '#fb923c', '#f43f5e'][i]} />)}</Bar></BarChart>
          </ResponsiveContainer>
          <p className="mt-1 text-center text-[11px] text-slate-400">mg/dL buckets · &lt;70 low · 70–99 normal · 100–125 prediabetes · 126+ diabetes range</p>
        </Card>
        <Card title="Needs attention" className="lg:col-span-2">
          {s.top_risk.length === 0 ? <Blank /> : (
            <ul className="space-y-2">{s.top_risk.map((p, i) => (
              <motion.li key={p.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .05 }}>
                <Link to={`/patients/${p.id}`} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 transition hover:border-pulse-400 hover:bg-pulse-500/5 dark:border-ink-600">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold" style={{ color: scoreColor(p.health_score), background: scoreColor(p.health_score) + '1a' }}>{p.health_score}</span>
                    <div><p className="text-sm font-bold">{p.full_name}</p><p className="text-[11px] text-slate-400">{p.email}</p></div>
                  </div>
                  <RiskBadge level={p.risk_level} />
                </Link>
              </motion.li>))}</ul>)}
        </Card>
      </div>

      <div className="mt-6">
        <Card title={<span className="flex items-center gap-2"><BrainCircuit size={16} className="text-pulse-500" /> AI panel insights</span>}
          action={<button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={genInsights} disabled={insightBusy || !s.total_patients}>{insightBusy ? 'Analysing…' : insight ? 'Re-generate' : 'Generate'}</button>}>
          {insightBusy ? (
            <div className="space-y-2 py-2">{[80, 60, 90, 45].map((w, i) => <div key={i} className="skeleton h-3.5" style={{ width: `${w}%` }} />)}</div>
          ) : insight ? (
            <div className="space-y-1 text-sm leading-relaxed">
              <InsightText text={insight.insights} />
              <p className="pt-2 text-[10px] font-mono uppercase tracking-wider text-slate-400">source: {insight.source} · {insight.patient_count} patients analysed</p>
            </div>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center text-slate-400">
              <BrainCircuit size={24} />
              <p className="mt-2 max-w-md text-center text-xs">{s.total_patients ? 'AI reviews your whole panel and writes an insight brief — priorities, patterns, suggested actions.' : 'Add patients first, then AI can analyse the panel.'}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function Card({ title, children, className = '', action }) {
  return <motion.div className={`card p-5 ${className}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}>
    <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">{title}</h3>{action}</div>{children}</motion.div>
}

function InsightText({ text }) {
  return text.split('\n').map((line, i) => {
    const t = line.trim()
    if (!t) return null
    if (t.startsWith('**') && t.endsWith('**'))
      return <p key={i} className="pt-2 text-xs font-bold uppercase tracking-wider text-pulse-500">{t.replaceAll('**', '')}</p>
    if (t.startsWith('- ') || t.startsWith('• '))
      return <p key={i} className="flex gap-2 text-slate-600 dark:text-slate-300"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pulse-500" /><span>{t.slice(2)}</span></p>
    return <p key={i} className="text-slate-600 dark:text-slate-300">{t}</p>
  })
}
function Blank() { return <div className="flex h-40 flex-col items-center justify-center text-slate-400"><HeartPulse size={24} /><p className="mt-2 text-xs">No records yet</p></div> }
