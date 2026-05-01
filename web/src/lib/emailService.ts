import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'Privara Estate <noreply@privara.estate>';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://privara.estate';

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:#0f172a;padding:28px 40px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Privara Estate</span>
          </td>
        </tr>
        <tr><td style="padding:36px 40px 28px;">${body}</td></tr>
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #e8edf2;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              You are receiving this email because you have an account on Privara Estate.<br/>
              &copy; ${new Date().getFullYear()} Privara Estate. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(label: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr><td style="background:#0f172a;border-radius:10px;">
      <a href="${href}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:-0.2px;">${label}</a>
    </td></tr>
  </table>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.4px;">${text}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;color:#334155;line-height:1.65;">${text}</p>`;
}

function box(content: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
    <tr><td style="padding:18px 20px;font-size:14px;color:#475569;line-height:1.7;">${content}</td></tr>
  </table>`;
}

// ── Email senders ──────────────────────────────────────────────────────────────

export async function sendPaymentReceiptEmail(params: {
  toEmail: string;
  toName: string;
  caseId: string;
  amount: string;
  currency: string;
  transactionId: string;
}): Promise<void> {
  const { toEmail, toName, caseId, amount, currency, transactionId } = params;
  const caseUrl = `${BASE_URL}/client/cases/${caseId}`;
  const body =
    h1('Payment Received') +
    p(`Hi ${toName}, your payment has been successfully processed and your consultation is now active.`) +
    box(
      `<strong>Amount:</strong> ${amount} ${currency}<br/>` +
      `<strong>Transaction ID:</strong> ${transactionId}<br/>` +
      `<strong>Case ID:</strong> ${caseId.substring(0, 8).toUpperCase()}`,
    ) +
    p('A consultant will be assigned to your case shortly. You will receive a notification once they are assigned.') +
    btn('View My Case', caseUrl);

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: 'Payment Received — Privara Estate',
    html: layout('Payment Received', body),
  });
}

export async function sendConsultantAssignedEmail(params: {
  toEmail: string;
  toName: string;
  consultantName: string;
  caseId: string;
}): Promise<void> {
  const { toEmail, toName, consultantName, caseId } = params;
  const caseUrl = `${BASE_URL}/client/cases/${caseId}`;
  const body =
    h1('Your Consultant Has Been Assigned') +
    p(`Hi ${toName}, a consultant has been assigned to your case and is ready to assist you.`) +
    box(`<strong>Consultant:</strong> ${consultantName}<br/><strong>Case:</strong> ${caseId.substring(0, 8).toUpperCase()}`) +
    p('You can now start a conversation and share details about your project directly in the case chat.') +
    btn('Open Case Chat', caseUrl);

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `${consultantName} has been assigned to your case`,
    html: layout('Consultant Assigned', body),
  });
}

export async function sendReportUploadedEmail(params: {
  toEmail: string;
  toName: string;
  consultantName: string;
  caseId: string;
}): Promise<void> {
  const { toEmail, toName, consultantName, caseId } = params;
  const caseUrl = `${BASE_URL}/client/cases/${caseId}`;
  const body =
    h1('Your Consultation Report Is Ready') +
    p(`Hi ${toName}, ${consultantName} has uploaded the final report for your consultation case.`) +
    box(`<strong>Case:</strong> ${caseId.substring(0, 8).toUpperCase()}`) +
    p('You can view and download the full report from your case page.') +
    btn('View Report', caseUrl);

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: 'Your consultation report is ready — Privara Estate',
    html: layout('Report Ready', body),
  });
}

export async function sendRatingReminderEmail(params: {
  toEmail: string;
  toName: string;
  consultantName: string;
  caseId: string;
}): Promise<void> {
  const { toEmail, toName, consultantName, caseId } = params;
  const caseUrl = `${BASE_URL}/client/cases/${caseId}`;
  const body =
    h1('How Was Your Experience?') +
    p(`Hi ${toName}, your consultation with ${consultantName} is complete. We would love to hear your feedback.`) +
    p('Your rating helps us maintain quality and improves the experience for other clients.') +
    btn('Rate My Consultation', caseUrl);

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: 'Please rate your recent consultation — Privara Estate',
    html: layout('Rate Your Consultation', body),
  });
}
