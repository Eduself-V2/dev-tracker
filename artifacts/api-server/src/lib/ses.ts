import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const region = process.env.AWS_REGION ?? "us-east-1";

const clientConfig: ConstructorParameters<typeof SESClient>[0] = { region };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const ses = new SESClient(clientConfig);

export async function sendEmail(
  to: string[],
  subject: string,
  htmlBody: string,
): Promise<void> {
  const from = process.env.SES_FROM_EMAIL;
  if (!from) {
    console.warn("[SES] SES_FROM_EMAIL not set — skipping email");
    return;
  }
  const filtered = to.filter(Boolean);
  if (filtered.length === 0) return;

  try {
    await ses.send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: filtered },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Html: { Data: htmlBody, Charset: "UTF-8" } },
        },
      }),
    );
  } catch (err) {
    console.error("[SES] Failed to send email:", err);
  }
}
