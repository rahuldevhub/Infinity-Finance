// Logo storage keys
const LOGO_KEYS = {
  ritera: 'logo_ritera',
  ratixinfo: 'logo_ratixinfo',
};

// Get logo as base64 string (returns null if not uploaded)
export function getLogo(brand: 'ritera' | 'ratixinfo'): string | null {
  try {
    return localStorage.getItem(LOGO_KEYS[brand]);
  } catch {
    return null;
  }
}

// Save logo as base64
export function saveLogo(brand: 'ritera' | 'ratixinfo', base64: string): void {
  try {
    localStorage.setItem(LOGO_KEYS[brand], base64);
  } catch {
    console.error('Failed to save logo');
  }
}

// Remove logo
export function removeLogo(brand: 'ritera' | 'ratixinfo'): void {
  try {
    localStorage.removeItem(LOGO_KEYS[brand]);
  } catch {}
}

// Convert File to base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Placeholder SVG logos (used in Settings preview when no PNG uploaded)
export const PLACEHOLDER_LOGOS = {
  ritera: `data:image/svg+xml;base64,${btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
    '<rect width="48" height="48" rx="4" fill="#1a1a2e"/>' +
    '<text x="24" y="30" text-anchor="middle" fill="white" font-size="22" font-family="sans-serif" font-weight="bold">R</text>' +
    '</svg>'
  )}`,
  ratixinfo: `data:image/svg+xml;base64,${btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
    '<rect width="48" height="48" rx="4" fill="#0f172a"/>' +
    '<text x="24" y="30" text-anchor="middle" fill="#3b82f6" font-size="16" font-family="sans-serif" font-weight="bold">Rx</text>' +
    '</svg>'
  )}`,
};
