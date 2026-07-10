'use client'

import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useModalDismiss } from '@/lib/use-modal-dismiss'

export function ReceiptViewer({ url, fileName, onClose }: { url: string; fileName: string; onClose: () => void }) {
  const dismissRef = useModalDismiss<HTMLDivElement>(true, onClose)
  const isPdf = fileName.toLowerCase().endsWith('.pdf')

  return (
    <div ref={dismissRef} className="fixed inset-0 z-[110] flex flex-col bg-black/95">
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <p className="min-w-0 flex-1 truncate text-sm text-white/70">{fileName}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in new tab"
          className="inline-flex shrink-0 items-center rounded-lg p-2.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
      <div className="flex-1 overflow-auto p-3 sm:p-6 flex items-center justify-center" onClick={onClose}>
        {isPdf ? (
          <iframe src={url} title={fileName} className="h-full w-full max-w-3xl rounded-lg bg-white" onClick={(e) => e.stopPropagation()} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={fileName} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        )}
      </div>
    </div>
  )
}
