import { Font } from '@react-pdf/renderer'

let registered = false

export function registerFonts() {
  if (registered) return
  registered = true

  Font.register({
    family: 'Roboto',
    fonts: [
      {
        src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf',
        fontWeight: 'normal',
        fontStyle: 'normal',
      },
      {
        src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAw.ttf',
        fontWeight: 'bold',
        fontStyle: 'normal',
      },
      {
        src: 'https://fonts.gstatic.com/s/roboto/v30/KFOjCnqEu92Fr1Mu51TjASc6CsQ.ttf',
        fontWeight: 'normal',
        fontStyle: 'italic',
      },
      {
        src: 'https://fonts.gstatic.com/s/roboto/v30/KFOjCnqEu92Fr1Mu51TzBic6CsQ.ttf',
        fontWeight: 'bold',
        fontStyle: 'italic',
      },
    ],
  })

  Font.registerHyphenationCallback((word) => [word])
}
