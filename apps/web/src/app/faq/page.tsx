import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '../../components/legal/LegalPage';
import Pending from '../../components/legal/Pending';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description:
    'Ordering, delivery, payment, batch lab reports and storage — the questions we are asked most.',
  alternates: { canonical: '/faq' },
};

/**
 * Plain <h3>/<p> rather than an accordion.
 *
 * An answer hidden behind a click is an answer a crawler indexes and a reader
 * does not find, and there are few enough questions here that hiding them buys
 * nothing.
 */
export default function FaqPage() {
  return (
    <LegalPage
      title="Frequently asked questions"
      intro="If your question is not here, message us — we read every one."
      updated="30 August 2026"
    >
      <section>
        <h2>Ordering</h2>

        <h3>Do I need an account?</h3>
        <p>
          No. You can order as a guest — the payment window asks for your mobile number and
          address, and we create the account from that so you can find the order later. If you
          already have an account with that number, the order joins it rather than making a
          second one.
        </p>

        <h3>How do I sign in?</h3>
        <p>
          With your mobile number. We send a one-time code to it; there is no password to
          remember or lose.
        </p>

        <h3>Can I order for someone else?</h3>
        <p>
          Yes. Enter their address at payment. The order stays in your account and your details
          stay yours — the delivery address describes where it goes, not who you are.
        </p>

        <h3>Can I change or cancel an order?</h3>
        <p>
          Before dispatch, yes — email or call us with the order number. See{' '}
          <Link href="/shipping-and-returns">Shipping &amp; Returns</Link>.
        </p>
      </section>

      <section>
        <h2>Payment</h2>

        <h3>How can I pay?</h3>
        <p>
          Cards, UPI, net banking and wallets, through Cashfree Payments. Their window handles the
          whole payment — we never see your card or UPI details.
        </p>

        <h3>Do you take cash on delivery?</h3>
        <p>
          <Pending>whether COD is offered</Pending>.
        </p>

        <h3>My payment failed but money left my account.</h3>
        <p>
          That is usually a pending authorisation, and it reverses on its own within a few working
          days. Send us the order number and we will check it against the gateway.
        </p>

        <h3>Are prices inclusive of GST?</h3>
        <p>Yes. The price you see is the price you pay, and the invoice shows the tax within it.</p>
      </section>

      <section>
        <h2>Delivery</h2>

        <h3>What does delivery cost?</h3>
        <p>Free on orders of ₹500 or more, otherwise a flat ₹40.</p>

        <h3>Where do you deliver?</h3>
        <p>
          Across India — locally on our own round around Tanakpur, and by courier everywhere else.
          We do not ship abroad.
        </p>

        <h3>How do I track my order?</h3>
        <p>
          Sign in and open the order, or use the tracking number we send by WhatsApp or email once
          it is with the courier.
        </p>
      </section>

      <section>
        <h2>The product</h2>

        <h3>What makes it A2 ghee?</h3>
        <p>
          It is made from the milk of desi cows, whose milk carries the A2 beta-casein protein,
          using the traditional bilona method — curd churned to butter, then slow-simmered.
        </p>

        <h3>Can I see the lab report for my jar?</h3>
        <p>
          Yes. Every batch is tested and the report published. The batch code is on the label, and
          it opens the report for that batch — not a generic certificate.
        </p>

        <h3>How should I store it?</h3>
        <p>
          Somewhere cool and dry, away from sunlight, with a dry spoon. Ghee does not need
          refrigeration; it may turn grainy or firm depending on the weather, and that is normal.
        </p>

        <h3>How long does it keep?</h3>
        <p>Until the date printed on the jar. Once opened, use it within <Pending>opened shelf life</Pending>.</p>
      </section>

      <section>
        <h2>Still stuck?</h2>
        <p>
          <a href="mailto:info@countrydairy.in">info@countrydairy.in</a> ·{' '}
          <a href="tel:+919997801112">+91 99978 01112</a> · daily, 6:00 AM to 9:00 PM. Or use the
          form at the bottom of any page — no account needed.
        </p>
      </section>
    </LegalPage>
  );
}
