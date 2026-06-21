import { supabase } from '../lib/supabase'
import type { PaymentReceipt } from '../types'

export async function sendReceiptEmail(
  receipt: PaymentReceipt,
  toEmail: string,
  clientName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-receipt-email', {
      body: {
        receipt_id: receipt.id,
        to_email: toEmail,
        sub_brand: receipt.sub_brand,
        client_name: clientName,
        receipt_data: {
          receipt_number: receipt.receipt_number,
          amount_received: receipt.amount_received,
          date: receipt.date,
          payment_mode: receipt.payment_mode,
          payment_reference: receipt.payment_reference,
          towards: receipt.towards,
        },
      },
    })

    if (error) throw error
    if (!data?.success) throw new Error(data?.error || 'Unknown error')

    return { success: true }
  } catch (err) {
    console.error('sendReceiptEmail error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send email',
    }
  }
}
