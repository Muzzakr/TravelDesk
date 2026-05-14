'use client'

import { useRef, useState, useEffect } from 'react'

interface FileUploadProps {
  onFile: (file: File) => void
  onClear?: () => void
  file?: File | null
  accept?: string
  label?: string
  hint?: string
  disabled?: boolean
}

export function FileUpload({
  onFile,
  onClear,
  file,
  accept = 'image/*,application/pdf',
  label = 'Upload file',
  hint = 'PNG, JPG, PDF up to 10 MB',
  disabled,
}: FileUploadProps) {
  const inputRef        = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [file])

  function handleFile(f: File) {
    onFile(f)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    if (inputRef.current) inputRef.current.value = ''
    onClear?.()
  }

  return (
    <div className="relative">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files[0]
          if (f) handleFile(f)
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 transition-colors ${
          dragging ? 'border-indigo-400 bg-indigo-50' : file ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          title={label}
          className="hidden"
          disabled={disabled}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {previewUrl ? (
          <img src={previewUrl} alt="Preview" className="max-h-24 rounded-xl object-contain mx-auto mb-3" />
        ) : (
          <svg className="mb-2 h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        )}

        <p className="text-sm font-medium text-gray-700">
          {file ? file.name : label}
        </p>
        <p className="mt-1 text-xs text-gray-400">{file ? 'Click to replace' : hint}</p>
      </div>

      {file && onClear && (
        <button
          type="button"
          onClick={handleClear}
          title="Remove file"
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center hover:bg-red-200 transition-colors"
        >
          ×
        </button>
      )}
    </div>
  )
}
