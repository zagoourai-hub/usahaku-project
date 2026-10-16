-- Email verification gates the AI features from now on. Accounts created before
-- this feature existed were never asked to verify, so they keep access.
UPDATE "User" SET "emailVerified" = true WHERE "emailVerified" = false;
