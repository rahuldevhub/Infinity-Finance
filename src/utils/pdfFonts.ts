import { Font } from '@react-pdf/renderer'
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './fontBase64'

let fontsRegistered = false

export function registerPDFFonts() {
  if (fontsRegistered) return
  fontsRegistered = true

  const fonts = [
    { src: ROBOTO_REGULAR, fontWeight: 400 },
    { src: ROBOTO_BOLD, fontWeight: 700 },
  ]

  // Register under ALL possible names used in PDF components
  Font.register({ family: 'Roboto', fonts })
  Font.register({ family: 'sans-serif', fonts })
  Font.register({ family: 'Helvetica', fonts })
  Font.register({ family: 'Helvetica-Bold', fonts: [{ src: ROBOTO_BOLD, fontWeight: 700 }] })

  Font.registerHyphenationCallback((word) => [word])
  console.log('PDF fonts registered from base64')
}
