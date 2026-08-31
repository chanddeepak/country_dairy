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
          Uttarakhand 262309. The registered entity is <Pending>legal entity name</Pending>,
          company identification number <Pending>CIN, if a registered company</Pending>, GSTIN{' '}
          <Pending>GSTIN</Pending>, FSSAI licence{' '}
          <Pending>FSSAI licence number</Pending>. You can reach us at{' '}
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
        <h2>Cookies and browser storage</h2>
        <p>
          <strong>This site sets no cookies at all.</strong> What it does use is your browser&rsquo;s
          own storage, and only for things the shop cannot work without:
        </p>
        <ul>
          <li>
            <code>cd_token</code> and <code>cd_user</code> — keep you signed in, so you are not
            asked for a code on every page.
          </li>
          <li>
            <code>cd_guest_cart</code> — remembers your basket before you sign in.
          </li>
          <li>
            <code>cd_pending_checkout</code> and <code>cd_claim_…</code> — held only until the tab
            is closed, so that a checkout interrupted halfway can be picked up as the same order
            rather than becoming a second one.
          </li>
        </ul>
        <p>
          None of these follow you to other sites, and there is no advertising or analytics
          tracker on this one. Clearing your browser storage signs you out and empties the basket;
          nothing else is lost.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          This shop is not for children. You must be 18 or over to hold an account or place an
          order, and we do not knowingly collect anything about anyone younger. If you believe a
          child has given us their details, write to{' '}
          <a href="mailto:info@countrydairy.in">info@countrydairy.in</a> and we will delete them.
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
