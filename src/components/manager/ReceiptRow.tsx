'use client'

import { useState, useEffect } from 'react'
import { FileText, Image as ImageIcon } from 'lucide-react'
import { ReceiptViewer } from '@/components/ui/ReceiptViewer'

export function ReceiptRow({ id, fileName }: { id: string; fileName: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [viewing, setViewing] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/receipts/${id}/url`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { url?: string } | null) => { if (active && d?.url) setUrl(d.url) })
      .catch(() => {})
    return () => { active = false }
  }, [id])

  const isPdf = fileName.toLowerCase().endsWith('.pdf')

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        {isPdf
          ? <FileText className="w-4 h-4 text-gray-400 shrink-0" />
          : <ImageIcon className="w-4 h-4 text-gray-400 shrink-0" />}
        <span className="truncate text-gray-700">{fileName}</span>
      </div>
      {url ? (
        <button type="button" onClick={() => setViewing(true)}
          className="ml-3 shrink-0 py-2 text-sm font-medium text-indigo-600 hover:underline">
          Open →
        </button>
      ) : (
        <span className="ml-3 shrink-0 text-xs text-gray-400">Loading…</span>
      )}
      {viewing && url && (
        <ReceiptViewer url={url} fileName={fileName} onClose={() => setViewing(false)} />
      )}
    </div>
  )
}
