import { Link } from "wouter";
import { LogoMark } from "@/components/Logo";

// Update these before publishing.
const APP_NAME = "Dev Tracker";
const COMPANY_NAME = "Webshinez";
const CONTACT_EMAIL = "support@webshinez.com";
const LAST_UPDATED = "October 10, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <main className="max-w-3xl mx-auto px-4 py-10 md:py-16 space-y-10">
        <header className="space-y-2">
          <div className="flex items-center gap-2 pb-4">
            <LogoMark className="h-9 w-9" />
            <span className="text-lg font-bold">{APP_NAME}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          <p className="text-muted-foreground leading-relaxed">
            This Privacy Policy explains how {COMPANY_NAME} ("we", "us", "our") collects, uses and
            protects information when you use {APP_NAME} (the "App"), a requirement and workflow
            tracker for development and QA teams.
          </p>
        </header>

        <Section title="1. Information We Collect">
          <p>We only collect information needed to operate the App:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Account information</strong> — your name, email
              address, username and role. Accounts are created by your organization's
              administrator. Passwords are stored only as secure one-way hashes; we never store
              them in plain text.
            </li>
            <li>
              <strong className="text-foreground">Work content</strong> — projects, requirements,
              comments, status changes, assignments, references and other content you or your
              teammates create in the App, along with who made each change and when.
            </li>
            <li>
              <strong className="text-foreground">File attachments</strong> — images, PDFs,
              spreadsheets and CSV files you upload to requirements or comments, including their
              original file names.
            </li>
            <li>
              <strong className="text-foreground">Session data</strong> — when you sign in, we
              set a session cookie so you stay logged in. Session records are stored on our
              server and expire after 14 days of inactivity or when you log out.
            </li>
          </ul>
          <p>
            We do not use advertising, analytics or third-party tracking cookies, and we do not
            collect location, contacts or other device data.
          </p>
        </Section>

        <Section title="2. How We Use Information">
          <ul className="list-disc pl-6 space-y-2">
            <li>To authenticate you and keep your account secure.</li>
            <li>To provide the App's features: tracking requirements, assignments and reviews.</li>
            <li>
              To send email notifications about activity relevant to you, such as status changes,
              new comments and assignments.
            </li>
            <li>To maintain, troubleshoot and improve the App.</li>
          </ul>
          <p>We do not sell, rent or trade your personal information.</p>
        </Section>

        <Section title="3. Service Providers">
          <p>We use trusted infrastructure providers to run the App:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Amazon Web Services (AWS) S3</strong> — stores
              uploaded file attachments.
            </li>
            <li>
              <strong className="text-foreground">Amazon Simple Email Service (SES)</strong> —
              delivers notification emails to your email address.
            </li>
          </ul>
          <p>
            These providers process data only on our behalf and under their own security and
            privacy commitments. We may also disclose information if required by law.
          </p>
        </Section>

        <Section title="4. Who Can See Your Information">
          <p>
            The App is used within your organization. Your name, role and the content you create
            are visible to other members of your organization according to their permissions
            (for example, administrators, team leaders and assigned teammates).
          </p>
        </Section>

        <Section title="5. Data Retention">
          <p>
            We keep account information and work content for as long as your organization uses
            the App or until deletion is requested. Session records are removed automatically
            when they expire.
          </p>
        </Section>

        <Section title="6. Security">
          <p>
            We protect your information using encrypted HTTPS connections, hashed passwords,
            secure HTTP-only session cookies and access controls on our servers and storage. No
            method of transmission or storage is completely secure, but we work to protect your
            data using industry-standard practices.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>
            You may request access to, correction of, or deletion of your personal information
            by contacting your organization's administrator or emailing us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
            . We will respond within a reasonable time.
          </p>
        </Section>

        <Section title="8. Children's Privacy">
          <p>
            The App is intended for professional use and is not directed to children under 13.
            We do not knowingly collect personal information from children.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on this
            page with an updated "Last updated" date.
          </p>
        </Section>

        <Section title="10. Contact Us">
          <p>
            If you have questions about this Privacy Policy, contact {COMPANY_NAME} at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <footer className="pt-6 border-t text-sm text-muted-foreground">
          <Link href="/login" className="text-primary underline underline-offset-4">
            Go to {APP_NAME}
          </Link>
        </footer>
      </main>
    </div>
  );
}
