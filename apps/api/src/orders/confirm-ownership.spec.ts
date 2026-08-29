import { OrdersService, normaliseIndianPhone, hashClaimToken } from './orders.service';

/**
 * Who a paid order belongs to, and whose details it may rewrite.
 *
 * A customer can pay for a delivery to someone else — ghee and honey are
 * gifting products, and the schema already carries isGift and giftSenderName.
 * When that happens the checkout carries the *recipient's* phone, address and
 * email, and none of it describes the buyer.
 *
 * So the rule is: what a customer has already told us outranks anything a
 * gateway returns. The order stays with whoever paid; their account is not
 * touched. This is currently a consequence of one `!ownerId` guard rather than
 * anything named, which is exactly the kind of thing a refactor "improves"
 * into an overwrite with no test to stop it.
 */

/** A paid Cashfree order whose contact details are a different person's. */
const SOMEONE_ELSE = {
  order_status: 'PAID',
  customer_details: {
    customer_phone: '+91 9000011111',
    customer_email: 'recipient@example.com',
    customer_name: 'Cashfree Customer',
  },
  shipping_address: {
    name: 'Recipient Name',
    phone: '+91 9000011111',
    email: 'recipient@example.com',
    address_line_one: '12 Somewhere Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pin_code: '560037',
    country: 'India',
  },
};

function buildService(order: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = [];
  const signInByVerifiedPhone = jest.fn();

  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      update: jest.fn((args: { data: Record<string, unknown> }) => {
        updates.push(args.data);
        return args.data;
      }),
    },
    payment: { update: jest.fn((a: unknown) => a) },
    cartItem: { deleteMany: jest.fn() },
    address: { create: jest.fn(), upsert: jest.fn() },
    user: { update: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.resolve(ops)),
  };

  const cashfreeService = {
    getOrder: jest.fn().mockResolvedValue(SOMEONE_ELSE),
    getOrderExtended: jest.fn().mockResolvedValue(SOMEONE_ELSE),
  };

  const service = new OrdersService(
    prisma as never,
    {} as never, // razorpay
    cashfreeService as never,
    {} as never, // flags
    {} as never, // cms
    {} as never, // audit
    { signInByVerifiedPhone } as never,
    {} as never, // number series — confirm never allocates
  );

  return { service, prisma, signInByVerifiedPhone, updates };
}

const OWNER = 'user-who-paid';

const GUEST_CLAIM = 'a-guest-browser-token';

const paidOrderOwnedBy = (userId: string | null) => ({
  id: 'order-1',
  orderNumber: 'CD-2026-00042',
  userId,
  paymentStatus: 'PENDING',
  // A guest has no session, so the claim token is the only thing that can let
  // them through. An owned order does not need one.
  claimTokenHash: userId ? null : hashClaimToken(GUEST_CLAIM),
  claimTokenExpiresAt: userId ? null : new Date(Date.now() + 3_600_000),
  payments: [{ id: 'pay-1', gatewayOrderId: 'CD-2026-00042-abcd1234' }],
});

describe('confirmCashfreeOrder — whose order and whose details', () => {
  it('never touches the account of a customer who was signed in', async () => {
    const { service, prisma, signInByVerifiedPhone } = buildService(paidOrderOwnedBy(OWNER));

    await service.confirmCashfreeOrder(OWNER, 'order-1');

    // The one that matters: enrichment must not even be reached. Reaching it
    // with a recipient's details is how a buyer's name and email get replaced
    // by the person they sent a gift to.
    expect(signInByVerifiedPhone).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('leaves the order with whoever paid, not whoever it ships to', async () => {
    const { service, updates } = buildService(paidOrderOwnedBy(OWNER));

    await service.confirmCashfreeOrder(OWNER, 'order-1');

    const orderUpdate = updates[0];
    /*
     * It may rewrite userId with the same owner — a harmless no-op. What must
     * never happen is it becoming the recipient's: the customer who actually
     * paid would lose the order from their history.
     */
    expect(orderUpdate.userId ?? OWNER).toBe(OWNER);
    expect(orderUpdate.paymentStatus).toBe('PAID');
  });

  it('writes the delivery address onto the order, never into the address book', async () => {
    const { service, prisma, updates } = buildService(paidOrderOwnedBy(OWNER));

    await service.confirmCashfreeOrder(OWNER, 'order-1');

    const shipping = updates[0].shippingAddress as Record<string, string>;
    expect(shipping.line1).toBe('12 Somewhere Road');
    expect(shipping.source).toBe('cashfree');

    // A one-off delivery address is not a place this customer lives.
    expect(prisma.address.create).not.toHaveBeenCalled();
    expect(prisma.address.upsert).not.toHaveBeenCalled();
  });

  it('refuses a guest who presents no claim token @security', async () => {
    const { service, signInByVerifiedPhone } = buildService(paidOrderOwnedBy(null));

    // An order id alone proves nothing — orderNumber is max + 1, so they are
    // guessable, and confirming one hands back a session.
    await expect(service.confirmCashfreeOrder(null, 'order-1')).rejects.toThrow(
      'Order not found',
    );
    expect(signInByVerifiedPhone).not.toHaveBeenCalled();
  });

  it('does create an account when nobody owns the order yet', async () => {
    const { service, signInByVerifiedPhone } = buildService(paidOrderOwnedBy(null));
    signInByVerifiedPhone.mockResolvedValue({
      accessToken: 't',
      user: { id: 'new-user' },
    });

    await service.confirmCashfreeOrder(null, 'order-1', GUEST_CLAIM);

    // The guest half of the same rule: with no owner there is nothing to
    // protect, and the verified phone is all we know about the buyer.
    expect(signInByVerifiedPhone).toHaveBeenCalledWith('+919000011111', {
      // From the address, never customer_details — that carries Cashfree's
      // own placeholders for anyone we have not named.
      email: 'recipient@example.com',
      name: 'Recipient Name',
    });
  });
});

describe('normaliseIndianPhone', () => {
  it('accepts what Cashfree actually returns', () => {
    // A real payment came back with a space and the country code.
    expect(normaliseIndianPhone('+91 8800573313')).toBe('+918800573313');
    expect(normaliseIndianPhone('8800573313')).toBe('+918800573313');
  });

  it('rejects the guest placeholder, so it can never become an account', () => {
    expect(normaliseIndianPhone('           ')).toBeNull();
    expect(normaliseIndianPhone('0000000000')).toBeNull();
    expect(normaliseIndianPhone(null)).toBeNull();
    expect(normaliseIndianPhone('12345')).toBeNull();
  });
});

describe('hashClaimToken', () => {
  it('is a stable sha256 digest, not the token itself', () => {
    const digest = hashClaimToken('some-token');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toBe('some-token');
    expect(hashClaimToken('some-token')).toBe(digest);
  });
});
