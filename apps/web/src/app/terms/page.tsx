import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '../../components/legal/LegalPage';
import Pending from '../../components/legal/Pending';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms you agree to when you order from Country Dairy — pricing, payment, delivery and liability.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="The agreement between you and Country Dairy when you place an order."
      updated="30 August 2026"
    >
      <section>
        <h2>Who you are dealing with</h2>
        <p>
          This site is operated by <Pending>legal entity name</Pending> of Tanakpur, Champawat,
          Uttarakhand 262309, GSTIN <Pending>GSTIN</Pending>, FSSAI licence{' '}
          <Pending>FSSAI licence number — required for a food business</Pending>. Placing an order
          means you accept these terms.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          Accounts are created with your mobile number and a one-time code. Keep access to that
          number secure: anyone who can receive its messages can sign in as you. The number cannot
          be changed from the site, because it is the credential itself — email{' '}
          <a href="mailto:info@countrydairy.in">info@countrydairy.in</a> if it needs to change.
        </p>
        <p>You must be 18 or older to buy from us.</p>
      </section>

      <section>
        <h2>Prices and payment</h2>
        <ul>
          <li>All prices are in Indian Rupees and <strong>include GST</strong>.</li>
          <li>
            Delivery is <strong>free on orders of ₹500 or more</strong>. Below that a flat ₹40 is
            added.
          </li>
          <li>
            Payment is taken by Cashfree Payments. An order is confirmed when they tell us the
            payment succeeded, not when it is placed.
          </li>
          <li>
            Where a discount or coupon applies, the amount actually charged is the amount on your
            invoice, and the tax is recalculated on it.
          </li>
        </ul>
        <p>
          We may correct a price that is obviously wrong. If that happens after you have paid, we
          will contact you and refund in full rather than send something you did not agree to buy.
        </p>
      </section>

      <section>
        <h2>Stock</h2>
        <p>
          Stock is held for you while a checkout is in progress and released if the payment is not
          completed. If something sells out between your order and our packing it, we will tell
          you and refund that item.
        </p>
      </section>

      <section>
        <h2>Delivery</h2>
        <p>
          We deliver across India, locally by our own round and elsewhere by courier. Timelines
          and charges are on the{' '}
          <Link href="/shipping-and-returns">Shipping &amp; Returns</Link> page, which forms part
          of these terms.
        </p>
      </section>

      <section>
        <h2>Food, and what we promise about it</h2>
        <p>
          Every batch is lab tested and the report is published — you can read the one for your
          jar from its batch code. What we claim about purity, we can show.
        </p>
        <p>
          What we do not claim: our products are food, not medicine. Nothing on this site is
          medical advice or a promise of a health outcome. Store as directed on the label, and use
          before the date printed on it.
        </p>
      </section>

      <section>
        <h2>Reviews you write</h2>
        <p>
          You keep ownership of a review you post, and give us permission to show it on the
          product page. We remove reviews that are abusive, fraudulent or not about the product.
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>
          Where something goes wrong with an order, our responsibility is limited to the amount
          you paid for it. Nothing here limits liability that cannot be limited under Indian law,
          including for death or personal injury caused by negligence.
        </p>
      </section>

      <section>
        <h2>Disputes</h2>
        <p>
          These terms are governed by the laws of India, and the courts at{' '}
          <Pending>jurisdiction — the city whose courts apply</Pending> have jurisdiction. Please
          write to us first: most things are settled faster over email than anywhere else.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these terms. The version in force for your order is the one published when
          you placed it, and the date at the top tells you when this one was last changed.
        </p>
      </section>
    </LegalPage>
  );
}
