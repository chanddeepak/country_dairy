import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DeliveryType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductStatus,
  StockMovementReason,
} from '@prisma/client';
import { pageParams, paginate } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { RazorpayService } from './razorpay.service';
import { CashfreeService } from './cashfree.service';
import { FLAG, FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { CmsService } from '../cms/cms.service';
import {
  basketFingerprint,
  calculateOrderTotals,
  priceLine,
  reconcileTotals,
  round2,
  toPaise,
} from './pricing';
import {
  NumberSeriesService,
  businessFinancialYear,
  businessYear,
} from '../common/number-series.service';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** Long enough to pay, short enough that a leaked URL goes stale. */
const CLAIM_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * How long an interrupted checkout can be picked up again.
 *
 * Matched to the sweep, so the two never disagree: after this the order has
 * been cancelled and its Cashfree order terminated, and there is nothing to
 * resume. It also stops somebody paying a week-old price from a forgotten tab.
 */
const RESUME_WINDOW_MS = 60 * 60 * 1000;

/**
 * What we send Cashfree as a guest's phone, because they will not create an
 * order without one.
 *
 * Undocumented and slightly absurd: One Click Checkout exists to collect and
 * verify the customer's number, and the create-order call rejects
 * `customer_phone_missing` before it ever gets the chance.
 *
 * Whitespace, after probing what they accept and then rendering each one:
 *
 *   omitted / ''      400 customer_phone_missing
 *   '0' '00' '+91'    400 customer_phone_invalid
 *   '0000000000'      200, but their field then shows a literal "0"
 *   '           '     200, and their field renders EMPTY with a grey hint
 *                     and Continue disabled until the customer types
 *
 * So this is the only value that leaves their form looking untouched, which is
 * what it should look like to someone who has not told us their number yet.
 */
const GUEST_PHONE_PLACEHOLDER = '           ';

/**
 * Cashfree reports ten digits; User.phone is stored as +91XXXXXXXXXX.
 *
 * Returns null for anything that is not a real Indian mobile, which includes
 * the placeholder above. That guard matters: if their checkout ever handed the
 * placeholder straight back, creating an account on it would collect every
 * unclaimed guest order under one fictional customer.
 */
export function normaliseIndianPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9][0-9]{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

/** Constant-time compare of two hex digests of the same length. */
function digestsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/**
 * SHA-256 rather than bcrypt. The token is 32 random bytes, so there is no
 * low-entropy secret to slow an attacker down — and a plain digest can be
 * looked up by index, which a salted hash could not.
 */
export function hashClaimToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Transitions the order state machine permits. */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  /*
   * SHIPPED directly, as well as through PROCESSING.
   *
   * Handing a paid order to a courier is a complete action, and the
   * consignment desk records the waybill in one step because that is what
   * actually happens at the counter. Nothing reads PROCESSING — no queue, no
   * report — so insisting on it first was a click with no consumer, and the
   * desk got "Cannot move an order from CONFIRMED to SHIPPED" for doing the
   * obvious thing.
   *
   * PROCESSING stays for anyone who wants to mark a batch as being packed.
   */
  CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
  DELIVERED: [OrderStatus.RETURNED],
  CANCELLED: [],
  RETURNED: [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private razorpayService: RazorpayService,
    private cashfreeService: CashfreeService,
    private flags: FeatureFlagsService,
    private cms: CmsService,
    private audit: AuditService,
    private auth: AuthService,
    private numbers: NumberSeriesService,
  ) {}

  /**
   * Human-readable order reference. Customers quote this over WhatsApp, so it
   * has to be something a person can read out loud.
   */
  private async generateOrderNumber(): Promise<string> {
    const year = businessYear();
    /*
     * Allocated outside the checkout transaction on purpose. That transaction
     * decrements stock and writes the order; holding the series row lock across
     * it would put every customer in a queue behind the one in front.
     *
     * An abandoned checkout therefore leaves a gap in the numbering, which
     * costs nothing — unlike an invoice, an order number carries no obligation
     * to be consecutive.
     *
     * No zero padding any more. Its only real job was to make a *text* sort
     * agree with a numeric one so `max(orderNumber)` found the true maximum —
     * and that sort is exactly what broke past 99,999. Nothing sorts these now,
     * so CD-2026-21 is simply shorter to read out over WhatsApp.
     */
    const seq = await this.numbers.allocate(`order:${year}`);
    return `CD-${year}-${seq}`;
  }

  /**
   * Picks up an interrupted checkout instead of starting another one.
   *
   * A customer who closes the payment window and comes back used to get a
   * second order, a second number and a second hold on the same jar. Nothing
   * about their intent changed, so nothing should have.
   *
   * Reuse only when everything still lines up: the order is theirs, still
   * unpaid, still open at Cashfree, and its basket fingerprint still matches
   * what is in front of them. If the basket changed the fingerprint changed,
   * and Cashfree cannot amend an order — so that case genuinely needs a new
   * one, and falls through to the ordinary path.
   *
   * Returns null when the order cannot be resumed, which the caller reads as
   * "make a new one" rather than an error.
   */
  private async resumeCheckout(
    userId: string | null,
    orderId: string,
    claimToken: string | undefined,
    fingerprint: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) return null;

    const ownedByCaller = userId !== null && order.userId === userId;
    const presentedClaim =
      claimToken !== undefined &&
      order.claimTokenHash !== null &&
      order.claimTokenExpiresAt !== null &&
      order.claimTokenExpiresAt.getTime() > Date.now() &&
      digestsMatch(hashClaimToken(claimToken), order.claimTokenHash);
    if (!ownedByCaller && !presentedClaim) return null;

    // Settled, cancelled, or old enough that the sweep has been through it.
    if (order.status !== OrderStatus.PENDING) return null;
    if (order.paymentStatus === PaymentStatus.PAID) return null;
    if (Date.now() - order.createdAt.getTime() > RESUME_WINDOW_MS) return null;

    const payment = order.payments[0];
    if (!payment?.gatewayOrderId) return null;

    // A different basket means a different fingerprint, and their order cannot
    // be amended to match it.
    if (!payment.gatewayOrderId.includes(fingerprint)) return null;

    /*
     * Their order has to still be open. A failed attempt or a sweep may have
     * left it in a state that cannot take money, and asking is cheaper than
     * assuming — a fresh session against a dead order would send the customer
     * to a window that cannot work.
     */
    const remote = await this.cashfreeService.getOrder(payment.gatewayOrderId).catch(() => null);
    if (!remote || String(remote.order_status) !== 'ACTIVE' || !remote.payment_session_id) {
      return null;
    }

    this.logger.log(`Resuming ${order.orderNumber} rather than creating another order`);
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      provider: 'CASHFREE' as const,
      // Their GET hands back a new session every time, so an interrupted
      // checkout can be reopened without touching anything else.
      paymentSessionId: remote.payment_session_id,
      paymentGatewayId: payment.gatewayOrderId,
      amount: Number(order.totalAmount),
      currency: 'INR',
      resumed: true as const,
    };
  }

  async checkout(
    userId: string | null,
    addressId: string | undefined,
    deliveryType: DeliveryType,
    couponCode?: string,
    guestItems?: { variantId: string; quantity: number }[],
    resume?: { orderId: string; claimToken?: string },
  ) {
    /*
     * An address is optional now. Cashfree's checkout collects and verifies one
     * during payment and hands it back on confirm, so requiring it here would
     * make the customer type an address they are about to type again.
     *
     * A signed-in customer may still pass one — it prefills their form.
     */
    const address = addressId
      ? await this.prisma.address.findUnique({ where: { id: addressId } })
      : null;

    if (addressId && (!address || address.userId !== userId)) {
      throw new BadRequestException('Invalid delivery address');
    }

    /*
     * Where the cart lives depends on who is buying. A signed-in customer has
     * rows in CartItem; a guest has localStorage and sends the lines up.
     *
     * The guest sends variant ids and quantities and nothing else. Prices are
     * read from the variant below either way — a client that could name its own
     * price would be a checkout that charges whatever it is told to.
     */
    const cartItems = userId
      ? await this.prisma.cartItem.findMany({
          where: { userId },
          include: {
            variant: true,
            product: { select: { id: true, title: true, status: true, forceOutOfStock: true, gstRate: true, hsnCode: true } },
          },
        })
      : await this.loadGuestLines(guestItems ?? []);

    if (cartItems.length === 0) {
      throw new BadRequestException('Cannot checkout: shopping cart is empty');
    }

    // Price every line from its own variant. The previous implementation read
    // `product.variants[0]` from a query that never included variants, so the
    // `|| 100` fallback fired for every line and charged a flat ₹100.
    const lines = cartItems.map((item) => {
      if (item.product.status !== 'LIVE' || item.product.forceOutOfStock || !item.variant.isActive) {
        throw new BadRequestException(`${item.product.title} is no longer available`);
      }
      if (item.quantity > item.variant.stockQuantity) {
        throw new BadRequestException(
          `${item.product.title} (${item.variant.sizeLabel}) has only ${item.variant.stockQuantity} left`,
        );
      }

      const priced = priceLine(
        item.quantity,
        Number(item.variant.sellingPrice),
        Number(item.product.gstRate),
      );

      return { item, priced };
    });

    const coupon = couponCode && userId ? await this.resolveCoupon(couponCode, userId) : null;

    const totals = calculateOrderTotals(
      lines.map((l) => l.priced),
      coupon
        ? {
            discountType: coupon.discountType,
            discountValue: Number(coupon.discountValue),
            maxDiscountAmount: coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : null,
            minOrderAmount: Number(coupon.minOrderAmount),
          }
        : null,
    );

    /*
     * What is being charged, as a short fingerprint. It decides both whether an
     * interrupted checkout can be picked up and what the gateway order is
     * called, so the two can never disagree.
     */
    const fingerprint = basketFingerprint(
      lines.map(({ item, priced }) => ({
        variantId: item.variantId,
        quantity: priced.quantity,
        unitPrice: priced.unitPrice,
      })),
      totals.totalAmount,
    );

    if (resume?.orderId) {
      const resumed = await this.resumeCheckout(
        userId,
        resume.orderId,
        resume.claimToken,
        fingerprint,
      );
      if (resumed) return resumed;
    }

    /*
     * Minted here rather than after the order exists, because it has to travel
     * in the return_url Cashfree is given below. Only the hash is stored: this
     * token grants a session, so a leaked database must not be a pile of usable
     * logins. Short-lived — it only has to survive one payment.
     */
    const claimToken = randomBytes(32).toString('base64url');
    const claimTokenHash = hashClaimToken(claimToken);

    const orderNumber = await this.generateOrderNumber();

    // Stock is decremented with the order in one transaction, so two customers
    // racing for the last jar cannot both succeed.
    const order = await this.prisma.$transaction(async (tx) => {
      for (const { item } of lines) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });

        if (updated.count === 0) {
          throw new ConflictException(
            `${item.product.title} (${item.variant.sizeLabel}) sold out while you were checking out`,
          );
        }
      }



      const created = await tx.order.create({
        data: {
          orderNumber,
          userId,
          addressId,
          // Snapshot: editing a saved address must not rewrite past orders.
          // Empty until Cashfree returns one, which confirmCashfreeOrder writes
          // over the top of. `source` says which, so a half-filled address is
          // never mistaken for a real one on an admin screen.
          shippingAddress: address
            ? {
                line1: address.line1,
                line2: address.line2,
                city: address.city,
                state: address.state,
                postalCode: address.postalCode,
                country: address.country,
                phone: address.phone,
                source: 'account',
              }
            : { source: 'awaiting-checkout' },
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          deliveryCharges: totals.deliveryCharges,
          totalAmount: totals.totalAmount,
          couponId: coupon?.id,
          couponCode: coupon?.code,
          deliveryType,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          claimTokenHash,
          claimTokenExpiresAt: new Date(Date.now() + CLAIM_TOKEN_TTL_MS),
          orderItems: {
            create: lines.map(({ item, priced }) => ({
              productId: item.productId,
              variantId: item.variantId,
              // Immutable copies so renaming or archiving a product later
              // cannot alter this invoice.
              productTitle: item.product.title,
              variantSizeLabel: item.variant.sizeLabel,
              sku: item.variant.sku,
              imageUrl: item.variant.imageUrl,
              hsnCode: item.product.hsnCode,
              quantity: priced.quantity,
              unitPrice: priced.unitPrice,
              mrpPrice: Number(item.variant.mrpPrice),
              gstRate: priced.gstRate,
              taxAmount: priced.taxAmount,
              lineTotal: priced.lineTotal,
            })),
          },
          statusHistory: {
            create: { status: OrderStatus.PENDING, note: 'Order created' },
          },
        },
        include: { orderItems: true },
      });

      await tx.stockMovement.createMany({
        data: lines.map(({ item }) => ({
          variantId: item.variantId,
          change: -item.quantity,
          balanceAfter: item.variant.stockQuantity - item.quantity,
          reason: StockMovementReason.ORDER_PLACED,
          referenceId: created.id,
        })),
      });

      if (coupon) {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      return created;
    },
      {
        /*
         * Prisma's defaults are 2s to acquire and 5s to run, and this
         * transaction takes a row lock on the variant before doing three more
         * round trips to a database in Singapore — roughly 600ms each time it
         * runs. Eight customers buying the same jar at once therefore queue for
         * about five seconds, and the last one used to fail with a 500 while
         * the seven ahead of it succeeded.
         *
         * This is headroom, not a cure. The real cost is doing several round
         * trips while holding a lock on a row every buyer of that product
         * wants; fewer statements inside the transaction would shorten the
         * queue rather than tolerate it. Worth revisiting if a single product
         * ever sells fast enough to make this bite again.
         */
        maxWait: 10_000,
        timeout: 20_000,
      },
    );

    /*
     * Which gateway takes the money.
     *
     * The flag is the switch and the credentials are the veto: turning it on
     * without configuring Cashfree would create an order and then fail to make
     * it payable, leaving stock decremented against something nobody can pay
     * for. Falling back to Razorpay keeps that from being a dead end.
     */
    const useCashfree =
      (await this.flags.isEnabled(FLAG.CASHFREE_CHECKOUT)) && this.cashfreeService.isConfigured;

    /*
     * Razorpay's confirm path requires a session, so a guest sent down it would
     * get an order that is created, has stock held against it, and can never be
     * paid. Refuse before that happens rather than after.
     *
     * Two different reasons land here, and telling them apart matters. If
     * Razorpay is live, signing in genuinely does complete the order. If
     * neither gateway is configured, no amount of signing in will help — that
     * is a deployment missing its credentials, and saying "please sign in"
     * sends whoever is testing to hunt for a login bug that does not exist.
     */
    if (!useCashfree && !userId) {
      if (this.razorpayService.isMockMode) {
        this.logger.error(
          'Guest checkout refused: Cashfree is not configured and Razorpay is in mock mode, ' +
            'so this environment has no gateway that can take a payment. ' +
            'Set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET.',
        );
        throw new ServiceUnavailableException(
          'Online payment is not available right now. Please try again shortly.',
        );
      }
      throw new BadRequestException('Please sign in to complete your order');
    }

    if (useCashfree) {
      /*
       * A guest has no account yet — Cashfree collects and verifies the phone
       * during payment, and confirmCashfreeOrder creates the account from what
       * it returns. So this is what we know so far, which may be nothing.
       */
      const user = userId
        ? await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { id: true, name: true, email: true, phone: true },
          })
        : null;

      const cashfreeOrder = await this.cashfreeService.createOrder({
        /*
         * Order number plus the head of our uuid, not the order number alone.
         *
         * generateOrderNumber takes max(orderNumber) + 1 across surviving
         * rows, so deleting an order frees its number for the next one to
         * reuse. Cashfree's ids are permanent and unique per merchant, so the
         * reused number comes back 409 order_already_exists and the customer
         * cannot pay — for a reason nothing on our side would explain.
         *
         * The number still leads so it is recognisable in their dashboard
         * beside a support conversation; the suffix is what makes it safe.
         */
        /*
         * The order number, then the basket fingerprint.
         *
         * The uuid fragment this used to carry existed only because order
         * numbers were reissued after a deletion; NumberSeries never reuses one
         * now, so the number alone is unique and the id is shorter to read in
         * their dashboard. The fingerprint is what makes it change when — and
         * only when — the basket does.
         */
        orderId: `${order.orderNumber}-${fingerprint}`,
        amount: Number(totals.totalAmount),
        // Their API wants a customer id even for someone we have never seen.
        // The order id is stable, unique, and says nothing about a person.
        customerId: user?.id ?? `guest-${order.id}`,
        // Their API requires ten digits. Prefilling it is the whole reason a
        // signed-in customer is not asked to type their number again.
        customerPhone:
          (user?.phone || address?.phone || '').replace(/\D/g, '').slice(-10) ||
          GUEST_PHONE_PLACEHOLDER,
        customerEmail: user?.email ?? undefined,
        customerName: user?.name ?? undefined,
        // The claim token rides back with the customer. Without it the confirm
        // route would have nothing but an order id to trust, and order numbers
        // are sequential.
        returnUrl: `${this.storefrontUrl()}/checkout/cashfree-return?order_id={order_id}&claim=${claimToken}`,
        notifyUrl: `${this.apiUrl()}/orders/webhook/cashfree`,
        cartItems: lines.map(({ item, priced }) => ({
          item_id: item.variant.sku || item.variantId,
          item_name: `${item.product.title} — ${item.variant.sizeLabel}`,
          // What the customer sees on their summary has to be what we charge.
          // MRP above selling renders as a struck-through price and a discount
          // line; inventing a gap here would show a discount we never gave.
          item_original_unit_price: Number(item.variant.mrpPrice),
          item_discounted_unit_price: priced.unitPrice,
          item_quantity: priced.quantity,
          item_currency: 'INR',
        })),
        // Their checkout collects an address either way. This says we take
        // the one the customer actually chose there over the one they picked
        // at our step — shipping anywhere else would be shipping somewhere
        // they did not ask for.
        preferTheirAddress: true,
      });

      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          amount: totals.totalAmount,
          currency: 'INR',
          provider: 'CASHFREE',
          status: PaymentStatus.PENDING,
          gatewayOrderId: cashfreeOrder.order_id,
        },
      });

      this.logger.log(`Created order ${order.orderNumber} for ₹${totals.totalAmount} (Cashfree)`);

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        provider: 'CASHFREE' as const,
        // What the browser SDK needs. Short-lived, and useless without it.
        paymentSessionId: cashfreeOrder.payment_session_id,
        /*
         * The browser has to carry this to confirm.
         *
         * It also rides in Cashfree's return_url, but the modal never navigates
         * there — the SDK resolves in place and our own code routes onward — so
         * the redirect copy only covers the `_self` case. Returned to the
         * browser that just created the order, which is precisely the browser
         * the token is meant to identify.
         */
        claimToken,
        paymentGatewayId: cashfreeOrder.order_id,
        amount: totals.totalAmount,
        currency: 'INR',
        breakdown: totals,
      };
    }

    const gatewayOrder = await this.razorpayService.createOrder(
      toPaise(totals.totalAmount),
      order.id,
    );

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: totals.totalAmount,
        currency: 'INR',
        provider: 'RAZORPAY',
        status: PaymentStatus.PENDING,
        gatewayOrderId: gatewayOrder.id,
      },
    });

    this.logger.log(`Created order ${order.orderNumber} for ₹${totals.totalAmount}`);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      provider: 'RAZORPAY' as const,
      paymentGatewayId: gatewayOrder.id,
      amount: totals.totalAmount,
      currency: 'INR',
      breakdown: totals,
    };
  }

  /** Where the customer comes back to. */
  private storefrontUrl(): string {
    return (process.env.STOREFRONT_URL || 'http://localhost:3000').replace(/\/$/, '');
  }

  /** Where Cashfree posts the webhook. */
  private apiUrl(): string {
    return (process.env.PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
  }

  /**
   * Turns `{ variantId, quantity }` from a guest's browser into the same shape
   * the CartItem query returns, so everything downstream is identical.
   *
   * Nothing here trusts the client beyond which variant and how many. Prices,
   * titles and tax rates are all read from our own rows.
   */
  private async loadGuestLines(items: { variantId: string; quantity: number }[]) {
    if (items.length === 0) return [];

    // Collapse duplicates rather than letting the same variant appear twice,
    // which would decrement stock twice and print two lines on the invoice.
    const wanted = new Map<string, number>();
    for (const { variantId, quantity } of items) {
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new BadRequestException('Invalid quantity');
      }
      wanted.set(variantId, (wanted.get(variantId) ?? 0) + quantity);
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: [...wanted.keys()] } },
      include: {
        product: {
          select: { id: true, title: true, status: true, forceOutOfStock: true, gstRate: true, hsnCode: true },
        },
      },
    });

    if (variants.length !== wanted.size) {
      throw new BadRequestException('Your basket contains an item we no longer sell');
    }

    return variants.map((variant) => ({
      productId: variant.product.id,
      variantId: variant.id,
      quantity: wanted.get(variant.id) as number,
      variant,
      product: variant.product,
    }));
  }

  private async resolveCoupon(code: string, userId: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    const now = new Date();
    if (
      !coupon ||
      !coupon.isActive ||
      (coupon.startsAt && coupon.startsAt > now) ||
      (coupon.expiresAt && coupon.expiresAt < now)
    ) {
      throw new BadRequestException('This coupon code is not valid');
    }

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

    if (coupon.perUserLimit !== null) {
      const usedByUser = await this.prisma.order.count({
        where: { userId, couponId: coupon.id, status: { not: OrderStatus.CANCELLED } },
      });
      if (usedByUser >= coupon.perUserLimit) {
        throw new BadRequestException('You have already used this coupon');
      }
    }

    return coupon;
  }

  async verifyPayment(
    userId: string,
    orderId: string,
    razorpayPaymentId: string,
    signature: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    // Idempotent: a retried callback returns the already-confirmed order
    // instead of recording a second payment.
    if (order.paymentStatus === PaymentStatus.PAID) {
      return order;
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Order is already ${order.status.toLowerCase()}`);
    }

    // Checkout always writes this row alongside the gateway order. Its absence
    // means the order was created some other way, and there is nothing to
    // verify a signature against.
    const pendingPayment = order.payments[0];
    if (!pendingPayment) {
      throw new BadRequestException('This order has no payment to verify');
    }

    const gatewayOrderId = pendingPayment.gatewayOrderId ?? '';
    const isValid = this.razorpayService.verifySignature(
      gatewayOrderId,
      razorpayPaymentId,
      signature,
    );

    if (!isValid) {
      this.logger.warn(`Invalid payment signature for order ${order.orderNumber}`);
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: PaymentStatus.FAILED },
        }),
        this.prisma.payment.update({
          where: { id: pendingPayment.id },
          data: {
            status: PaymentStatus.FAILED,
            gatewayPaymentId: razorpayPaymentId,
            gatewaySignature: signature,
            failureReason: 'Signature verification failed',
          },
        }),
      ]);
      throw new BadRequestException('Payment verification failed');
    }

    const [confirmed] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          confirmedAt: new Date(),
          statusHistory: {
            create: { status: OrderStatus.CONFIRMED, note: 'Payment verified' },
          },
        },
      }),
      // Settle the PENDING row checkout created for this gateway order rather
      // than adding a parallel one — a `create` here left the original PENDING
      // for ever and made payment reconciliation double-count.
      this.prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: PaymentStatus.PAID,
          gatewayPaymentId: razorpayPaymentId,
          gatewaySignature: signature,
        },
      }),
      this.prisma.cartItem.deleteMany({ where: { userId } }),
    ]);

    this.logger.log(`Order ${order.orderNumber} confirmed`);
    return confirmed;
  }

  /**
   * Settles an order by asking Cashfree, rather than by trusting the browser.
   *
   * The webhook is the authoritative path and it is idempotent, but it cannot
   * reach a laptop, so in local development it never fires at all. This is also
   * what closes the gap in production when a customer returns before the
   * webhook lands.
   *
   * Nothing in the request says whether the order was paid — only the order id
   * does, and the answer comes from Cashfree. A browser claiming "paid" is not
   * evidence, which is the whole reason `verifyPayment` checks a signature.
   */
  /**
   * Settles a Cashfree order, and for a guest, creates the account it belongs to.
   *
   * @param userId     The signed-in customer, or null for a guest.
   * @param claimToken Proof this browser placed the order. The only thing a
   *                   guest can present, since there is no session yet.
   */
  async confirmCashfreeOrder(
    userId: string | null,
    orderId: string,
    claimToken?: string,
    options?: { internal?: boolean },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    /*
     * Two ways to be allowed in, and an order id is not one of them.
     *
     * orderNumber is max + 1, so ids are guessable; if this route accepted one
     * on its own, guessing would hand back a session as that customer. The
     * token is compared in constant time against the stored digest.
     */
    const ownedByCaller = userId !== null && order.userId === userId;
    const presentedClaim =
      claimToken !== undefined &&
      order.claimTokenHash !== null &&
      order.claimTokenExpiresAt !== null &&
      order.claimTokenExpiresAt.getTime() > Date.now() &&
      digestsMatch(hashClaimToken(claimToken), order.claimTokenHash);

    /*
     * `internal` is for the abandoned-order sweep, which has already asked
     * Cashfree and been told the order is PAID. It has no claim token — nobody
     * is holding a browser — and refusing it would mean throwing away a
     * customer's completed payment.
     *
     * The controller passes three arguments and cannot set this. It must stay
     * that way: it is the one path that settles an order without proving who
     * is asking.
     */
    if (!options?.internal && !ownedByCaller && !presentedClaim) {
      // 404 rather than 403: telling a caller the order exists but is not
      // theirs confirms the id was a good guess.
      throw new NotFoundException('Order not found');
    }

    // Idempotent, like verifyPayment: whichever of the webhook and the return
    // trip arrives second finds the work already done.
    if (order.paymentStatus === PaymentStatus.PAID) {
      return { order, session: null };
    }

    const pending = order.payments[0];
    if (!pending?.gatewayOrderId) {
      throw new BadRequestException('This order has no Cashfree payment to confirm');
    }

    const remote = await this.cashfreeService.getOrder(pending.gatewayOrderId);
    const status = String(remote.order_status ?? '');

    if (status !== 'PAID') {
      // ACTIVE means they have not paid yet — not a failure, just not done.
      // Recording it as FAILED would strand an order the customer is still
      // paying for.
      this.logger.log(`Order ${order.orderNumber} is ${status} at Cashfree, not settling`);
      return { order, session: null };
    }

    /*
     * Where it actually ships.
     *
     * Their checkout always collects an address, so the customer may well have
     * chosen a different one there. Keeping ours would send the parcel
     * somewhere they did not pick — and they would have no way of knowing
     * until it arrived.
     */
    const extended = await this.cashfreeService
      .getOrderExtended(pending.gatewayOrderId)
      .catch(() => null);
    const theirs = extended?.shipping_address;

    const shippingAddress = theirs?.address_line_one
      ? {
          line1: theirs.address_line_one,
          line2: theirs.address_line_two ?? null,
          city: theirs.city ?? '',
          state: theirs.state ?? '',
          postalCode: theirs.pin_code ?? '',
          country: theirs.country ?? 'India',
          phone: theirs.phone ?? '',
          name: theirs.name ?? null,
          source: 'cashfree',
        }
      : null;

    /*
     * Who this order belongs to.
     *
     * Cashfree ran its own OTP before taking the money, so the number on the
     * order is verified — just not by us. That is enough to attach the order
     * and hand back a session, which is what saves the buyer from filling in a
     * registration form for an account they did not ask for.
     *
     * normaliseIndianPhone returns null for the guest placeholder we sent, so a
     * checkout that somehow echoed it back cannot collect every unclaimed order
     * under one fictional customer.
     */
    const verifiedPhone = normaliseIndianPhone(
      extended?.customer_details?.customer_phone ?? theirs?.phone,
    );

    let session: Awaited<ReturnType<AuthService['signInByVerifiedPhone']>> | null = null;
    let ownerId = order.userId;

    if (!ownerId && verifiedPhone) {
      /*
       * Name and email come from the address, never from customer_details.
       *
       * customer_details is Cashfree's own record and is filled with defaults
       * for a guest — a real payment came back with customer_name "Cashfree
       * Customer" and customer_email "test123@gmail.com", while the shipping
       * address carried the customer's actual name and address. Reading the
       * obvious field would have written that placeholder into a real account.
       */
      const contact = theirs ?? extended?.billing_address;

      // find-or-create. A number that already has an account lands on it rather
      // than growing a second one — the same rule the OTP sign-in follows.
      const signedIn = await this.auth.signInByVerifiedPhone(verifiedPhone, {
        email: contact?.email,
        name: contact?.name,
      });
      ownerId = signedIn.user.id;
      session = signedIn;
    }

    if (!ownerId && !verifiedPhone) {
      // Paid, but nothing identifies the buyer. Settle it anyway — the money
      // moved — and leave it unclaimed for reconciliation rather than losing it.
      this.logger.error(
        `Order ${order.orderNumber} is PAID but Cashfree returned no usable phone; leaving it unowned`,
      );
    }

    /*
     * What they charged, not what we quoted.
     *
     * An offer from their dashboard can move the amount after the order was
     * created, and their own shipping or COD handling can add to it. Money
     * moved on their figure, so the invoice has to show their figure — ours
     * was a quote until this moment.
     *
     * Skipped when the two already agree, which is the ordinary case.
     */
    /*
     * What the customer was actually charged, which is on the *payment* and
     * not on the order.
     *
     * `order_amount` is the figure we asked for and does not move when one of
     * their offers applies. Proved with a real discounted payment: the order
     * read ₹1450 while the payment read ₹1250. Reading the order here would
     * have put the undiscounted amount on the invoice and never looked wrong.
     */
    type CashfreePayment = Awaited<ReturnType<CashfreeService['getOrderPayments']>>[number];
    const payments: CashfreePayment[] = await this.cashfreeService
      .getOrderPayments(pending.gatewayOrderId)
      .catch(() => [] as CashfreePayment[]);
    const captured = payments.find((p) => String(p.payment_status) === 'SUCCESS');
    const charged = Number(captured?.payment_amount ?? extended?.order_amount ?? 0);
    const gatewayFees = round2(
      Number(extended?.charges?.shipping_charges ?? 0) +
        Number(extended?.charges?.cod_handling_charges ?? 0),
    );
    const ourTotal = Number(order.totalAmount);

    let reconciled: ReturnType<typeof reconcileTotals> | null = null;
    if (charged > 0 && (Math.abs(charged - ourTotal) > 0.009 || gatewayFees > 0)) {
      const lines = await this.prisma.orderItem.findMany({
        where: { orderId },
        select: { lineTotal: true, gstRate: true },
      });
      reconciled = reconcileTotals(
        lines.map((l) => ({ lineTotal: Number(l.lineTotal), gstRate: Number(l.gstRate) })),
        charged,
        gatewayFees,
      );
      this.logger.warn(
        `Order ${order.orderNumber}: Cashfree charged ₹${charged} against our ₹${ourTotal}` +
          `${gatewayFees ? ` (incl. ₹${gatewayFees} of their charges)` : ''} — totals rewritten`,
      );
    }

    const [confirmed] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          confirmedAt: new Date(),
          ...(reconciled
            ? {
                subtotal: reconciled.subtotal,
                discountAmount: reconciled.discountAmount,
                taxAmount: reconciled.taxAmount,
                deliveryCharges: reconciled.deliveryCharges,
                totalAmount: reconciled.totalAmount,
              }
            : {}),
          ...(shippingAddress ? { shippingAddress } : {}),
          ...(ownerId ? { userId: ownerId } : {}),
          // Single use. The order is settled and owned; presenting it again
          // must not hand a session to whoever else has seen the URL.
          claimTokenHash: null,
          claimTokenExpiresAt: null,
          statusHistory: {
            create: { status: OrderStatus.CONFIRMED, note: 'Payment confirmed with Cashfree' },
          },
        },
      }),
      this.prisma.payment.update({
        where: { id: pending.id },
        data: {
          status: PaymentStatus.PAID,
          // Everything they told us about the payment, kept verbatim. The
          // column has existed since the model was written and nothing has
          // ever filled it, so a dispute had nothing to read.
          // The payment alongside the order: the offer that moved the amount
          // is only visible on the payment side.
          rawPayload: { order: extended ?? remote, payment: captured ?? null } as never,
          failureReason: captured?.payment_message ?? null,
          // Keep the Payment row and the order agreeing when an offer moved
          // the amount; a dispute is read from this row.
          ...(reconciled ? { amount: reconciled.totalAmount } : {}),
        },
      }),
      // A guest's cart lives in their browser; only a signed-in customer has
      // rows here to clear.
      ...(userId ? [this.prisma.cartItem.deleteMany({ where: { userId } })] : []),
    ]);

    this.logger.log(`Order ${order.orderNumber} confirmed via Cashfree`);
    return { order: confirmed, session };
  }

  /**
   * Puts a past order back in the cart.
   *
   * Nothing is assumed to still be true: a variant may be delisted, sold out,
   * or repriced since. Each line is reported back so the customer is told what
   * changed rather than discovering it at checkout, which is where a silent
   * substitution would surface.
   */
  async reorder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.orderItems.length === 0) {
      throw new BadRequestException('That order has nothing to reorder');
    }

    const variantIds = order.orderItems
      .map((i) => i.variantId)
      .filter((id): id is string => !!id);

    const [variants, existingCart] = await Promise.all([
      this.prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: { select: { id: true, title: true, status: true, forceOutOfStock: true } } },
      }),
      this.prisma.cartItem.findMany({ where: { userId } }),
    ]);

    const byId = new Map(variants.map((v) => [v.id, v]));
    const inCart = new Map(existingCart.map((c) => [c.variantId, c]));

    const added: { title: string; quantity: number }[] = [];
    const adjusted: { title: string; wanted: number; added: number; reason: string }[] = [];
    const unavailable: { title: string; reason: string }[] = [];
    const repriced: { title: string; was: number; now: number }[] = [];

    for (const item of order.orderItems) {
      const label = `${item.productTitle}${item.variantSizeLabel ? ` (${item.variantSizeLabel})` : ''}`;
      const variant = item.variantId ? byId.get(item.variantId) : undefined;

      // Permanent and temporary are told apart on purpose. "Not available right
      // now" invites the customer to come back for it, so an archived product
      // must not be described that way — it is never coming back.
      if (!variant || !variant.isActive || variant.product.status === ProductStatus.ARCHIVED) {
        unavailable.push({ title: label, reason: 'no longer sold' });
        continue;
      }

      if (variant.product.status !== ProductStatus.LIVE || variant.product.forceOutOfStock) {
        unavailable.push({ title: label, reason: 'not available right now' });
        continue;
      }

      // What is already in the cart counts against the same stock.
      const alreadyThere = inCart.get(variant.id)?.quantity ?? 0;
      const room = Math.max(0, variant.stockQuantity - alreadyThere);

      if (room === 0) {
        unavailable.push({ title: label, reason: 'sold out' });
        continue;
      }

      const quantity = Math.min(item.quantity, room);

      if (quantity < item.quantity) {
        adjusted.push({
          title: label,
          wanted: item.quantity,
          added: quantity,
          reason: `only ${room} left`,
        });
      } else {
        added.push({ title: label, quantity });
      }

      // Told, not hidden: the price on the old order is not the price today.
      const oldPrice = Number(item.unitPrice);
      const newPrice = Number(variant.sellingPrice);
      if (Math.abs(oldPrice - newPrice) > 0.01) {
        repriced.push({ title: label, was: oldPrice, now: newPrice });
      }

      await this.prisma.cartItem.upsert({
        where: { userId_variantId: { userId, variantId: variant.id } },
        create: {
          userId,
          variantId: variant.id,
          productId: variant.productId,
          quantity,
        },
        update: { quantity: alreadyThere + quantity },
      });
    }

    this.logger.log(
      `Reorder of ${order.orderNumber}: ${added.length} added, ` +
        `${adjusted.length} reduced, ${unavailable.length} unavailable`,
    );

    return {
      orderNumber: order.orderNumber,
      added,
      adjusted,
      unavailable,
      repriced,
      addedCount: added.length + adjusted.length,
    };
  }

  /**
   * Indian financial year label for an invoice series: 2026-27 runs from
   * 1 April 2026 to 31 March 2027.
   */
  private financialYear(date: Date): string {
    const year = date.getFullYear();
    const startYear = date.getMonth() >= 3 ? year : year - 1;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
  }

  /**
   * Assigns the next invoice number, once, when the supply happens.
   *
   * GST requires a series that is consecutive and gap-free for the financial
   * year, which is why this is not the order number: an order cancelled before
   * dispatch would leave a hole.
   *
   * It used to say a transaction serialised this. It did not — Postgres runs at
   * READ COMMITTED, so two dispatches could read the same maximum, and only the
   * unique index stopped a duplicate. The lock is real now: the number comes
   * from NumberSeries, taken inside this transaction so it rolls back with it.
   *
   * Padding is kept here, unlike order numbers, because an invoice series is
   * read by an auditor rather than a customer and fixed width is conventional.
   */
  async assignInvoiceNumber(orderId: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, invoiceNumber: true },
      });

      if (!order) throw new NotFoundException('Order not found');
      if (order.invoiceNumber) return order.invoiceNumber;

      const seller = await this.cms.getSellerIdentity();
      const now = new Date();
      const fy = businessFinancialYear(now);
      const series = `${seller.invoicePrefix}/${fy}`;

      /*
       * Allocated inside this transaction, unlike an order number, so a
       * dispatch that fails after taking a number gives it back. GST wants the
       * series consecutive for the financial year, and a hole is not a
       * cosmetic problem.
       *
       * That holds the series row lock until this commits, so two dispatches
       * happening at once queue. Accepted: gap-free is the requirement, and
       * dispatch is staff-initiated and low-volume.
       */
      const seq = await this.numbers.allocateWithin(tx, `invoice:${series}`);
      const invoiceNumber = `${series}/${String(seq).padStart(5, '0')}`;

      await tx.order.update({
        where: { id: orderId },
        data: { invoiceNumber, invoicedAt: now },
      });

      return invoiceNumber;
    });
  }

  /**
   * Everything a GST tax invoice must show.
   *
   * The CGST/SGST versus IGST split is decided by place of supply: same state
   * as the seller splits the tax in two, a different state charges it whole as
   * IGST. Derived here rather than stored, because it is a function of two
   * addresses we already have.
   */
  async getInvoice(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { orderItems: true, user: { select: { name: true, email: true, phone: true } } },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException(
        'An invoice is raised once the order is paid for. This one is not yet.',
      );
    }

    const seller = await this.cms.getSellerIdentity();
    const invoiceNumber = order.invoiceNumber ?? (await this.assignInvoiceNumber(order.id));

    const shipping = (order.shippingAddress ?? {}) as Record<string, string>;
    const buyerState = (shipping.state ?? '').trim();
    const isIntraState =
      !!buyerState && buyerState.toLowerCase() === seller.state.toLowerCase();

    const lines = order.orderItems.map((item) => {
      const lineTotal = Number(item.lineTotal);
      const tax = Number(item.taxAmount);
      // Prices are tax-inclusive, so the taxable value is the line less its tax.
      const taxable = round2(lineTotal - tax);

      return {
        description: item.productTitle,
        variant: item.variantSizeLabel,
        hsnCode: item.hsnCode ?? '',
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        taxableValue: taxable,
        gstRate: Number(item.gstRate),
        cgst: isIntraState ? round2(tax / 2) : 0,
        sgst: isIntraState ? round2(tax / 2) : 0,
        igst: isIntraState ? 0 : round2(tax),
        total: lineTotal,
      };
    });

    const totalTax = round2(lines.reduce((sum, l) => sum + l.cgst + l.sgst + l.igst, 0));

    return {
      invoiceNumber,
      invoiceDate: (order.invoicedAt ?? new Date()).toISOString(),
      orderNumber: order.orderNumber,
      orderDate: order.createdAt.toISOString(),
      seller,
      buyer: {
        name: order.user?.name ?? 'Customer',
        phone: shipping.phone ?? order.user?.phone ?? '',
        addressLine1: shipping.line1 ?? '',
        addressLine2: shipping.line2 ?? '',
        city: shipping.city ?? '',
        state: buyerState,
        postalCode: shipping.postalCode ?? '',
      },
      placeOfSupply: buyerState || seller.state,
      taxKind: isIntraState ? ('CGST_SGST' as const) : ('IGST' as const),
      lines,
      totals: {
        taxableValue: round2(lines.reduce((sum, l) => sum + l.taxableValue, 0)),
        cgst: round2(lines.reduce((sum, l) => sum + l.cgst, 0)),
        sgst: round2(lines.reduce((sum, l) => sum + l.sgst, 0)),
        igst: round2(lines.reduce((sum, l) => sum + l.igst, 0)),
        totalTax,
        deliveryCharges: Number(order.deliveryCharges),
        discount: Number(order.discountAmount),
        grandTotal: Number(order.totalAmount),
      },
      // A GSTIN-less invoice is a bill of supply, not a tax invoice. Say which.
      isTaxInvoice: !!seller.gstin,
    };
  }

  /**
   * A customer's orders — meaning the ones they actually placed.
   *
   * An abandoned checkout leaves a PENDING row behind, because the order has to
   * exist before the payment does: stock is held in the same transaction that
   * creates it, Cashfree needs an id to bill against, and the webhook needs
   * something to settle when the browser dies mid-payment. That is deliberate
   * and cannot move.
   *
   * What it must not do is look like an order to the person who did not buy
   * anything. Closing the payment window and then finding a mystery order in
   * your account is alarming in a way that no explanation on the row fixes.
   *
   * FAILED is shown, PENDING is not. A failed payment is something the customer
   * did and may want to retry; an abandoned one is something they chose not to
   * do. Three things cover the case where money moved and the confirmation did
   * not arrive: the checkout polls, the webhook is retried server to server,
   * and the sweep settles anything both of those missed.
   */
  async getUserOrders(userId: string) {
    return this.prisma.order.findMany({
      where: {
        userId,
        NOT: { status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PENDING },
      },
      include: {
        orderItems: { include: { product: { select: { slug: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        orderItems: {
          // The line already snapshots the title and price, but not the slug,
          // so without this the customer cannot get back to what they bought.
          // Null when the product has since been deleted, which the UI treats
          // as "no longer linkable" rather than a broken href.
          include: { product: { select: { slug: true } } },
        },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async cancelOrder(userId: string, orderId: string, reason?: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!ALLOWED_TRANSITIONS[order.status].includes(OrderStatus.CANCELLED)) {
      throw new ForbiddenException(`An order that is ${order.status.toLowerCase()} cannot be cancelled`);
    }

    return this.restockAndCancel(order.id, order.orderItems, reason ?? 'Cancelled by customer');
  }

  /** Returns reserved stock to inventory and marks the order cancelled. */
  /**
   * Cancels an order the customer explicitly abandoned at the payment window.
   *
   * Cashfree's SDK resolves with `error.code === 'payment_aborted'` when
   * somebody answers "Yes, Leave" to their own "Leaving Checkout?" prompt.
   * That is a statement of intent rather than a silence, so the order can be
   * closed at once instead of sitting PENDING for an hour holding stock while
   * the sweep waits to see whether they come back.
   *
   * Deliberately conservative about what it will touch:
   *
   * - the caller must prove the order is theirs, by session or claim token,
   *   exactly as confirm does — order numbers are sequential and cancelling a
   *   stranger's order on a guessed id would be a gift to anyone bored;
   * - a paid order is never cancelled, whatever the browser claims. The SDK
   *   can report an abort while the money moved anyway, and the gateway is
   *   asked rather than believed.
   */
  async abandonOrder(userId: string | null, orderId: string, claimToken?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!order) throw new NotFoundException('Order not found');

    const ownedByCaller = userId !== null && order.userId === userId;
    const presentedClaim =
      claimToken !== undefined &&
      order.claimTokenHash !== null &&
      order.claimTokenExpiresAt !== null &&
      order.claimTokenExpiresAt.getTime() > Date.now() &&
      digestsMatch(hashClaimToken(claimToken), order.claimTokenHash);

    if (!ownedByCaller && !presentedClaim) {
      throw new NotFoundException('Order not found');
    }

    // Already settled, or already closed. Nothing to do either way.
    if (order.status !== OrderStatus.PENDING || order.paymentStatus === PaymentStatus.PAID) {
      return { cancelled: false, reason: 'already settled' };
    }

    /*
     * Ask the gateway before believing the browser. A customer can abort the
     * window after their bank has already taken the money, and cancelling then
     * would destroy a real payment and hand the stock back.
     */
    const payment = order.payments[0];
    if (payment?.provider === 'CASHFREE' && payment.gatewayOrderId) {
      const remote = await this.cashfreeService.getOrder(payment.gatewayOrderId).catch(() => null);
      if (remote && String(remote.order_status) === 'PAID') {
        this.logger.warn(
          `Order ${order.orderNumber} reported as abandoned but is PAID at Cashfree; settling instead`,
        );
        await this.confirmCashfreeOrder(null, order.id, undefined, { internal: true });
        return { cancelled: false, reason: 'paid after all' };
      }
    }

    /*
     * Left alone deliberately, where this used to cancel.
     *
     * Cashfree keeps an abandoned order payable for thirty days, and closing
     * ours would burn the gateway order id — a terminated id answers 409 for
     * ever, and an identical basket produces an identical fingerprint, so the
     * customer could neither resume nor replace it. Cancelling here would trade
     * a tidy list for a checkout that cannot be finished.
     *
     * So it stays PENDING and resumable for the hour, and the sweep closes it
     * properly if they do not come back.
     */
    this.logger.log(
      `Order ${order.orderNumber}: customer left the payment window, keeping it resumable`,
    );
    return { cancelled: false, reason: 'kept for resume' };
  }

  /**
   * Frees stock held by checkouts that were started and never paid for.
   *
   * Every checkout decrements stock inside the transaction that creates the
   * order, so two customers cannot both take the last jar. Nothing ever put it
   * back when the customer simply walked away — a real run of nine test
   * scenarios left twenty orders holding stock indefinitely, and on a live shop
   * that is inventory quietly reserved against orders nobody will ever pay.
   *
   * **It asks the gateway before releasing anything.** A PENDING order is not
   * proof of abandonment: the customer may have paid while the browser closed
   * or the webhook went astray, and cancelling that would destroy a paid order
   * and its stock allocation together. So each candidate is checked, and one
   * that turns out to be paid is settled rather than cancelled — which makes
   * this the reconciliation pass as well as the sweep.
   *
   * @param olderThanMinutes how long to leave a checkout alone before assuming
   *   it is over. Generous by default: a customer switching to a banking app to
   *   approve a payment can be gone a long while, and cancelling underneath
   *   them is far worse than holding a jar for an extra hour.
   */
  async expireAbandonedOrders(olderThanMinutes = 60): Promise<{
    examined: number;
    released: number;
    settled: number;
    failed: number;
  }> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

    const stale = await this.prisma.order.findMany({
      where: {
        /*
         * FAILED belongs here as much as PENDING, and it is the easier one to
         * miss. A declined payment sets paymentStatus FAILED and leaves the
         * order PENDING so the customer can try again — but nothing ever
         * released its stock, so a sweep that only looked at PENDING payments
         * would hold those jars for ever.
         *
         * status stays PENDING in the filter regardless: an order already
         * CONFIRMED has been paid for, and one already CANCELLED has had its
         * stock returned.
         */
        paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
        status: OrderStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        orderItems: { select: { variantId: true, quantity: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      // Bounded so one sweep cannot run for ever on a long backlog; the next
      // run picks up where this one stopped.
      take: 200,
    });

    const result = { examined: stale.length, released: 0, settled: 0, failed: 0 };

    for (const order of stale) {
      const payment = order.payments[0];
      try {
        /*
         * Only Cashfree orders can be asked. A Razorpay order without a gateway
         * id has nothing to check against, so releasing its stock is the only
         * safe reading — it was never payable.
         */
        if (payment?.provider === 'CASHFREE' && payment.gatewayOrderId) {
          /*
           * Close it at Cashfree *before* reading it, not after.
           *
           * Asking first and cancelling second leaves a gap: the customer can
           * pay in the moment between, and we then cancel a paid order and
           * hand its stock back — money taken, nothing shipped, and nobody
           * looking. Terminating first makes that impossible, because no
           * payment can arrive once it has succeeded. Only then is it safe to
           * ask what happened.
           */
          await this.cashfreeService.terminateOrder(payment.gatewayOrderId);

          const remote = await this.cashfreeService
            .getOrder(payment.gatewayOrderId)
            .catch(() => null);

          if (remote && String(remote.order_status) === 'PAID') {
            // Paid just before we closed it. Settle rather than cancel — this
            // is the customer whose payment we would otherwise throw away.
            await this.confirmCashfreeOrder(null, order.id, undefined, { internal: true });
            this.logger.warn(
              `Order ${order.orderNumber} was paid but never confirmed; settled by the sweep`,
            );
            result.settled += 1;
            continue;
          }
        }

        await this.restockAndCancel(
          order.id,
          order.orderItems,
          order.paymentStatus === PaymentStatus.FAILED
            ? 'Payment failed and was not retried'
            : `Payment not completed within ${olderThanMinutes} minutes`,
        );
        result.released += 1;
      } catch (err) {
        // One bad order must not stop the sweep; the next run tries again.
        this.logger.error(
          `Could not expire order ${order.orderNumber}: ${(err as Error).message}`,
        );
        result.failed += 1;
      }
    }

    if (result.examined > 0) {
      this.logger.log(
        `Abandoned-order sweep: examined ${result.examined}, released ${result.released}, ` +
          `settled ${result.settled}, failed ${result.failed}`,
      );
    }
    return result;
  }

  private async restockAndCancel(
    orderId: string,
    items: { variantId: string | null; quantity: number }[],
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      /*
       * Refuse to cancel an order that has been settled since the caller
       * looked at it.
       *
       * The sweep and a webhook can be working on the same order at the same
       * moment, and returning stock for an order somebody has paid for is the
       * one outcome here that costs real money. Re-read inside the transaction
       * rather than trusting what was read outside it.
       */
      const current = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, paymentStatus: true, orderNumber: true },
      });

      if (!current) throw new NotFoundException('Order not found');

      if (current.paymentStatus === PaymentStatus.PAID) {
        this.logger.warn(
          `Refusing to cancel ${current.orderNumber}: it was paid while this was in flight`,
        );
        throw new ConflictException('That order has been paid and cannot be cancelled');
      }

      if (current.status === OrderStatus.CANCELLED) {
        // Someone else got there first. Returning the stock twice would invent
        // inventory that does not exist.
        this.logger.log(`${current.orderNumber} was already cancelled; leaving stock alone`);
        return tx.order.findUniqueOrThrow({ where: { id: orderId } });
      }

      for (const item of items) {
        if (!item.variantId) continue;

        const variant = await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            change: item.quantity,
            balanceAfter: variant.stockQuantity,
            reason: StockMovementReason.ORDER_CANCELLED,
            referenceId: orderId,
          },
        });
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason,
          statusHistory: { create: { status: OrderStatus.CANCELLED, note: reason } },
        },
      });
    });
  }

  // --- ADMIN ORDER MANAGEMENT ---

  async getAllOrdersAdmin(
    filters: { status?: OrderStatus; search?: string; page?: number; pageSize?: number } = {},
  ) {
    const { page, pageSize, skip, take } = pageParams(filters);

    const where = {
        /*
         * A checkout somebody abandoned before paying is not an order, and the
         * desk should not have to scroll past it. Those rows are kept — they
         * consumed a number, held stock for a while, and are worth having if a
         * customer ever asks what happened — but they are out of the default
         * list.
         *
         * Asking for CANCELLED explicitly still shows them, which is where
         * anyone looking for one would look. And a cancelled order that *was*
         * paid is a real event with money behind it, so it stays visible
         * either way.
         */
        ...(filters.status
          ? { status: filters.status }
          : {
              NOT: {
                status: OrderStatus.CANCELLED,
                paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
              },
            }),
        ...(filters.search
          ? {
              OR: [
                { orderNumber: { contains: filters.search, mode: 'insensitive' as const } },
                { user: { name: { contains: filters.search, mode: 'insensitive' as const } } },
                { user: { phone: { contains: filters.search } } },
                { user: { email: { contains: filters.search, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
    };

    // Counted alongside, so the client can tell a last page from a truncated
    // one. The old fixed take of 200 could do neither.
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          driver: { select: { id: true, name: true } },
          orderItems: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(items, total, { page, pageSize });
  }

  async updateOrderStatusAdmin(
    orderId: string,
    status: OrderStatus,
    options: {
      driverId?: string;
      trackingNumber?: string;
      shippingCarrier?: string;
      note?: string;
    } = {},
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== status && !ALLOWED_TRANSITIONS[order.status].includes(status)) {
      /*
       * Say what is actually wrong.
       *
       * Nearly every refusal here is one case — a dispatch attempt on an order
       * nobody has paid for — and "Cannot move an order from PENDING to
       * SHIPPED" describes the rule rather than the problem, leaving the desk
       * to work out that PENDING means unpaid.
       */
      if (order.status === OrderStatus.PENDING && status === OrderStatus.SHIPPED) {
        throw new BadRequestException(
          `Order ${order.orderNumber} has not been paid for yet, so it cannot be dispatched. ` +
            'It will confirm itself when the payment lands, or be cancelled if it never does.',
        );
      }

      throw new BadRequestException(
        `Cannot move an order from ${order.status} to ${status}`,
      );
    }

    // Cancelling from the admin side must also return the stock.
    if (status === OrderStatus.CANCELLED) {
      return this.restockAndCancel(
        order.id,
        order.orderItems,
        options.note ?? 'Cancelled by staff',
      );
    }

    const timestamps: Prisma.OrderUpdateInput = {};
    if (status === OrderStatus.CONFIRMED) timestamps.confirmedAt = new Date();
    if (status === OrderStatus.SHIPPED) timestamps.shippedAt = new Date();
    if (status === OrderStatus.DELIVERED) timestamps.deliveredAt = new Date();

    await this.audit.record({
      action: 'STATUS_CHANGE',
      entity: 'Order',
      entityId: order.orderNumber,
      before: { status: order.status },
      after: {
        status,
        driverId: options.driverId,
        trackingNumber: options.trackingNumber,
        shippingCarrier: options.shippingCarrier,
      },
    });

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...timestamps,
        // `driver: connect` rather than a raw driverId, because Prisma will not
        // mix unchecked scalar FKs with nested writes like statusHistory.
        ...(options.driverId ? { driver: { connect: { id: options.driverId } } } : {}),
        ...(options.trackingNumber ? { trackingNumber: options.trackingNumber } : {}),
        ...(options.shippingCarrier ? { shippingCarrier: options.shippingCarrier } : {}),
        statusHistory: { create: { status, note: options.note } },
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        driver: { select: { id: true, name: true } },
        orderItems: true,
      },
    });
  }

  /**
   * Moves an order between the local round and the courier desk.
   *
   * Nothing decides this at checkout — the storefront cannot know whether an
   * address is inside the van's area — so the desk decides per order. The two
   * queues are mutually exclusive: route sheets read deliveryType LOCAL and
   * the consignment desk reads everything else, so an order is only ever in
   * one of them.
   */
  async setDeliveryTypeAdmin(orderId: string, deliveryType: DeliveryType, note?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        deliveryType: true,
        driverId: true,
        trackingNumber: true,
        shippingCarrier: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.deliveryType === deliveryType) {
      throw new BadRequestException(`That order is already going out by ${deliveryType.toLowerCase()}`);
    }

    // Once it has been handed over or cancelled the question is settled, and
    // moving it would only make the record disagree with what happened.
    if (
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.RETURNED
    ) {
      throw new BadRequestException(
        `An order that is ${order.status.toLowerCase()} cannot change how it ships`,
      );
    }

    // A waybill means the parcel is already with the carrier. Quietly dropping
    // it to put the order on a van would strand a real consignment nobody is
    // tracking any more.
    if (deliveryType === DeliveryType.LOCAL && order.trackingNumber) {
      throw new BadRequestException(
        `That order is already with ${order.shippingCarrier ?? 'the carrier'} on waybill ` +
          `${order.trackingNumber}. Cancel the consignment before putting it on a local round.`,
      );
    }

    await this.audit.record({
      action: 'STATUS_CHANGE',
      entity: 'Order',
      entityId: order.orderNumber,
      before: { deliveryType: order.deliveryType, driverId: order.driverId },
      after: { deliveryType },
    });

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryType,
        // A driver assignment belongs to a local round. Leaving it set would
        // keep the order on that driver's list after it left for the courier.
        ...(deliveryType === DeliveryType.COURIER ? { driver: { disconnect: true } } : {}),
        statusHistory: {
          create: {
            status: order.status,
            note:
              note ??
              `Fulfilment changed to ${deliveryType === DeliveryType.LOCAL ? 'local delivery' : 'courier'}`,
          },
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        driver: { select: { id: true, name: true } },
        orderItems: true,
      },
    });
  }

  async getOrderStatsAdmin() {
    const [statusCounts, revenue, todayCount] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], _count: true }),
      this.prisma.order.aggregate({
        where: { paymentStatus: PaymentStatus.PAID },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);

    return {
      byStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
      totalRevenue: round2(Number(revenue._sum.totalAmount ?? 0)),
      ordersToday: todayCount,
    };
  }
}
