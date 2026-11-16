import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import api, { errorMessages } from '../api/client'

const EMPTY = { full_name: '', date_of_birth: '', email: '', glucose: '', haemoglobin: '', cholesterol: '' }
const FIELDS = [
  { k: 'full_name', label: 'Full name', ph: 'Rahul Sharma', col: 2 },
  { k: 'date_of_birth', label: 'Date of birth', ph: 'dd/mm/yyyy (dots also accepted)', col: 1 },
  { k: 'email', label: 'Email', ph: 'name@example.com', col: 1 },
  { k: 'glucose', label: 'Glucose (mg/dL)', ph: '70 – 99 normal', col: 1, mono: true },
  { k: 'haemoglobin', label: 'Haemoglobin (g/dL)', ph: '12 – 17.5 normal', col: 1, mono: true },
  { k: 'cholesterol', label: 'Cholesterol (mg/dL)', ph: '< 200 normal', col: 1, mono: true },
]
const KEYWORDS = { full_name: /name/i, date_of_birth: /birth|date/i, email: /email/i, glucose: /glucose/i, haemoglobin: /haemoglobin/i, cholesterol: /cholesterol/i }

export default function PatientForm({ initial, onSaved, onCancel, prefill }) {
  const isEdit = Boolean(initial?.id)
  const [form, setForm] = useState(initial ? pick(initial) : (prefill ?? EMPTY))
  const [errors, setErrors] = useState([])
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const timer = useRef()

  // Dry-run validation against POST /api/patients/validate — same rules as save, nothing persisted.
  useEffect(() => {
    const filled = Object.values(form).every((v) => String(v).trim() !== '')
    if (!filled) { setChecked(false); return }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setChecking(true)
      try {
        const { data } = await api.post('/api/patients/validate', form, { params: initial?.id ? { exclude_id: initial.id } : {} })
        setErrors(data.errors); setChecked(true)
      } catch { /* ignore */ } finally { setChecking(false) }
    }, 400)
    return () => clearTimeout(timer.current)
  }, [form, initial?.id])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const fieldErr = (k) => errors.filter((e) => KEYWORDS[k].test(e))
  const generalErr = errors.filter((e) => !Object.values(KEYWORDS).some((re) => re.test(e)))

  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      const r = isEdit ? await api.put(`/api/patients/${initial.id}`, form) : await api.post('/api/patients', form)
      toast.success(isEdit ? 'Patient updated' : `Saved — ${r.data.risk_level} risk, score ${r.data.health_score}`)
      onSaved(r.data)
    } catch (err) {
      const msgs = errorMessages(err); setErrors(msgs); setChecked(true)
      toast.error(`${msgs.length} validation error${msgs.length > 1 ? 's' : ''}`)
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const errs = fieldErr(f.k)
          return (
            <div key={f.k} className={f.col === 2 ? 'sm:col-span-2' : ''}>
              <label className="label">{f.label}</label>
              <input className={`input ${errs.length ? 'input-error' : ''} ${f.mono ? 'font-mono' : ''}`} placeholder={f.ph} value={form[f.k]} onChange={set(f.k)} />
              <AnimatePresence>{errs.map((m) => (
                <motion.p key={m} className="mt-1 flex items-start gap-1 text-xs text-rose-500" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}><AlertCircle size={12} className="mt-0.5 shrink-0" />{m}</motion.p>))}</AnimatePresence>
            </div>)
        })}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-2.5 text-xs dark:border-ink-600">
        {checking ? <><Loader2 size={14} className="animate-spin text-pulse-500" /> Checking with server…</>
          : !checked ? <span className="text-slate-400">Fill every field — the server pre-validates before you save.</span>
          : errors.length === 0 ? <><CheckCircle2 size={14} className="text-mint-500" /> <span className="font-semibold text-mint-500">All checks pass</span> — ready to save</>
          : <><AlertCircle size={14} className="text-rose-500" /> <span className="font-semibold text-rose-500">{errors.length} issue{errors.length > 1 ? 's' : ''}</span> found — all shown at once, fix them to continue</>}
      </div>
      {generalErr.map((m) => <p key={m} className="flex items-center gap-1 text-xs text-rose-500"><AlertCircle size={12} />{m}</p>)}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={busy || (checked && errors.length > 0)}>{busy ? 'Saving & running AI…' : isEdit ? 'Save changes' : 'Create patient'}</button>
      </div>
    </form>
  )
}

function pick(p) { return { full_name: p.full_name, date_of_birth: p.date_of_birth, email: p.email, glucose: p.glucose, haemoglobin: p.haemoglobin, cholesterol: p.cholesterol } }
