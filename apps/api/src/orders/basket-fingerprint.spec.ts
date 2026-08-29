import { basketFingerprint } from './pricing';

/**
 * The fingerprint carried by the gateway order id.
 *
 * It decides two things at once — whether an interrupted checkout can be
 * picked up, and what the Cashfree order is called — so it has to change when
 * the money changes and stay put when nothing does. Cashfree cannot amend an
 * order after it is made (probed: PATCH takes only order_status), so a basket
 * that changed genuinely needs a new one, and this is what says so.
 */
const line = (variantId: string, quantity: number, unitPrice: number) => ({
  variantId,
  quantity,
  unitPrice,
});

describe('basketFingerprint', () => {
  it('is the same for the same basket', () => {
    const a = basketFingerprint([line('v1', 1, 1450)], 1450);
    const b = basketFingerprint([line('v1', 1, 1450)], 1450);
    expect(a).toBe(b);
  });

  it('is the same after emptying the cart and adding the same thing back', () => {
    /*
     * The case that matters most. Stock is held by the order, not the cart, so
     * a customer who clears their basket and re-adds the same jar must land on
     * the same order — otherwise one person holds the last jar twice and it
     * reads as sold out to everybody else.
     */
    const before = basketFingerprint([line('v1', 1, 1450)], 1450);
    const afterReAdding = basketFingerprint([line('v1', 1, 1450)], 1450);
    expect(afterReAdding).toBe(before);
  });

  it('changes when the quantity changes', () => {
    expect(basketFingerprint([line('v1', 2, 1450)], 2900)).not.toBe(
      basketFingerprint([line('v1', 1, 1450)], 1450),
    );
  });

  it('changes when a line is added', () => {
    expect(
      basketFingerprint([line('v1', 1, 1450), line('v2', 1, 780)], 2230),
    ).not.toBe(basketFingerprint([line('v1', 1, 1450)], 1450));
  });

  it('changes when the price changes but the basket does not', () => {
    // A discount that moves the total must produce a new gateway order, since
    // theirs cannot be amended to the new amount.
    expect(basketFingerprint([line('v1', 1, 1250)], 1250)).not.toBe(
      basketFingerprint([line('v1', 1, 1450)], 1450),
    );
  });

  it('does not depend on the order the lines arrive in', () => {
    // Two carts holding the same things are the same cart; the customer did
    // not change anything by adding them the other way round.
    expect(basketFingerprint([line('v1', 1, 1450), line('v2', 2, 780)], 3010)).toBe(
      basketFingerprint([line('v2', 2, 780), line('v1', 1, 1450)], 3010),
    );
  });

  it('is short and hex, so it reads cleanly in an order id', () => {
    // CD-2026-15-a3f9c2 — the number leads, so it is searchable in their
    // dashboard beside a support conversation.
    expect(basketFingerprint([line('v1', 1, 1450)], 1450)).toMatch(/^[0-9a-f]{6}$/);
  });
});
