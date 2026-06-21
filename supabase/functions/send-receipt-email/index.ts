import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildHtml(params: {
  brandName: string
  brandColor: string
  clientName: string
  receiptNumber: string
  date: string
  amount: string
  paymentMode: string
  towards: string | null
  paymentReference: string | null
  fromEmail: string
}): string {
  const { brandName, brandColor, clientName, receiptNumber, date, amount, paymentMode, towards, paymentReference, fromEmail } = params

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Payment Receipt ${receiptNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:${brandColor};padding:28px 32px;">
      <p style="margin:0;color:rgba(255,255,255,0.75);font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">${brandName}</p>
      <p style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Payment Receipt</p>
    </div>

    <!-- Meta bar -->
    <div style="background:#f8f8f9;padding:12px 32px;border-bottom:1px solid #ebebeb;display:flex;justify-content:space-between;">
      <span style="font-size:12px;color:#666;font-family:monospace;">${receiptNumber}</span>
      <span style="font-size:12px;color:#666;">${date}</span>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 6px;font-size:15px;color:#111;font-weight:600;">Dear ${clientName},</p>
      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.65;">
        Thank you for your payment. We have received your payment and this email serves as your official receipt.
      </p>

      <!-- Amount box -->
      <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:22px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:11px;color:#16a34a;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Amount Received</p>
        <p style="margin:0;font-size:34px;font-weight:800;color:#15803d;letter-spacing:-1px;">&#8377;${amount}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#555;">
          via ${paymentMode.toUpperCase()}${towards ? ' &nbsp;·&nbsp; ' + towards : ''}
        </p>
      </div>

      <!-- Details table -->
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:28px;">
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:11px 0;color:#888;font-weight:500;">Receipt No</td>
          <td style="padding:11px 0;text-align:right;color:#333;font-weight:600;font-family:monospace;">${receiptNumber}</td>
        </tr>
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:11px 0;color:#888;font-weight:500;">Payment Date</td>
          <td style="padding:11px 0;text-align:right;color:#333;">${date}</td>
        </tr>
        <tr style="border-bottom:${paymentReference ? '1px solid #f0f0f0' : 'none'};">
          <td style="padding:11px 0;color:#888;font-weight:500;">Payment Mode</td>
          <td style="padding:11px 0;text-align:right;color:#333;">${paymentMode.toUpperCase()}</td>
        </tr>
        ${paymentReference ? `
        <tr>
          <td style="padding:11px 0;color:#888;font-weight:500;">Reference</td>
          <td style="padding:11px 0;text-align:right;color:#333;font-family:monospace;">${paymentReference}</td>
        </tr>` : ''}
      </table>

      <p style="margin:0;font-size:13px;color:#777;line-height:1.6;">
        For any queries, please reply to this email or contact us at
        <a href="mailto:${fromEmail}" style="color:${brandColor};text-decoration:none;font-weight:600;">${fromEmail}</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8f8f9;border-top:1px solid #ebebeb;padding:18px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#999;">${brandName} &nbsp;·&nbsp; Infinity Enterprises &nbsp;·&nbsp; Namakkal, Tamil Nadu</p>
      <p style="margin:5px 0 0;font-size:11px;color:#bbb;">This is a computer-generated email. Please do not reply to this thread for support.</p>
    </div>

  </div>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { receipt_id, to_email, sub_brand, receipt_data, client_name } = await req.json()

    // Determine sender based on sub_brand
    const isRitera = !sub_brand || sub_brand.toLowerCase().includes('ritera')
    const fromEmail = isRitera
      ? Deno.env.get('RITERA_EMAIL')!
      : (Deno.env.get('RATIX_EMAIL') || Deno.env.get('RITERA_EMAIL')!)
    const fromPassword = isRitera
      ? Deno.env.get('RITERA_EMAIL_PASSWORD')!
      : (Deno.env.get('RATIX_EMAIL_PASSWORD') || Deno.env.get('RITERA_EMAIL_PASSWORD')!)
    const brandName = isRitera ? 'Ritera Publishing' : 'Ratixinfo Tech'
    const brandColor = isRitera ? '#e63946' : '#3b82f6'

    // Format amount
    const amount = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(receipt_data.amount_received)

    // Format date
    const date = new Date(receipt_data.date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

    const htmlBody = buildHtml({
      brandName,
      brandColor,
      clientName: client_name || 'Valued Client',
      receiptNumber: receipt_data.receipt_number,
      date,
      amount,
      paymentMode: receipt_data.payment_mode || 'UPI',
      towards: receipt_data.towards || null,
      paymentReference: receipt_data.payment_reference || null,
      fromEmail,
    })

    // Send via Gmail SMTP using denomailer
    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: {
          username: fromEmail,
          password: fromPassword,
        },
      },
    })

    await client.send({
      from: `${brandName} <${fromEmail}>`,
      to: to_email,
      subject: `Payment Receipt ${receipt_data.receipt_number} — ${brandName}`,
      html: htmlBody,
    })

    await client.close()

    // Update email_sent status in DB
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    await supabase
      .from('payment_receipts')
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        client_email: to_email,
      })
      .eq('id', receipt_id)

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Email send error:', error)
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
