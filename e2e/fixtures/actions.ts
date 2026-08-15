import { expect, type Page } from '@playwright/test';
import { ADMIN, STOREFRONT } from '../../playwright.config';

/**
 * Selectors, in one place.
 *
 * The forms in this project do not associate labels with inputs — no `id`,
 * no `name`, no `aria-label` — so `getByRole('textbox', { name: /email/i })`
 * matches nothing and fails only after the action timeout expires. Selecting
 * on `type` is what actually works today.
 *
 * These are worth replacing with `data-testid` attributes on the components;
 * until then, changing a selector means changing it here and nowhere else.
 */
export const SEL = {
  // Scoped to the modal, not the page. The footer carries a contact form with
  // its own email field on every route, so a bare input[type="email"] matches
  // twice and trips strict mode — which is how three specs broke on a change
  // that never touched them. A selector shared across specs has to name the
  // thing it means, not the first element that happens to look like it.
  authModal: '[data-testid="auth-modal"]',
  emailInput: '[data-testid="auth-modal"] input[type="email"]',
  passwordInput: '[data-testid="auth-modal"] input[type="password"]',
  submit: '[data-testid="auth-modal"] button[type="submit"]',

  // The console is a separate app with a full-page sign-in and no footer, so
  // these stay unscoped. They were the same three selectors until scoping the
  // storefront's broke the console's sign-in — one name cannot mean the modal
  // on one host and the whole page on another.
  adminEmailInput: 'input[type="email"]',
  adminPasswordInput: 'input[type="password"]',
  adminSubmit: 'button[type="submit"]',

  // Icon-only controls carry no accessible name, so these are the only stable
  // way to reach them — and they survive copy changes, which a text selector
  // would not.
  openAuth: '[data-testid="open-auth"]',
  openCart: '[data-testid="open-cart"]',
  cartCount: '[data-testid="cart-count"]',
  toggleRegister: '[data-testid="toggle-register"]',
  signupName: '[data-testid="signup-name"]',
  // The detail page's own button. A role+name selector also matches the
  // related-product cards further down and trips strict mode.
  addToCart: '[data-testid="add-to-cart"]',

  // Checkout. The address fields carry no labels, so they are reached by
  // placeholder — the one attribute they do have.
  addAddress: '[data-testid="add-address"]',
  addressForm: '[data-testid="address-form"]',
  addressLine1: 'input[placeholder*="Street"]',
  addressCity: 'input[placeholder="City"]',
  addressState: 'input[placeholder="State"]',
  addressPincode: 'input[placeholder="Pincode"]',
  addressPhone: 'input[type="tel"]',
  placeOrder: '[data-testid="place-order"]',
  confirmPayment: '[data-testid="confirm-payment"]',

  // Browsing and the cart drawer, for the journey spec — the one that reaches
  // every screen by clicking rather than by URL.
  productCardLink: '[data-testid="product-card-link"]',
  variantOption: '[data-testid="variant-option"]',
  checkoutNow: '[data-testid="checkout-now"]',
  qtyIncrease: '[data-testid="qty-increase"]',
  qtyDecrease: '[data-testid="qty-decrease"]',
};

/** Registers through the storefront's own modal, as a customer would. */
export async function registerOnStorefront(
  page: Page,
  details: { name: string; email: string; password: string },
): Promise<void> {
  await page.goto(STOREFRONT);
  await page.locator(SEL.openAuth).click();
  await page.locator(SEL.toggleRegister).click();
  await page.locator(SEL.signupName).fill(details.name);
  await page.locator(SEL.emailInput).fill(details.email);
  await page.locator(SEL.passwordInput).fill(details.password);
  await page.locator(SEL.submit).click();
}

/**
 * Signs into the admin console through its own form.
 *
 * Navigates to an absolute URL: the setup project drives both the console and
 * the storefront, so it has no single baseURL to resolve "/" against.
 */
export async function signInToAdmin(page: Page, email: string, password: string): Promise<void> {
  await page.goto(ADMIN);
  await page.locator(SEL.adminEmailInput).fill(email);
  await page.locator(SEL.adminPasswordInput).fill(password);
  await page.locator(SEL.adminSubmit).click();
}

/**
 * Plants a storefront session.
 *
 * The storefront keeps its session in localStorage rather than a cookie, so
 * there is nothing for Playwright's storageState to carry on its own.
 */
export async function signInToStorefront(
  page: Page,
  session: { id: string; email: string; token: string; name?: string },
): Promise<void> {
  await page.goto(STOREFRONT);
  await page.evaluate(
    ([token, user]) => {
      localStorage.setItem('cd_token', token as string);
      localStorage.setItem('cd_user', user as string);
    },
    [
      session.token,
      JSON.stringify({
        id: session.id,
        email: session.email,
        name: session.name ?? 'E2E Customer',
        addresses: [],
      }),
    ],
  );
}

/**
 * Fails with the page's own error text rather than a bare timeout.
 *
 * A screenshot tells you the assertion failed; this tells you what the app
 * said about it, which is usually the actual answer.
 */
export async function expectVisibleOrExplain(
  page: Page,
  locator: ReturnType<Page['locator']>,
  what: string,
): Promise<void> {
  try {
    await expect(locator).toBeVisible();
  } catch (err) {
    const visible = (await page.locator('body').innerText().catch(() => '')).slice(0, 600);
    throw new Error(`${what}\n\nWhat the page actually showed:\n${visible}`);
  }
}
