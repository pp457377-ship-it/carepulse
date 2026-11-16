import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { AlertTriangle, ArrowUpDown, ChevronLeft, ChevronRight, Download, Eye, Pencil, Plus, Search, Sparkles, Trash2, Upload, Users, Wand2 } from 'lucide-react'
import api, { errorMessages, tokens } from '../api/client'
import { useLiveEvents } from '../hooks/useLiveEvents'
import PatientForm from '../components/PatientForm'
import ImportModal from '../components/ImportModal'
import { Empty, Modal, PageHeader, RiskBadge, SkeletonRows, scoreColor } from '../components/ui'

const PAGE = 10

export default function Patients() {
  const [data, setData] = useState(null)
  const [q, setQ] = useState('')
  const [risk, setRisk] = useState('')
  const [sort, setSort] = useState('created_at:desc')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null) // {type:'create'|'edit'|'remarks'|'delete'|'import', p}
  const [dupes, setDupes] = useState([])

  const load = useCallback(async () => {
    const [r, d] = await Promise.all([
      api.get('/api/patients', { params: { q: q || undefined, risk: risk || undefined, sort, page, page_size: PAGE } }),
      api.get('/api/patients/duplicates'),
    ])
    setData(r.data); setDupes(d.data.groups)
  }, [q, risk, sort, page])
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t) }, [load, q])
  useLiveEvents(load)

  const toggleSort = (col) => setSort((s) => { const [c, d] = s.split(':'); return `${col}:${c === col && d === 'asc' ? 'desc' : 'asc'}` })
  const del = async () => {
    try { await api.delete(`/api/patients/${modal.p.id}`); toast.success(`${modal.p.full_name} deleted`); setModal(null); load() }
    catch (e) { errorMessages(e).forEach((m) => toast.error(m)) }
  }
  const exportCsv = async () => {
    const r = await fetch('/api/patients/export.csv', { headers: { Authorization: `Bearer ${tokens.access}` } })
    const url = URL.createObjectURL(await r.blob()); const a = document.createElement('a'); a.href = url; a.download = 'carepulse-patients.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1
  const dupeNames = new Set(dupes.flatMap((g) => g.patients.map((p) => p.id)))

  return (
    <div>
      <PageHeader title="Patients" subtitle={data ? `${data.total} record${data.total === 1 ? '' : 's'} · every save re-runs validation + AI assessment` : 'Loading…'}>
        <button className="btn-ghost" onClick={() => setModal({ type: 'intake' })}><Wand2 size={16} /> Smart intake</button>
        <button className="btn-ghost" onClick={() => setModal({ type: 'import' })}><Upload size={16} /> Import CSV</button>
        <button className="btn-ghost" onClick={exportCsv}><Download size={16} /> Export CSV</button>
        <button className="btn-primary" onClick={() => setModal({ type: 'create' })}><Plus size={16} /> Add patient</button>
      </PageHeader>

      <AnimatePresence>{dupes.length > 0 && (
        <motion.div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <div><p className="font-bold text-amber-600 dark:text-amber-400">Data-quality warning: {dupes.length} possible duplicate group{dupes.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-slate-500">{dupes.map((g) => `${g.patients[0].full_name} (${g.patients.map((p) => p.email).join(', ')})`).join(' · ')} — same name, different email. Flagged rows are marked below.</p></div>
        </motion.div>)}</AnimatePresence>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-ink-600/50">
          <div className="relative flex-1 min-w-[220px]"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input !pl-10" placeholder="Search name or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} /></div>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-ink-700">{['', 'low', 'moderate', 'high'].map((r) => (
            <button key={r} onClick={() => { setRisk(r); setPage(1) }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${risk === r ? 'bg-white shadow dark:bg-ink-800' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>{r || 'All'}</button>))}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:bg-ink-800/60">
              <tr>
                <Th onClick={() => toggleSort('full_name')} active={sort.startsWith('full_name')}>Patient</Th>
                <th className="px-4 py-3">DOB</th>
                <Th onClick={() => toggleSort('glucose')} active={sort.startsWith('glucose')}>Glucose</Th>
                <Th onClick={() => toggleSort('haemoglobin')} active={sort.startsWith('haemoglobin')}>Hb</Th>
                <Th onClick={() => toggleSort('cholesterol')} active={sort.startsWith('cholesterol')}>Chol.</Th>
                <Th onClick={() => toggleSort('health_score')} active={sort.startsWith('health_score')}>Score</Th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">AI remarks</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-ink-600/50">
              {data === null && <SkeletonRows cols={9} />}
              {data?.items.length === 0 && <tr><td colSpan={9}><Empty icon={Users} title={q || risk ? 'No matches' : 'No patients yet'} body={q || risk ? 'Try a different search or filter.' : 'Add your first patient, or import a CSV with full_name, date_of_birth, email, glucose, haemoglobin, cholesterol columns.'} action={!q && !risk && <div className="flex gap-2"><button className="btn-primary" onClick={() => setModal({ type: 'create' })}><Plus size={16} /> Add patient</button><button className="btn-ghost" onClick={() => setModal({ type: 'import' })}><Upload size={16} /> Import CSV</button></div>} /></td></tr>}
              <AnimatePresence initial={false}>{data?.items.map((p) => (
                <motion.tr key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} className="group hover:bg-slate-50/80 dark:hover:bg-ink-700/40">
                  <td className="px-4 py-3"><Link to={`/patients/${p.id}`} className="font-bold hover:text-pulse-500">{p.full_name}</Link>{dupeNames.has(p.id) && <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-500">DUP?</span>}<p className="text-xs text-slate-400">{p.email}</p></td>
                  <td className="px-4 py-3 font-mono text-xs">{p.date_of_birth}</td>
                  <td className="px-4 py-3 font-mono">{p.glucose}</td>
                  <td className="px-4 py-3 font-mono">{p.haemoglobin}</td>
                  <td className="px-4 py-3 font-mono">{p.cholesterol}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200 dark:bg-ink-600"><motion.div className="h-full rounded-full" style={{ background: scoreColor(p.health_score) }} initial={{ width: 0 }} animate={{ width: `${p.health_score}%` }} /></div><span className="font-mono text-xs font-bold" style={{ color: scoreColor(p.health_score) }}>{p.health_score}</span></div></td>
                  <td className="px-4 py-3"><RiskBadge level={p.risk_level} /></td>
                  <td className="max-w-[260px] px-4 py-3"><button onClick={() => setModal({ type: 'remarks', p })} className="line-clamp-2 text-left text-xs text-slate-500 hover:text-pulse-500">{p.remarks}</button></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1 opacity-60 transition group-hover:opacity-100">
                    <Link to={`/patients/${p.id}`} className="rounded-lg p-2 hover:bg-pulse-500/10 hover:text-pulse-500" title="View"><Eye size={15} /></Link>
                    <button onClick={() => setModal({ type: 'edit', p })} className="rounded-lg p-2 hover:bg-pulse-500/10 hover:text-pulse-500" title="Edit"><Pencil size={15} /></button>
                    <button onClick={() => setModal({ type: 'delete', p })} className="rounded-lg p-2 hover:bg-rose-500/10 hover:text-rose-500" title="Delete"><Trash2 size={15} /></button></div></td>
                </motion.tr>))}</AnimatePresence>
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-400 dark:border-ink-600/50">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-1"><button className="btn-ghost !px-2 !py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /></button><button className="btn-ghost !px-2 !py-1" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={14} /></button></div>
        </div>
      </div>

      <Modal open={modal?.type === 'create' || modal?.type === 'edit'} onClose={() => setModal(null)} title={modal?.type === 'edit' ? `Edit ${modal.p.full_name}` : 'Add patient'} wide>
        {modal && <PatientForm initial={modal.type === 'edit' ? modal.p : null} prefill={modal.prefill} onSaved={() => { setModal(null); load() }} onCancel={() => setModal(null)} />}
      </Modal>
      <Modal open={modal?.type === 'intake'} onClose={() => setModal(null)} title="Smart intake — free text to patient record">
        <SmartIntake onParsed={(fields) => setModal({ type: 'create', prefill: fields })} />
      </Modal>
      <Modal open={modal?.type === 'remarks'} onClose={() => setModal(null)} title="AI remarks">
        {modal?.p && <div className="space-y-3"><div className="flex items-center gap-2"><RiskBadge level={modal.p.risk_level} /><span className="text-xs text-slate-400">score {modal.p.health_score} · source: <span className="font-mono">{modal.p.ai_source}</span></span></div><p className="text-sm leading-relaxed">{modal.p.remarks}</p><Link to={`/patients/${modal.p.id}`} className="btn-primary !mt-4">Open full assessment</Link></div>}
      </Modal>
      <Modal open={modal?.type === 'delete'} onClose={() => setModal(null)} title="Delete patient?">
        <p className="text-sm text-slate-500">This permanently removes <span className="font-bold text-slate-800 dark:text-slate-100">{modal?.p?.full_name}</span> and all assessment history. The list refreshes immediately.</p>
        <div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn-danger" onClick={del}><Trash2 size={16} /> Delete</button></div>
      </Modal>
      <Modal open={modal?.type === 'import'} onClose={() => setModal(null)} title="Import patients from CSV"><ImportModal onDone={load} /></Modal>
    </div>
  )
}

