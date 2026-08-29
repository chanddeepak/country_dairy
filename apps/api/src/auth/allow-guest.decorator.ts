import { SetMetadata } from '@nestjs/common';

export const ALLOW_GUEST = 'allowGuest';

/**
 * Lets a route run without a session.
 *
 * Only for the two places a customer legitimately has no account yet: placing
 * a guest order, and confirming the payment that creates their account. Both
 * carry their own proof — the checkout has the cart, the confirm has a claim
 * token — so neither is open in the sense of being unprotected.
 *
 * A token that *is* present is still validated. Quietly treating an expired
 * session as a guest would attach somebody's order to nobody and look, to
 * them, like it had simply vanished.
 */
export const AllowGuest = () => SetMetadata(ALLOW_GUEST, true);
