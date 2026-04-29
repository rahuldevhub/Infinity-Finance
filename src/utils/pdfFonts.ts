import { Font } from '@react-pdf/renderer'

let registered = false

export function registerPDFFonts() {
  if (registered) return
  registered = true
  Font.registerHyphenationCallback((word) => [word])
}
