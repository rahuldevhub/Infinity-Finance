interface CashEntry {
  type: 'in' | 'out';
  payment_mode: string;
  amount: number;
  description: string;
  category: string;
}

export function cashEntriesWithRazorpayFee<T extends CashEntry>(payment: T, feeInput: string): T[] {
  if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
    throw new Error('Enter a valid amount greater than 0.');
  }
  if (payment.type !== 'in' || payment.payment_mode !== 'razorpay' || !feeInput.trim()) return [payment];
  const fee = Number(feeInput);
  if (!Number.isFinite(fee) || fee < 0 || Math.abs(fee * 100 - Math.round(fee * 100)) > 0.000001) {
    throw new Error('Enter a valid Razorpay fee with up to two decimal places.');
  }
  if (fee > payment.amount) throw new Error('Razorpay fee cannot exceed the incoming amount.');
  if (fee === 0) return [payment];
  return [payment, {
    ...payment,
    type: 'out',
    category: 'Payment Gateway Fees',
    description: `Razorpay fee — ${payment.description}`,
    amount: fee,
  }];
}

// Stable row identity makes repeated edits/retries update the same fee.
export async function razorpayFeeId(paymentId: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cash-razorpay-fee:${paymentId}`)));
  hash[6] = (hash[6] & 15) | 0x80;
  hash[8] = (hash[8] & 63) | 0x80;
  const hex = Array.from(hash.slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface StoredCashEntry extends CashEntry {
  id: string;
  date: string;
  created_at: string;
  created_by: string;
  reference: string | null;
  sub_brand: string | null;
}

// Earlier paired inserts shared a database timestamp but had random IDs.
export function legacyRazorpayFee<T extends StoredCashEntry>(payment: StoredCashEntry, rows: T[]): T | null {
  const matches = rows.filter(row => row.id !== payment.id && row.type === 'out'
    && row.payment_mode === 'razorpay' && row.category === 'Payment Gateway Fees'
    && row.description === `Razorpay fee — ${payment.description}`
    && row.created_at === payment.created_at && row.created_by === payment.created_by
    && row.date === payment.date && row.reference === payment.reference && row.sub_brand === payment.sub_brand);
  if (matches.length > 1) throw new Error('Multiple matching Razorpay fees found. Review the fee transactions before editing.');
  return matches[0] ?? null;
}
