-- A guest checkout creates the order before anyone has identified themselves:
-- Cashfree collects and verifies the phone during payment, and only then can
-- the order be attached to an account.
ALTER TABLE "Order" ALTER COLUMN "userId" DROP NOT NULL;

-- Proof that this browser placed the order. The confirm route cannot require a
-- session for a guest, and keying it on the order id would hand a session to
-- anyone who guessed one — orderNumber is max + 1, so guessing is trivial.
-- Hashed, because it grants a login.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "claimTokenHash" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "claimTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Order_claimTokenHash_key"
  ON "Order" ("claimTokenHash");
