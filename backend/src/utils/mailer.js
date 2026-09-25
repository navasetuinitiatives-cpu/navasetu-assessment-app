import nodemailer from 'nodemailer';

function isConfigured() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_APP_PASSWORD !== 'dummy_password');
}

function getTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
  });
}

function buildInviteBody({ teacherName, schoolName, link, schoolCode, customMessage }) {
  let origin = '';
  try { origin = new URL(link).origin; } catch (e) { /* link wasn't absolute; omit the fallback origin */ }
  const codeLine = schoolCode
    ? `\n\nIf that link doesn't work for you, just go to ${origin || 'the NavaSetu site'} and enter your school code when you register or log in: ${schoolCode}`
    : '';
  return `Dear ${teacherName},

You have been invited by ${schoolName} to complete the NavaSetu Teacher Wellness Assessment.

${customMessage ? customMessage + '\n\n' : ''}This confidential, self-reflection assessment takes about 18-22 minutes. Your individual report is visible only to you and to NavaSetu — your school will only ever see aggregate, anonymized results.

Please complete your assessment here: ${link}${codeLine}

Warm regards,
NavaSetu Initiatives
navasetuinitiatives@gmail.com | www.navasetu.online`;
}

/**
 * Sends a personalized invite to every teacher in the list. If Gmail
 * credentials aren't configured (the pilot default), this returns the
 * drafted messages instead of sending, so an admin can copy/paste them —
 * matching the "skeletal now, wire up later" pattern used for Razorpay.
 */
export async function sendBulkInviteEmails({ teachers, schoolName, link, schoolCode, customMessage }) {
  const drafts = teachers.map((t) => ({
    to: t.email,
    subject: `${schoolName} — NavaSetu Teacher Wellness Assessment`,
    body: buildInviteBody({ teacherName: t.full_name || t.email, schoolName, link, schoolCode, customMessage })
  }));

  if (!isConfigured()) {
    return {
      sent: false,
      configured: false,
      message: 'Email sending is not configured yet (GMAIL_APP_PASSWORD not set) — returning drafted invites instead.',
      drafts
    };
  }

  const transport = getTransport();
  let sentCount = 0;
  const failures = [];

  for (const draft of drafts) {
    try {
      await transport.sendMail({
        from: `"NavaSetu Initiatives" <${process.env.GMAIL_USER}>`,
        to: draft.to,
        subject: draft.subject,
        text: draft.body
      });
      sentCount++;
    } catch (error) {
      failures.push({ to: draft.to, error: error.message });
    }
  }

  return { sent: true, configured: true, sentCount, total: drafts.length, failures };
}

/**
 * Sends a single email with an optional file attachment (used for the
 * school roster template + school code, sent to a school's contact person).
 * Same "skeletal now, wire up later" fallback as the bulk invite sender.
 */
export async function sendEmailWithAttachment({ to, subject, text, attachment }) {
  if (!isConfigured()) {
    return {
      sent: false,
      configured: false,
      message: 'Email sending is not configured yet (GMAIL_APP_PASSWORD not set) — download the template yourself and send it manually for now.'
    };
  }

  const transport = getTransport();
  try {
    await transport.sendMail({
      from: `"NavaSetu Initiatives" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
      attachments: attachment ? [{ filename: attachment.filename, content: attachment.content }] : []
    });
    return { sent: true, configured: true };
  } catch (error) {
    return { sent: false, configured: true, error: error.message };
  }
}
