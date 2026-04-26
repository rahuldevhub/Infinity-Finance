import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

export function usePDFDownload() {
  const [loading, setLoading] = useState(false)

  const downloadPDF = async (
    documentElement: ReactElement<DocumentProps>,
    filename: string
  ) => {
    try {
      setLoading(true)
      const blob = await pdf(documentElement).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('PDF generation error:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return { downloadPDF, loading }
}
