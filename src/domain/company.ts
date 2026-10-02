export const COMPANY_CODES = ['ritera', 'ratix', 'infinity'] as const;

export type CompanyCode = (typeof COMPANY_CODES)[number];

export const COMPANY_LABELS: Record<CompanyCode, string> = {
  ritera: 'Ritera Publishing',
  ratix: 'Ratixinfo Tech',
  infinity: 'Infinity Enterprises',
};

export function isCompanyCode(value: unknown): value is CompanyCode {
  return typeof value === 'string' && COMPANY_CODES.includes(value as CompanyCode);
}

export function requireNewClientCompany(value: unknown): CompanyCode {
  if (!isCompanyCode(value)) throw new Error('A valid company is required.');
  return value;
}

export function inheritProjectCompany(clientCompany: CompanyCode | null | undefined, requested?: CompanyCode | null): CompanyCode {
  return requested || clientCompany || 'ritera';
}

export function inheritDocumentCompany(projectCompany: CompanyCode | null | undefined): CompanyCode {
  return projectCompany || 'ritera';
}

