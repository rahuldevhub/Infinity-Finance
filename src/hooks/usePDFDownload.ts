import { useState } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { downloadPDF } from '../utils/downloadPDF'

export function usePDFDownload() {
  const [loading, setLoading] = useState(false)

  const download = async (
    documentElement: ReactElement<DocumentProps>,
    filename: string
  ) => {
    setLoading(true)
    try {
      await downloadPDF(documentElement, filename)
    } finally {
      setLoading(false)
    }
  }

  return { downloadPDF: download, loading }
}
