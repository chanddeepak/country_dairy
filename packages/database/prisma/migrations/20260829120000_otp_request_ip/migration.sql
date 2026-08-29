-- Rate limiting by phone alone stops nothing: an attacker cycles numbers, every
-- request looks like a different customer, and each one spends a real message.
ALTER TABLE "OtpVerification" ADD COLUMN IF NOT EXISTS "requestIp" TEXT;

CREATE INDEX IF NOT EXISTS "OtpVerification_requestIp_createdAt_idx"
  ON "OtpVerification" ("requestIp", "createdAt");

-- The daily ceiling counts every row in a window regardless of phone or IP.
CREATE INDEX IF NOT EXISTS "OtpVerification_createdAt_idx"
  ON "OtpVerification" ("createdAt");
