import { Font } from '@react-pdf/renderer'
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './fontBase64'

let fontsRegistered = false

export function registerPDFFonts() {
  if (fontsRegistered) return
  fontsRegistered = true

  const regular = { src: ROBOTO_REGULAR, fontWeight: 400 }
  const bold = { src: ROBOTO_BOLD, fontWeight: 700 }
  const fonts = [regular, bold]

  // Register ALL possible font family names — any unregistered name causes 'unitsPerEm' crash
  const families = [
    'Roboto',
    'sans-serif',
    'Helvetica',
    'Helvetica-Bold',
    'Helvetica-Oblique',
    'Helvetica-BoldOblique',
    'Times-Roman',
    'Times-Bold',
    'Courier',
    'Arial',
  ]

  families.forEach(family => {
    Font.register({ family, fonts })
  })

  Font.registerHyphenationCallback((word) => [word])
  console.log('PDF fonts registered from base64')
}
