import { useState } from 'react'
import toast from 'react-hot-toast'
import { FileUp, Upload } from 'lucide-react'
import api, { errorMessages } from '../api/client'

export default function ImportModal({ onDone }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const upload = async () => {
    if (!file) return
    setBusy(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const { data } = await api.post('/api/patients/import', fd)
      setResult(data); toast.success(`${data.created} imported, ${data.failed} rejected`); onDone?.()
    } catch (err) { errorMessages(err).forEach((m) => toast.error(m)) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">CSV with columns <code className="kbd">full_name, date_of_birth, email, glucose, haemoglobin, cholesterol</code>. Every row runs through the same validation + AI pipeline as the form.</p>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-pulse-400 hover:bg-pulse-500/5 dark:border-ink-600">
        <FileUp size={26} className="text-pulse-500" />
        <span className="text-sm font-semibold">{file ? file.name : 'Choose a .csv file'}</span>
        <input type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
      </label>
      {result && (
        <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-ink-700/60">
          <p><span className="font-bold text-mint-500">{result.created} created</span> · <span className="font-bold text-rose-500">{result.failed} rejected</span></p>
          {result.errors?.length > 0 && <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-slate-500">{result.errors.map((e, i) => <li key={i} className="font-mono">row {e.row}: {e.errors.join('; ')}</li>)}</ul>}
        </div>)}
      <div className="flex justify-end"><button className="btn-primary" disabled={!file || busy} onClick={upload}><Upload size={16} /> {busy ? 'Importing…' : 'Import'}</button></div>
    </div>
  )
}
