import {
  browser, freshPage, addToCart, openCheckout, shot, randomPhone, signIn,
  cfEnterPhone, cfEnterOtp, cfAddAddress, cfProceedToPay, cfPayByNetBanking, cf,
} from './lib.mjs';

const results = [];
const b = await browser();

/** One complete guest-or-signed-in purchase, reporting what it did. */
async function purchase({ id, label, signInAs, cfPhone, address, outcome = 'SUCCESS', entry }) {
  const { ctx, page } = await freshPage(b);
  const out = { id, label, phone: cfPhone, orderId: null, note: '' };
  try {
    if (signInAs) out.signedInAs = (await signIn(page, signInAs)).phone;

    if (entry === 'home') {
      await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
      const btn = page.getByRole('button', { name: /add to (cart|basket)/i }).first();
      await btn.scrollIntoViewIfNeeded();
      await btn.click({ force: true });
      await page.waitForTimeout(2500);
    } else if (entry === 'detail') {
      await page.goto('http://localhost:3000/products', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      await page.locator('a[href^="/products/"]').first().click();
      await page.waitForTimeout(3000);
      await page.getByRole('button', { name: /add to (cart|basket)/i }).first().click();
      await page.waitForTimeout(2500);
    } else {
      await addToCart(page);
    }

    await openCheckout(page);
    out.cashfreeOpened = !!cf(page);
    await shot(page, `${id}-1-modal`);

    const typed = await cfEnterPhone(page, cfPhone);
    out.typedPhone = typed;
    if (typed) await cfEnterOtp(page);
    await page.waitForTimeout(2000);

    if (address) {
      out.addedAddress = await cfAddAddress(page, address);
    }
    await shot(page, `${id}-2-address`);

    if (outcome === 'ABANDON') {
      await cfProceedToPay(page);
      await shot(page, `${id}-3-abandoned`);
      out.note = 'left at the payment screen without paying';
      // Recover the order id from what checkout stored.
      out.orderId = await page.evaluate(() => {
        const k = Object.keys(sessionStorage).find((x) => x.startsWith('cd_claim_'));
        return k ? k.replace('cd_claim_', '') : null;
      });
    } else {
      await cfProceedToPay(page);
      await cfPayByNetBanking(page, outcome);
      const m = page.url().match(/orders\/([0-9a-f-]{36})/);
      out.orderId = m ? m[1] : null;
      out.landedOn = page.url().replace('http://localhost:3000', '');
      await shot(page, `${id}-3-done`);
    }
  } catch (e) {
    out.error = String(e).split('\n')[0].slice(0, 160);
  }
  await ctx.close();
  results.push(out);
  console.log(JSON.stringify(out));
  return out;
}

const A = randomPhone();   // a customer who will order twice
const GUEST = randomPhone();

// 1. Guest, number we have never seen.
await purchase({ id: 's1', label: 'guest, new number', cfPhone: GUEST,
  address: { name: 'Guest One', pin: '560037', city: 'Bengaluru', line1: '1 New Road', email: `g${GUEST}@example.com` } });

// 2. Same number again as a guest — must attach, not duplicate.
await purchase({ id: 's2', label: 'guest, number already has an account', cfPhone: GUEST });

// 3. Signed in with our OTP, paying with the same number.
await purchase({ id: 's3', label: 'signed in, own number', signInAs: A, cfPhone: A,
  address: { name: 'Customer A', pin: '110001', city: 'New Delhi', line1: '2 Own Street', email: `a${A}@example.com` } });

// 4. Signed in, delivering to somebody else — the gift case.
await purchase({ id: 's4', label: 'signed in, ordering for someone else', signInAs: A, cfPhone: A,
  address: { name: 'Recipient Person', pin: '400001', city: 'Mumbai', line1: '9 Gift Lane', email: `gift${A}@example.com` } });

// 7. Abandoned at the payment screen.
const D = randomPhone();
await purchase({ id: 's7', label: 'abandoned at payment', cfPhone: D,
  address: { name: 'Dropper', pin: '560037', city: 'Bengaluru', line1: '3 Left Road', email: `d${D}@example.com` },
  outcome: 'ABANDON' });

// 8. Entry points.
await purchase({ id: 's8a', label: 'entry: home page', cfPhone: randomPhone(), entry: 'home', outcome: 'ABANDON' });
await purchase({ id: 's8b', label: 'entry: product detail', cfPhone: randomPhone(), entry: 'detail', outcome: 'ABANDON' });

console.log('\n=== SUMMARY ===');
console.log(JSON.stringify({ A, GUEST, results }, null, 1));
await b.close();
