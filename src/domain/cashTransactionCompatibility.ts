type DatabaseError = {
  code?: string;
  message?: string;
};

export function isMissingCashTransactionCompanyColumn(error: DatabaseError | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? '';
  return message.includes('company') && (error.code === '42703' || error.code === 'PGRST204');
}

export function withoutCompany<T extends { company?: unknown }>(row: T): Omit<T, 'company'> {
  const copy = { ...row };
  delete copy.company;
  return copy;
}
