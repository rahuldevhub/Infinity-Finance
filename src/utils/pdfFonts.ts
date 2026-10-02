import { Font } from '@react-pdf/renderer'

let registered = false

export function registerPDFFonts() {
  if (registered) return
  registered = true
  const fontBase = (globalThis as typeof globalThis & { __PDF_FONT_BASE__?: string }).__PDF_FONT_BASE__ || ''
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: `${fontBase}/fonts/Roboto-Regular.ttf`, fontWeight: 400 },
      { src: `${fontBase}/fonts/Roboto-Bold.ttf`, fontWeight: 700 },
    ],
  })
  Font.registerHyphenationCallback((word) => [word])
}
