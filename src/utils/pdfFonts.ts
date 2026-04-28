import { Font } from '@react-pdf/renderer'

let registered = false

export function registerPDFFonts() {
  if (registered) return
  registered = true
  // Only register hyphenation — no custom fonts
  // react-pdf v4 uses built-in fonts by default which always work
  Font.registerHyphenationCallback((word) => [word])
}
