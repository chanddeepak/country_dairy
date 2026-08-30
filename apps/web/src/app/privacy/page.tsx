import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '../../components/legal/LegalPage';
import Pending from '../../components/legal/Pending';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What Country Dairy collects, why, who we share it with, and how to have it deleted.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="What we collect, why we collect it, and how to get rid of it."
      updated="30 August 2026"
    >
      <section>
        <h2>Who we are</h2>
        <p>
          Country Dairy sells ghee and cold-pressed oils from Tanakpur, Champawat,
          Uttarakhand 262309. The registered entity is <Pending>legal entity name</Pending> and
          our GSTIN is <Pending>GSTIN</Pending>. You can reach us at{' '}
          <a href="mailto:info@countrydairy.in">info@countrydairy.in</a> or on{' '}
          <a href="tel:+919997801112">+91 99978 01112</a>, daily between 6:00 AM and 9:00 PM.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <p>Only what an order needs, and nothing we cannot explain:</p>
        <ul>
          <li>
            <strong>Your mobile number.</strong> It is how you sign in — we send a one-time code
            to it — and how we reach you about a delivery. It is the one thing an account cannot
            exist without.
          </li>
          <li>
            <strong>Your name and email,</strong> when you give them. Used to address you and to
            send an order confirmation.
          </li>
          <li>
            <strong>Delivery addresses,</strong> including the one you type into the payment
            window. Each order keeps its own copy, so a later change never rewrites where a past
            parcel went.
          </li>
          <li>
            <strong>Order history</strong> — what you bought, what you paid, and the invoice.
          </li>
          <li>
            <strong>Basic usage,</strong> such as which pages were opened. This is counted on our
            own servers; we do not run third-party advertising or tracking scripts.
          </li>
        </ul>
      </section>

      <section>
        <h2>What we never see</h2>
        <p>
          <strong>Your card and bank details.</strong> Payments are handled inside Cashfree
          Payments&rsquo; own window. Card numbers, UPI PINs and net-banking credentials are
          entered there and never reach our servers or our staff. We receive only the result of
          the payment, the amount, and the address you gave them for delivery.
        </p>
        <p>We do not sell personal information, and we do not share it for advertising.</p>
      </section>

      <section>
        <h2>Who else handles it</h2>
        <ul>
          <li>
            <strong>Cashfree Payments</strong> — takes the payment and returns the delivery
            address.
          </li>
          <li>
            <strong>Delivery partners</strong> — receive the name, address and phone number
            needed to hand over a parcel, and nothing else.
          </li>
          <li>
            <strong>WhatsApp,</strong> where you have asked for updates there, so we can send
            dispatch and tracking messages.
          </li>
          <li>
            <strong>Our hosting and database providers,</strong> who store the data on our behalf.
          </li>
        </ul>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          Invoices and the order records attached to them are kept for{' '}
          <Pending>retention period — tax law sets a minimum</Pending>, because tax law requires
          it. Everything else is kept while your account is open.
        </p>
      </section>

      <section>
        <h2>Deleting your account</h2>
        <p>
          You can close your account from{' '}
          <Link href="/account">Profile &amp; Security</Link>. Your name, email, phone, saved
          addresses and reviews are erased.
        </p>
        <p>
          Past invoices survive, with the street address and phone stripped out of them. We are
          required to keep the tax record; we are not required to keep you in it. If you would
          rather ask us to do it, email{' '}
          <a href="mailto:info@countrydairy.in">info@countrydairy.in</a> from the address on the
          account.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          We use cookies and similar browser storage to keep you signed in and to remember what is
          in your basket. There are no advertising or cross-site tracking cookies. Clearing them
          signs you out and empties the basket.
        </p>
      </section>

      <section>
        <h2>Your rights, and how to complain</h2>
        <p>
          You can ask for a copy of what we hold, ask us to correct it, or ask us to delete it.
          Write to <a href="mailto:info@countrydairy.in">info@countrydairy.in</a> and we will
          answer within <Pending>response window</Pending>.
        </p>
        <p>
          Our grievance officer, as required under Indian law, is{' '}
          <Pending>grievance officer name and email</Pending>.
        </p>
      </section>
    </LegalPage>
  );
}
