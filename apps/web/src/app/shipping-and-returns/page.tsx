import type { Metadata } from 'next';
import LegalPage from '../../components/legal/LegalPage';
import Pending from '../../components/legal/Pending';

export const metadata: Metadata = {
  title: 'Shipping & Returns',
  description:
    'Delivery charges and timelines, and how cancellations, returns and refunds work at Country Dairy.',
  alternates: { canonical: '/shipping-and-returns' },
};

export default function ShippingAndReturnsPage() {
  return (
    <LegalPage
      title="Shipping & Returns"
      intro="What delivery costs, how long it takes, and what happens when something is wrong."
      updated="30 August 2026"
    >
      <section>
        <h2>What delivery costs</h2>
        <ul>
          <li>
            <strong>Free</strong> on orders of ₹500 or more.
          </li>
          <li>
            <strong>₹40</strong> below that, as a flat charge wherever you are.
          </li>
        </ul>
        <p>The charge is shown before you pay and appears on your invoice.</p>
      </section>

      <section>
        <h2>How long it takes</h2>
        <p>
          Orders are packed on <Pending>packing days</Pending> and dispatched within{' '}
          <Pending>dispatch window</Pending>.
        </p>
        <ul>
          <li>
            <strong>Around Tanakpur,</strong> on our own delivery round —{' '}
            <Pending>local delivery timeline</Pending>.
          </li>
          <li>
            <strong>Elsewhere in India,</strong> by courier —{' '}
            <Pending>courier timeline</Pending>.
          </li>
        </ul>
        <p>
          Once a parcel is with a courier you will get a tracking number by WhatsApp or email. We
          do not ship outside India.
        </p>
      </section>

      <section>
        <h2>Cancelling an order</h2>
        <p>
          You can cancel any time before it is dispatched, by emailing{' '}
          <a href="mailto:info@countrydairy.in">info@countrydairy.in</a> or calling{' '}
          <a href="tel:+919997801112">+91 99978 01112</a> with your order number. A cancelled
          order is refunded in full.
        </p>
        <p>
          After dispatch it becomes a return, below. An unpaid or abandoned checkout is not an
          order and nothing is charged for it.
        </p>
      </section>

      <section>
        <h2>Returns</h2>
        <p>
          Ghee and oils are food, so we cannot resell an opened jar. That shapes what we can take
          back:
        </p>
        <ul>
          <li>
            <strong>Damaged, leaking, or the wrong item</strong> — tell us within{' '}
            <Pending>damage report window</Pending> of delivery, with a photograph. We replace it
            or refund it, and you do not pay return postage.
          </li>
          <li>
            <strong>Sealed and unopened</strong> — returnable within{' '}
            <Pending>return window</Pending> of delivery, in its original packaging.{' '}
            <Pending>who pays return postage</Pending>.
          </li>
          <li>
            <strong>Opened</strong> — cannot be returned for hygiene and food-safety reasons,
            unless it is faulty. If something is wrong with the product itself, tell us regardless
            of whether it has been opened.
          </li>
        </ul>
      </section>

      <section>
        <h2>Refunds</h2>
        <p>
          Refunds go back to the method you paid with — we cannot send them anywhere else. Once
          approved, we process them within <Pending>refund processing time</Pending>; your bank
          then takes its own time, usually five to seven working days, to show it.
        </p>
        <p>
          A refund covers what you paid for the item. Where a discount applied, the refund is of
          the discounted amount actually charged. Delivery charges are refunded when the fault was
          ours.
        </p>
      </section>

      <section>
        <h2>If a payment fails</h2>
        <p>
          Nothing is charged and the order is not placed. If money has left your account for an
          order you cannot see, it is almost always a pending authorisation that reverses on its
          own within a few working days — send us the order number and we will check it against
          the gateway.
        </p>
      </section>

      <section>
        <h2>Getting hold of us</h2>
        <p>
          <a href="mailto:info@countrydairy.in">info@countrydairy.in</a> ·{' '}
          <a href="tel:+919997801112">+91 99978 01112</a> · daily, 6:00 AM to 9:00 PM. Quote your
          order number and it will be faster.
        </p>
      </section>
    </LegalPage>
  );
}
