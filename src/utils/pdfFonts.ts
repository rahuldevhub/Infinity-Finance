import { Font } from '@react-pdf/renderer'
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './fontBase64'

let registered = false

export function registerPDFFonts() {
  if (registered) return
  registered = true

  const fonts = [
    { src: ROBOTO_REGULAR, fontWeight: 400 },
    { src: ROBOTO_BOLD, fontWeight: 700 },
  ]

  Font.register({ family: 'Roboto', fonts })
  Font.register({ family: 'sans-serif', fonts })
  Font.register({ family: 'Helvetica', fonts })
  Font.register({ family: 'Helvetica-Bold', fonts: [{ src: ROBOTO_BOLD, fontWeight: 700 }] })
  Font.register({ family: 'Helvetica-Oblique', fonts })
  Font.register({ family: 'Helvetica-BoldOblique', fonts })

  Font.registerHyphenationCallback((word) => [word])
}
