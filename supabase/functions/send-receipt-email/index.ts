import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]!))

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const url = Deno.env.get('SUPABASE_URL')!
    const authClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } })
    const { data: authData, error: authError } = await authClient.auth.getUser()
    if (authError || !authData.user) return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { receipt_id } = await request.json()
    if (!receipt_id) throw new Error('Receipt is required')
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: receipt, error } = await service.from('payment_receipts').select('id, receipt_number, date, amount_received, payment_mode, towards, payment_reference, sub_brand, client_email, client:clients(name,email)').eq('id', receipt_id).single()
    if (error || !receipt) throw new Error('Receipt was not found')
    const joinedClient = Array.isArray(receipt.client) ? receipt.client[0] : receipt.client
    const recipient = joinedClient?.email || receipt.client_email
    if (!recipient) throw new Error('The linked client has no email address')
    const isRitera = !receipt.sub_brand || receipt.sub_brand.toLowerCase().includes('ritera')
    const sender = isRitera ? Deno.env.get('RITERA_EMAIL') : (Deno.env.get('RATIX_EMAIL') || Deno.env.get('RITERA_EMAIL'))
    const password = isRitera ? Deno.env.get('RITERA_EMAIL_PASSWORD') : (Deno.env.get('RATIX_EMAIL_PASSWORD') || Deno.env.get('RITERA_EMAIL_PASSWORD'))
    if (!sender || !password) throw new Error('Email service is not configured')
    const brand = isRitera ? 'Ritera Publishing' : 'Ratixinfo Tech'
    const amount = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(receipt.amount_received))
    const date = new Date(receipt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:560px;margin:auto"><h2>${escapeHtml(brand)} — Payment Receipt</h2><p>Dear ${escapeHtml(joinedClient?.name || 'Valued Client')},</p><p>We have received your payment.</p><table style="width:100%;border-collapse:collapse"><tr><td>Receipt</td><td>${escapeHtml(receipt.receipt_number)}</td></tr><tr><td>Date</td><td>${escapeHtml(date)}</td></tr><tr><td>Amount</td><td>₹${escapeHtml(amount)}</td></tr><tr><td>Mode</td><td>${escapeHtml(receipt.payment_mode)}</td></tr><tr><td>Towards</td><td>${escapeHtml(receipt.towards || '—')}</td></tr><tr><td>Reference</td><td>${escapeHtml(receipt.payment_reference || '—')}</td></tr></table></div>`
    const smtp = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: sender, password } } })
    await smtp.send({ from: `${brand} <${sender}>`, to: recipient, subject: `Payment Receipt ${receipt.receipt_number} — ${brand}`, html })
    await smtp.close()
    await service.from('payment_receipts').update({ email_sent: true, email_sent_at: new Date().toISOString(), client_email: recipient }).eq('id', receipt.id)
    return new Response(JSON.stringify({ success: true, message: 'Email sent successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Email failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
