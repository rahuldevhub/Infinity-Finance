import type { CompanyCode } from './company.js';

type LegacyFinancialRow = {
  company?: CompanyCode | null;
  sub_brand?: string | null;
};

export function inferFinancialCompany(row: LegacyFinancialRow): CompanyCode | null {
  if (row.company === 'infinity' || row.company === 'ritera' || row.company === 'ratix') return row.company;
  const brand = row.sub_brand?.trim().toLowerCase() ?? '';
  if (brand.includes('ritera')) return 'ritera';
  if (brand.includes('ratix')) return 'ratix';
  if (brand.includes('infinity')) return 'infinity';
  return null;
}

/**
 * Infinity Enterprises is the owner-level workspace and intentionally aggregates
 * all existing financial records. Brand workspaces use an explicit company when
 * present and fall back to the legacy sub_brand value for pre-migration records.
 */
export function scopeDashboardRows<T extends LegacyFinancialRow>(rows: T[], entity: CompanyCode): Array<T & { company: CompanyCode }> {
  if (entity === 'infinity') return rows.map((row) => ({ ...row, company: entity }));
  return rows
    .filter((row) => inferFinancialCompany(row) === entity)
    .map((row) => ({ ...row, company: entity }));
}
