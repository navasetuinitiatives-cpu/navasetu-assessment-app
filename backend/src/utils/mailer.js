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

function buildInviteBody({ teacherName, schoolName, link, customMessage }) {
  return `Dear ${teacherName},

You have been invited by ${schoolName} to complete the NavaSetu Teacher Wellness Assessment.

${customMessage ? customMessage + '\n\n' : ''}This confidential, self-reflection assessment takes about 12-15 minutes. Your individual report is visible only to you and to NavaSetu — your school will only ever see aggregate, anonymized results.

Please complete your assessment here: ${link}

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
export async function sendBulkInviteEmails({ teachers, schoolName, link, customMessage }) {
  const drafts = teachers.map((t) => ({
    to: t.email,
    subject: `${schoolName} — NavaSetu Teacher Wellness Assessment`,
    body: buildInviteBody({ teacherName: t.full_name || t.email, schoolName, link, customMessage })
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
