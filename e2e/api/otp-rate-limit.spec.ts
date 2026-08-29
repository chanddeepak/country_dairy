import { test, expect } from '@playwright/test';
import { db, RUN_ID } from '../fixtures/db';
import { apiClient, resolve } from '../fixtures/api';

/**
 * The limits on the sign-in code endpoint.
 *
 * This endpoint is the only one on the API that spends money on every call —
 * a WhatsApp authentication template per request — so its limits are a billing
 * control as much as a security one, and they get asserted rather than trusted.
 *
 * The per-phone limit is the obvious one and the least useful: an attacker
 * never reuses a number. The per-IP limit is the one that actually stops a
 * script, which is why it is tested with a different number every time.
 */
test.describe('OTP rate limits @security', () => {
  // A distinct 10-digit body per run so a previous run's rows can never make
  // this one start already throttled, and vice versa.
  const suffix = Number(BigInt(`0x${RUN_ID.replace(/\D/g, '') || '1'}`) % 1000n)
    .toString()
    .padStart(3, '0');
  const phones: string[] = [];

  function phone(n: number): string {
    const p = `+919${suffix}${String(n).padStart(6, '0')}`;
    phones.push(p);
    return p;
  }

  test.afterAll(async () => {
    if (phones.length) {
      await db.otpVerification.deleteMany({ where: { phone: { in: phones } } });
      await db.user.deleteMany({ where: { phone: { in: phones }, email: null } });
    }
  });

  async function flagOn(): Promise<boolean> {
    const row = await db.featureFlag.findUnique({ where: { key: 'ENABLE_OTP_LOGIN' } });
    return Boolean(row?.isEnabled);
  }

  async function send(to: string): Promise<number> {
    const api = await apiClient();
    const res = await api.post(resolve('/auth/send-otp'), { data: { phone: to } });
    await api.dispose();
    return res.status();
  }

  test('the flag has a row, so the console can switch it', async () => {
    // ENABLE_SHIPROCKET_CHECKOUT spent months declared in code with no row, so
    // nothing could turn it on. A feature nobody can switch is not behind a flag.
    const row = await db.featureFlag.findUnique({ where: { key: 'ENABLE_OTP_LOGIN' } });
    expect(row, 'ENABLE_OTP_LOGIN has no row to switch').toBeTruthy();
  });

  test('one phone is cut off after five requests', async () => {
    test.skip(!(await flagOn()), 'Phone sign-in is switched off');

    const target = phone(1);
    for (let i = 1; i <= 5; i += 1) {
      expect(await send(target), `request ${i} should still be allowed`).toBe(200);
    }
    expect(await send(target), 'the sixth request should be refused').toBe(400);
  });

  test('one caller is cut off even when every request uses a new number', async () => {
    test.skip(!(await flagOn()), 'Phone sign-in is switched off');

    /*
     * The attack the per-phone limit does not touch. Ten are allowed per IP per
     * hour; the previous test already spent some of this run's budget from the
     * same address, so this asserts that a refusal arrives within the remaining
     * window rather than at an exact index.
     */
    let refused = false;
    for (let i = 2; i <= 14 && !refused; i += 1) {
      refused = (await send(phone(i))) === 400;
    }

    expect(refused, 'cycling numbers from one address was never refused').toBe(true);
  });

  test('a refusal never says which limit was hit', async () => {
    test.skip(!(await flagOn()), 'Phone sign-in is switched off');

    const api = await apiClient();
    const res = await api.post(resolve('/auth/send-otp'), { data: { phone: phone(99) } });
    const body = await res.text();
    await api.dispose();

    if (res.status() === 400) {
      // Naming the limit tells a caller how to stay under the other one.
      expect(body).not.toMatch(/ip|address|daily|per phone/i);
    }
  });
});
