import { pdf } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { registerPDFFonts } from './pdfFonts'

export async function downloadPDF(
  document: ReactElement,
  filename: string
): Promise<void> {
  registerPDFFonts()

  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`

  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        console.log('Starting PDF generation for:', safeFilename)

        const pdfInstance = pdf()
        pdfInstance.updateContainer(document)

        const blob = await pdfInstance.toBlob()
        console.log('PDF blob generated, size:', blob.size)

        if (!blob || blob.size === 0) {
          throw new Error('Generated PDF blob is empty')
        }

        const url = URL.createObjectURL(blob)
        const link = window.document.createElement('a')
        link.href = url
        link.download = safeFilename
        link.style.position = 'absolute'
        link.style.left = '-9999px'
        window.document.body.appendChild(link)
        link.click()

        setTimeout(() => {
          window.document.body.removeChild(link)
          URL.revokeObjectURL(url)
          resolve()
        }, 200)
      } catch (error) {
        console.error('=== PDF GENERATION FAILED ===', error)
        console.error('Error object:', error)
        console.error('Error message:', error instanceof Error ? error.message : String(error))
        console.error('Error stack:', error instanceof Error ? error.stack : 'no stack')

        const msg = error instanceof Error
          ? `${error.name}: ${error.message}`
          : JSON.stringify(error)
        alert(`PDF Error Details:\n\n${msg}\n\nCheck browser console for more info.`)
        reject(error)
      }
    }, 100)
  })
}
