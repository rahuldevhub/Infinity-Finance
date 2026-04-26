export const BUSINESS = {
  legalName: 'Infinity Enterprises',
  gstin: '33FFZPR7059H1ZI',
  address: '5/995/10, Ganapthi Garden, Alampalaiyam',
  city: 'Namakkal',
  state: 'Tamil Nadu',
  pincode: '638008',
  bank: {
    name: 'HDFC Bank',
    accountName: 'Infinity Enterprises',
    accountNumber: '50200115779836',
    ifsc: 'HDFC0004038',
    upi: '7708133665-3@ybl',
  },
  ritera: {
    brandName: 'Ritera Publishing',
    tagline: 'A Global Self-Publishing Company',
    email: 'riterapublishing@gmail.com',
    phone: '+91 94888 54787',
    website: 'www.riterapublishing.com',
    accentColor: '#e63946',
    headerBg: '#1a1a2e',
  },
  ratixinfo: {
    brandName: 'Ratixinfo Tech',
    tagline: 'Technology Solutions & Digital Services',
    email: 'ratixinfotech@gmail.com',
    phone: '+91 77081 33665',
    website: 'www.ratixinfo.com',
    accentColor: '#3b82f6',
    headerBg: '#0f172a',
  },
};

export function getBrandDetails(subBrand: string) {
  if (subBrand?.toLowerCase().includes('ratix')) return BUSINESS.ratixinfo;
  return BUSINESS.ritera;
}
