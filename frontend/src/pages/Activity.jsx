import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity as ActivityIcon, Download, FilePlus, FileText, KeyRound, Pencil, RefreshCw, Trash2, Upload, UserRound } from 'lucide-react'
import api from '../api/client'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { Empty, PageHeader, SkeletonCard } from '../components/ui'

const META = {
  'patient.created': { icon: FilePlus, label: 'added', tone: 'text-mint-500 bg-mint-500/10' },
  'patient.updated': { icon: Pencil, label: 'updated', tone: 'text-pulse-500 bg-pulse-500/10' },
  'patient.deleted': { icon: Trash2, label: 'deleted', tone: 'text-rose-500 bg-rose-500/10' },
  'patient.exported': { icon: Download, label: 'exported', tone: 'text-amber-500 bg-amber-500/10' },
  'patient.imported': { icon: Upload, label: 'imported', tone: 'text-violet-500 bg-violet-500/10' },
  'patient.remarks_regenerated': { icon: RefreshCw, label: 'AI re-run', tone: 'text-pulse-500 bg-pulse-500/10' },
  'patient.report_downloaded': { icon: FileText, label: 'PDF report', tone: 'text-slate-500 bg-slate-500/10' },
  'user.profile_updated': { icon: UserRound, label: 'profile updated', tone: 'text-pulse-500 bg-pulse-500/10' },
  'user.password_changed': { icon: KeyRound, label: 'password changed', tone: 'text-amber-500 bg-amber-500/10' },
}

export default function ActivityPage() {
  const [items, setItems] = useState(null)
  const load = useCallback(async () => setItems((await api.get('/api/audit?limit=100')).data), [])
  useEffect(() => { load() }, [load])
  useLiveEvents(load)

  return (
    <div>
      <PageHeader title="Activity log" subtitle="Every mutation is written to the audit_logs table — who did what, and when." />
      <div className="card divide-y divide-slate-100 dark:divide-ink-600/50">
        {items === null && <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <SkeletonCard key={i} h="h-12" />)}</div>}
        {items?.length === 0 && <Empty icon={ActivityIcon} title="Nothing yet" body="Create, edit or delete a patient and it will show up here instantly." />}
        {items?.map((e, i) => {
          const m = META[e.action] || { icon: ActivityIcon, label: e.action, tone: 'text-slate-500 bg-slate-500/10' }
          const I = m.icon
          return (
            <motion.div key={e.id} className="flex items-center gap-4 px-5 py-3.5" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * .03 }}>
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${m.tone}`}><I size={16} /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm"><span className="font-bold">{e.detail}</span> <span className="text-slate-400">· {m.label}</span></p>
                {e.entity_id && <p className="text-[11px] text-slate-400">record #{e.entity_id}</p>}
              </div>
              <time className="shrink-0 font-mono text-[11px] text-slate-400">{new Date(e.created_at + 'Z').toLocaleString()}</time>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
