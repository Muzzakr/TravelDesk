-- Supabase auto-exposes every table in the `public` schema through its
-- PostgREST API (the anon/authenticated roles) unless Row Level Security is
-- enabled on that table. This app never uses that API — Prisma connects
-- directly as the Postgres table-owner role, which bypasses RLS by default —
-- so enabling RLS here with zero policies blocks all anon/authenticated
-- access via Supabase's REST API while leaving Prisma's own access
-- completely unaffected. Confirmed exploitable before this migration:
-- SELECT * on "User" (including passwordHash) returned real rows via the
-- public REST API using only the project's anon key, no other credentials.

ALTER TABLE "public"."Company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CompanySsoConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Subscriber" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MfaBackupCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EventDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TravelRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BookingConfirmation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BookingOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ApprovalAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CardTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CardMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CardTransactionReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailNotificationSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."UserNotificationSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."KnownLoginDevice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PayoutReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PolicyRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TravelerProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."WebhookSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."WebhookDelivery" ENABLE ROW LEVEL SECURITY;
