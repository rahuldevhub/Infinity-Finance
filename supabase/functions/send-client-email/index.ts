import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const companyNames: Record<string, string> = { ritera: 'Ritera Publishing', ratix: 'Ratixinfo Tech', infinity: 'Infinity Enterprises' }
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]!))
const render = (template: string, values: Record<string, string>) => template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => values[key] || '')

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } })
    const { data: authData, error: authError } = await anon.auth.getUser()
    if (authError || !authData.user) return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { client_id, project_id, template_key, subject_override, body_override } = await request.json()
    if (!client_id || !template_key) throw new Error('Client and template are required')
    const [{ data: client, error: clientError }, { data: template, error: templateError }] = await Promise.all([
      service.from('clients').select('id, name, email, default_company').eq('id', client_id).single(),
      service.from('email_templates').select('id, subject_template, body_template').eq('template_key', template_key).single(),
    ])
    if (clientError || !client?.email) throw new Error('Client email is unavailable')
    if (templateError || !template) throw new Error('Email template is unavailable')
    let project = null
    let quotation = null
    let proforma = null
    let paymentSummary = null
    let receipt = null
    if (project_id) {
      const result = await service.from('projects').select('id, client_id, name, company').eq('id', project_id).eq('client_id', client_id).single()
      if (result.error) throw new Error('Project does not belong to this client')
      project = result.data
      const [quotationResult, proformaResult, summaryResult, receiptResult] = await Promise.all([
        service.from('quotations').select('quotation_number, total_amount').eq('project_id', project_id).order('date', { ascending: false }).limit(1).maybeSingle(),
        service.from('proforma_invoices').select('proforma_number, total_amount').eq('project_id', project_id).order('date', { ascending: false }).limit(1).maybeSingle(),
        service.rpc('get_project_payment_summary', { p_project_id: project_id }).maybeSingle(),
        service.from('payment_receipts').select('receipt_number, amount_received').eq('project_id', project_id).eq('reconciliation_managed', true).eq('is_void', false).order('date', { ascending: false }).limit(1).maybeSingle(),
      ])
      quotation = quotationResult.data
      proforma = proformaResult.data
      paymentSummary = summaryResult.data
      receipt = receiptResult.data
    }
    const company = project?.company || client.default_company || 'ritera'
    const money = (value: unknown) => value == null ? '' : `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    const totalReceived = paymentSummary?.total_received ?? 0
    const outstanding = paymentSummary?.outstanding
    const values = {
      client_name: client.name,
      project_name: project?.name || 'your engagement',
      quotation_number: quotation?.quotation_number || '',
      proforma_number: proforma?.proforma_number || '',
      amount: money(quotation?.total_amount ?? proforma?.total_amount),
      amount_received: money(totalReceived),
      received: money(receipt?.amount_received ?? totalReceived),
      receipt_number: receipt?.receipt_number || '',
      outstanding: money(outstanding),
      payment_due: money(outstanding),
      company_name: companyNames[company] || companyNames.ritera,
    }
    const subject = render(String(subject_override || template.subject_template).slice(0, 200), values)
    const body = render(String(body_override || template.body_template).slice(0, 10000), values)
    const sender = company === 'ratix' ? (Deno.env.get('RATIX_EMAIL') || Deno.env.get('RITERA_EMAIL')) : Deno.env.get('RITERA_EMAIL')
    const password = company === 'ratix' ? (Deno.env.get('RATIX_EMAIL_PASSWORD') || Deno.env.get('RITERA_EMAIL_PASSWORD')) : Deno.env.get('RITERA_EMAIL_PASSWORD')
    if (!sender || !password) throw new Error('Email service is not configured')
    const { data: log, error: logError } = await service.from('client_email_log').insert({ client_id, project_id: project?.id || null, template_id: template.id, recipient: client.email, subject, body_snapshot: body, created_by: authData.user.id }).select('id').single()
    if (logError) throw logError
    try {
      const smtp = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: sender, password } } })
      await smtp.send({ from: `${companyNames[company] || companyNames.ritera} <${sender}>`, to: client.email, subject, html: `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">${escapeHtml(body)}</div>` })
      await smtp.close()
      await service.from('client_email_log').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', log.id)
    } catch (sendError) {
      await service.from('client_email_log').update({ status: 'failed', error_message: String(sendError).slice(0, 1000) }).eq('id', log.id)
      throw sendError
    }
    return new Response(JSON.stringify({ success: true, message: 'Email sent to the client record.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Email failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
