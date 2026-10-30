ALTER TABLE "users"
ADD COLUMN "verificationTokenDigest" TEXT,
ADD COLUMN "passwordResetTokenDigest" TEXT;

CREATE UNIQUE INDEX "users_verificationTokenDigest_key"
ON "users"("verificationTokenDigest");

CREATE UNIQUE INDEX "users_passwordResetTokenDigest_key"
ON "users"("passwordResetTokenDigest");
