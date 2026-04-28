import { Font } from '@react-pdf/renderer'

let fontsRegistered = false

export function registerPDFFonts() {
  if (fontsRegistered) return
  fontsRegistered = true

  // Use local font files served from /public/fonts/
  // These are bundled with the app — no external CDN dependency
  const regularFont = '/fonts/Roboto-Regular.ttf'
  const boldFont = '/fonts/Roboto-Bold.ttf'

  const fontConfig = {
    family: 'Roboto',
    fonts: [
      { src: regularFont, fontWeight: 400 },
      { src: boldFont, fontWeight: 700 },
    ],
  }

  // Register under all names that might be used in PDF components
  Font.register(fontConfig)
  Font.register({ ...fontConfig, family: 'sans-serif' })
  Font.register({ ...fontConfig, family: 'Helvetica' })
  Font.register({
    family: 'Helvetica-Bold',
    fonts: [{ src: boldFont, fontWeight: 700 }],
  })

  Font.registerHyphenationCallback((word) => [word])
}
