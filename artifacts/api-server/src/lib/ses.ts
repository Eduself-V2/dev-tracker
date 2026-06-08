import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { logger } from "./logger";

const region = process.env.AWS_REGION ?? "us-east-1";
const fromEmail = process.env.SES_FROM_EMAIL;
export const sesEnabled = process.env.SES_ENABLED === "true";

const clientConfig: ConstructorParameters<typeof SESClient>[0] = { region };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const ses = new SESClient(clientConfig);

const appUrl = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_testing: "In Testing",
  needs_fix: "Needs Fix",
  confirmed: "Confirmed",
  pushed_to_production: "Pushed to Production",
};

function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f4f4f7;margin:0;padding:20px}
.card{background:#fff;border-radius:8px;padding:28px 32px;max-width:560px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,.07)}
h2{margin:0 0 16px;color:#1a1a2e;font-size:18px}
p{color:#444;line-height:1.6;margin:8px 0}
blockquote{border-left:3px solid #4f46e5;margin:12px 0;padding:8px 14px;color:#555;background:#f8f7ff;border-radius:0 4px 4px 0}
a.btn{display:inline-block;margin-top:20px;padding:10px 22px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600}
.footer{color:#aaa;font-size:11px;margin-top:24px;border-top:1px solid #eee;padding-top:12px}
</style></head><body><div class="card">
<h2>${title}</h2>${body}
<p class="footer">Dev Tracker &mdash; automated notification. Do not reply to this email.</p>
</div></body></html>`;
}

export async function sendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (!sesEnabled || !fromEmail) return;
  const to = opts.to.filter(Boolean);
  if (to.length === 0) return;
  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: to },
        Message: {
          Subject: { Data: opts.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: opts.html, Charset: "UTF-8" },
            Text: { Data: opts.text, Charset: "UTF-8" },
          },
        },
      }),
    );
    logger.info({ to, subject: opts.subject }, "SES email sent");
  } catch (err) {
    logger.error({ err }, "SES sendEmail failed");
  }
}

export function buildTransitionEmail(opts: {
  reqId: number;
  reqTitle: string;
  fromStatus: string;
  toStatus: string;
  actorName: string;
  note?: string | null;
}): { subject: string; html: string; text: string } {
  const from = STATUS_LABELS[opts.fromStatus] ?? opts.fromStatus;
  const to = STATUS_LABELS[opts.toStatus] ?? opts.toStatus;
  const subject = `[Dev Tracker] #${opts.reqId} moved to ${to}`;
  const noteHtml = opts.note
    ? `<blockquote>${opts.note}</blockquote>`
    : "";
  const html = baseHtml(
    `Status changed: ${opts.reqTitle}`,
    `<p><strong>${opts.actorName}</strong> moved requirement <strong>#${opts.reqId}: ${opts.reqTitle}</strong></p>
    <p><strong>${from}</strong> &rarr; <strong>${to}</strong></p>
    ${noteHtml}
    <a class="btn" href="${appUrl}/requirements/${opts.reqId}">View Requirement</a>`,
  );
  const text = `${opts.actorName} moved #${opts.reqId} "${opts.reqTitle}" from ${from} → ${to}.${opts.note ? `\n\nNote: ${opts.note}` : ""}\n\n${appUrl}/requirements/${opts.reqId}`;
  return { subject, html, text };
}

export function buildCommentEmail(opts: {
  reqId: number;
  reqTitle: string;
  authorName: string;
  commentBody: string;
}): { subject: string; html: string; text: string } {
  const preview =
    opts.commentBody.length > 300
      ? opts.commentBody.slice(0, 300) + "…"
      : opts.commentBody;
  const subject = `[Dev Tracker] New comment on #${opts.reqId}: ${opts.reqTitle}`;
  const html = baseHtml(
    `New comment: ${opts.reqTitle}`,
    `<p><strong>${opts.authorName}</strong> commented on <strong>#${opts.reqId}: ${opts.reqTitle}</strong>:</p>
    <blockquote>${preview}</blockquote>
    <a class="btn" href="${appUrl}/requirements/${opts.reqId}">View Requirement</a>`,
  );
  const text = `${opts.authorName} commented on #${opts.reqId} "${opts.reqTitle}":\n\n${preview}\n\n${appUrl}/requirements/${opts.reqId}`;
  return { subject, html, text };
}

export function buildAssignmentEmail(opts: {
  reqId: number;
  reqTitle: string;
  actorName: string;
  role: "tester" | "assignee";
}): { subject: string; html: string; text: string } {
  const roleLabel = opts.role === "tester" ? "QA tester" : "assignee";
  const subject = `[Dev Tracker] You've been assigned to #${opts.reqId}: ${opts.reqTitle}`;
  const html = baseHtml(
    `New assignment`,
    `<p><strong>${opts.actorName}</strong> assigned you as <strong>${roleLabel}</strong> on:</p>
    <p style="font-size:15px;font-weight:600">#${opts.reqId}: ${opts.reqTitle}</p>
    <a class="btn" href="${appUrl}/requirements/${opts.reqId}">View Requirement</a>`,
  );
  const text = `${opts.actorName} assigned you as ${roleLabel} on #${opts.reqId} "${opts.reqTitle}".\n\n${appUrl}/requirements/${opts.reqId}`;
  return { subject, html, text };
}