function Th({ children, onClick, active }) {
  return <th className="px-4 py-3"><button onClick={onClick} className={`flex items-center gap-1 uppercase ${active ? 'text-pulse-500' : ''}`}>{children}<ArrowUpDown size={11} /></button></th>
}

const INTAKE_KEYS = ['full_name', 'date_of_birth', 'email', 'glucose', 'haemoglobin', 'cholesterol']

function SmartIntake({ onParsed }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const parse = async () => {
    setBusy(true)
    try {
      const { data } = await api.post('/api/ai/parse-intake', { text })
      const fields = Object.fromEntries(INTAKE_KEYS.map((k) => [k, data.fields[k] != null ? String(data.fields[k]) : '']))
      const found = INTAKE_KEYS.filter((k) => fields[k]).length
      if (!found) return toast.error('Could not extract any fields — try adding more detail')
      toast.success(`Extracted ${found} field${found > 1 ? 's' : ''} (${data.source}) — review and save`)
      onParsed(fields)
    } catch (e) { errorMessages(e).forEach((m) => toast.error(m)) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Paste a referral note, email or dictation — AI extracts name, DOB, email and the three lab markers into the form.</p>
      <textarea className="input min-h-32 font-mono text-xs" placeholder={'e.g. Robyn Pears, born 28 Jan 1960, robyn@gmail.com — glucose 110, Hb 13.2, chol 185'} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button className="btn-primary" disabled={busy || text.trim().length < 5} onClick={parse}>
          <Sparkles size={15} className={busy ? 'animate-pulse' : ''} /> {busy ? 'Parsing…' : 'Parse with AI'}
        </button>
      </div>
    </div>
  )
}
