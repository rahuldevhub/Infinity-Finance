import { Font } from '@react-pdf/renderer'

let fontsRegistered = false

export function registerPDFFonts() {
  if (fontsRegistered) return
  fontsRegistered = true

  try {
    Font.register({
      family: 'Roboto',
      fonts: [
        {
          src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf',
          fontWeight: 400,
        },
        {
          src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAw.ttf',
          fontWeight: 700,
        },
      ],
    })

    Font.registerHyphenationCallback((word) => [word])
    console.log('PDF fonts registered successfully')
  } catch (err) {
    console.error('Font registration failed:', err)
  }
}
