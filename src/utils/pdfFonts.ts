import { Font } from '@react-pdf/renderer'

let fontsRegistered = false

export function registerPDFFonts() {
  if (fontsRegistered) return
  fontsRegistered = true

  const fonts = [
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAw.ttf',
      fontWeight: 700,
    },
  ]

  // Register as 'Roboto'
  Font.register({ family: 'Roboto', fonts })

  // Register same fonts as 'sans-serif' alias — catches any missed occurrences
  Font.register({ family: 'sans-serif', fonts })

  // Register as 'Helvetica' alias too — catches old references
  Font.register({ family: 'Helvetica', fonts })

  // Register bold variants
  Font.register({ family: 'Helvetica-Bold', fonts: [{ src: fonts[1].src, fontWeight: 700 }] })

  Font.registerHyphenationCallback((word) => [word])

  console.log('PDF fonts registered: Roboto, sans-serif, Helvetica aliases')
}
