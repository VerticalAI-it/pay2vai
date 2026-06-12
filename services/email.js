const { Resend } = require('resend');

const FROM_EMAIL = 'VerticalAI <noreply@verticalai.it>';

function fmt(amount, currency = 'EUR') {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function billingLabel(billingCycle, billingMonths) {
  if (billingCycle === 'one_time') return 'Pagamento unico';
  if (billingMonths) return `Abbonamento mensile per ${billingMonths} ${billingMonths === 1 ? 'mese' : 'mesi'}`;
  return 'Abbonamento mensile ricorrente';
}

function buildHtml({ offer, offerUrl }) {
  const base = parseFloat(offer.amount);
  const discPct = parseFloat(offer.discount_percent) || 0;
  const discounted = discPct > 0 ? base * (1 - discPct / 100) : base;
  const withVat = discounted * 1.22;

  const greeting = offer.company_name
    ? `Gentile <strong>${offer.company_name}</strong>,`
    : 'Gentile Cliente,';

  const paragraphs = (offer.description || '')
    .split(/\n+/)
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 10px 0;color:#374151;font-size:15px;line-height:1.7;">${p}</p>`)
    .join('');

  const originalRow = discPct > 0
    ? `<p style="margin:0 0 4px 0;font-size:15px;color:#9ca3af;text-decoration:line-through;">${fmt(base, offer.currency)} IVA Esclusa</p>`
    : '';

  const discountBadge = discPct > 0
    ? `<span style="display:inline-block;background:#dcfce7;color:#166534;font-size:12px;font-weight:700;padding:2px 10px;border-radius:99px;margin-left:10px;">−${discPct}%</span>`
    : '';

  const companyBlock = (offer.company_name || offer.company_address || offer.company_pec || offer.company_sdi)
    ? `<div style="margin-top:24px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;font-size:13px;color:#6b7280;">
        <p style="margin:0 0 8px 0;font-weight:700;color:#374151;">Intestazione Fattura</p>
        ${offer.company_name    ? `<p style="margin:0 0 3px 0;">${offer.company_name}</p>` : ''}
        ${offer.company_address ? `<p style="margin:0 0 3px 0;">${offer.company_address}</p>` : ''}
        ${offer.company_zip     ? `<p style="margin:0 0 3px 0;">${offer.company_zip}</p>` : ''}
        ${offer.company_pec     ? `<p style="margin:0 0 3px 0;">PEC: ${offer.company_pec}</p>` : ''}
        ${offer.company_phone   ? `<p style="margin:0 0 3px 0;">Tel: ${offer.company_phone}</p>` : ''}
        ${offer.company_sdi     ? `<p style="margin:0;">SDI: ${offer.company_sdi}</p>` : ''}
      </div>`
    : '';

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:48px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:#4f46e5;border-radius:16px 16px 0 0;padding:36px 48px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:30px;font-weight:800;letter-spacing:-0.5px;">VerticalAI</h1>
          <p style="margin:10px 0 0;color:#c7d2fe;font-size:15px;">La tua offerta personalizzata è pronta</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background:#ffffff;padding:40px 48px;">

          <p style="margin:0 0 20px 0;font-size:16px;color:#374151;">${greeting}</p>
          <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;line-height:1.7;">
            Abbiamo preparato per te un'offerta personalizzata. Di seguito trovi tutti i dettagli del servizio su misura per la tua realtà.
          </p>

          <!-- Offer card -->
          <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:14px;padding:28px;">
            <p style="margin:0 0 4px 0;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#6366f1;font-weight:700;">
              Offerta Personalizzata &nbsp;·&nbsp; ${offer.code}
            </p>
            <div style="margin:14px 0 20px 0;">${paragraphs}</div>

            <div style="border-top:1px solid #c7d2fe;padding-top:20px;">
              ${originalRow}
              <p style="margin:0 0 4px 0;">
                <span style="font-size:38px;font-weight:800;color:#4f46e5;">${fmt(discounted, offer.currency)}</span>
                ${discountBadge}
              </p>
              <p style="margin:0 0 6px 0;font-size:13px;color:#6b7280;font-weight:600;">IVA Esclusa</p>
              <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">
                Totale con IVA (22%):&nbsp;<strong style="color:#374151;">${fmt(withVat, offer.currency)}</strong>
              </p>
              <p style="margin:0;font-size:13px;color:#6b7280;">${billingLabel(offer.billing_cycle, offer.billing_months)}</p>
            </div>
          </div>

          ${companyBlock}

          <!-- CTA -->
          <div style="text-align:center;margin:36px 0 24px 0;">
            <a href="${offerUrl}"
               style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:18px 44px;border-radius:12px;">
              Visualizza l'offerta e procedi al pagamento →
            </a>
          </div>

          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.7;">
            Oppure copia questo link nel tuo browser:<br/>
            <a href="${offerUrl}" style="color:#6366f1;word-break:break-all;">${offerUrl}</a>
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f9fafb;border-radius:0 0 16px 16px;padding:24px 48px;text-align:center;">
          <p style="margin:0 0 6px 0;font-size:12px;color:#6b7280;">
            Hai domande? Rispondi pure a questa email.
          </p>
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            &copy; ${year} VerticalAI &nbsp;·&nbsp; Pagamenti sicuri gestiti da Stripe
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

async function sendOfferEmail({ to, offer, offerUrl }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email.');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const companyTag = offer.company_name ? ` – ${offer.company_name}` : '';

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `La tua offerta personalizzata è pronta${companyTag} | VerticalAI`,
    html: buildHtml({ offer, offerUrl }),
  });
}

module.exports = { sendOfferEmail };
