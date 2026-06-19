'use client'

import { useState, useEffect } from 'react'
import { FileText, Image as ImageIcon } from 'lucide-react'

export function ReceiptRow({ id, fileName }: { id: string; fileName: string }) {
  const [url, setUrl] = useState<string | null>(null)

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
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="ml-3 shrink-0 text-sm font-medium text-indigo-600 hover:underline">
          Open →
        </a>
      ) : (
        <span className="ml-3 shrink-0 text-xs text-gray-400">Loading…</span>
      )}
    </div>
  )
}
