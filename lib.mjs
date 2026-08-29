import { chromium } from '@playwright/test';

export const SHOTS = process.env.SHOTS;
export const WEB = 'http://localhost:3000';
export const API = 'http://localhost:4000/api';
export const CF_OTP = '111000';

/** A random Indian mobile — sandbox, so any valid-looking number works. */
export function randomPhone() {
  const rest = String(Math.floor(100000000 + Math.random() * 899999999)).slice(0, 9);
  return `9${rest}`;
}

export async function browser() {
  return chromium.launch();
}

/** A fresh context each time: Cashfree remembers a browser once it authenticates. */
export async function freshPage(b) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  return { ctx, page };
}

export async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Signs in through the API and seeds the session the storefront reads on boot. */
export async function signIn(page, phone) {
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const r = await page.evaluate(async ({ api, phone }) => {
    await fetch(`${api}/auth/send-otp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: `+91${phone}` }),
    });
    const res = await fetch(`${api}/auth/verify-otp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: `+91${phone}`, otp: '123456' }),
    });
    return res.json();
  }, { api: API, phone });
  if (!r.accessToken) throw new Error('sign-in failed: ' + JSON.stringify(r).slice(0, 200));
  await page.evaluate(({ t, u }) => {
    localStorage.setItem('cd_token', t);
    localStorage.setItem('cd_user', JSON.stringify(u));
  }, { t: r.accessToken, u: r.user });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  return r.user;
}

export async function addToCart(page) {
  await page.goto(`${WEB}/products`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const btn = page.getByRole('button', { name: /add to (cart|basket)/i }).first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ force: true });
  await page.waitForTimeout(2500);
}

export async function openCheckout(page) {
  await page.locator('[data-testid="open-cart"]').first().click();
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="checkout-now"]').first().click();
  // Their modal takes 15-20s to paint; screenshotting sooner shows a blank box.
  await page.waitForTimeout(20000);
}

/**
 * The Cashfree modal's frame.
 *
 * Found by URL rather than by a frameLocator selector: the iframe element's
 * `src` attribute is empty in the DOM even though the frame itself has
 * navigated to their checkout, so any `iframe[src*=...]` selector matches
 * nothing.
 */
export function cf(page) {
  return page.frames().find((f) => /cashfree\.com\/checkout/.test(f.url())) ?? null;
}

/** Types the number and asks for their OTP. Returns false if already past it. */
export async function cfEnterPhone(page, phone) {
  const frame = cf(page);
  if (!frame) return false;
  const input = frame.locator('input[type="text"]').first();
  if (!(await input.count().catch(() => 0))) return false;
  await input.fill(phone);
  await page.waitForTimeout(800);
  await frame.getByRole('button', { name: /continue/i }).first().click();
  await page.waitForTimeout(8000);
  return true;
}

/** Their sandbox accepts 111000 on the login step — undocumented but it works. */
export async function cfEnterOtp(page) {
  const frame = cf(page);
  if (!frame) return false;
  const boxes = frame.locator('input');
  const n = await boxes.count().catch(() => 0);
  if (!n) return false;
  // Six single-character boxes; typing into the first cascades.
  await boxes.first().click();
  await page.keyboard.type(CF_OTP, { delay: 120 });
  await page.waitForTimeout(9000);
  return true;
}

/** Address step -> payment options. */
export async function cfProceedToPay(page) {
  const frame = cf(page);
  if (!frame) return false;
  const btn = frame.getByRole('button', { name: /proceed to pay/i }).first();
  if (!(await btn.count().catch(() => 0))) return false;
  await btn.click();
  await page.waitForTimeout(9000);
  return true;
}

/**
 * Pays through their net-banking simulator.
 *
 * Not cards: entering card numbers into a payment form is not something to
 * automate, and the simulator is a plain success/failure page with no
 * credentials at all.
 */
export async function cfPayByNetBanking(page, outcome = 'SUCCESS') {
  const frame = cf(page);
  if (!frame) return false;
  await frame.getByText(/net banking/i).first().click();
  await page.waitForTimeout(4000);
  await frame.getByText(/state bank of india/i).first().click();
  await page.waitForTimeout(3000);
  await frame.getByRole('button', { name: /proceed to pay/i }).first().click();

  const sim = await page.context().waitForEvent('page', { timeout: 45000 });
  await sim.waitForLoadState('domcontentloaded');
  await sim.waitForTimeout(3000);
  await sim.locator('input').first().fill(CF_OTP);
  await sim.getByText(outcome, { exact: false }).first().click();
  await sim.waitForTimeout(500);
  await sim.getByRole('button', { name: /submit/i }).first().click();
  await page.waitForTimeout(20000);
  return true;
}

/** Fills their address form. Field ids read off the live form, not guessed. */
export async function cfAddAddress(page, addr) {
  const f = cf(page);
  if (!f) return false;
  if (!(await f.locator('#customer_name').count().catch(() => 0))) return false;

  await f.locator('#customer_name').fill(addr.name);
  await f.locator('#zip_code').fill(addr.pin);
  await page.waitForTimeout(2500); // pincode lookup fills city and state
  await f.locator('#address_line_one').fill(addr.line1);
  if (addr.line2) await f.locator('#address_line_two').fill(addr.line2);
  if (addr.email) await f.locator('#email').fill(addr.email);
  const city = await f.locator('#city').inputValue().catch(() => '');
  if (!city) await f.locator('#city').fill(addr.city);
  await page.waitForTimeout(800);
  await f.getByRole('button', { name: /save address/i }).first().click();
  await page.waitForTimeout(9000);
  return true;
}
