'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Shared client-side table-to-PDF export, used by every "Export PDF" button
// across the dashboard. Landscape by default since most of these tables have
// enough columns that portrait would force tiny text.
export function exportPdf(title: string, header: string[], rows: (string | number)[][], filename: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFontSize(14)
  doc.setTextColor(30, 30, 30)
  doc.text(title, 14, 15)
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(`Generated ${new Date().toLocaleString('en-US')}`, 14, 21)

  autoTable(doc, {
    startY: 26,
    head: [header],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [99, 102, 241] },
  })

  doc.save(filename)
}
