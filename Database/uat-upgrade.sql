START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN

    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "DashboardConfigJson" text;

    ALTER TABLE "Subscribers" ADD COLUMN IF NOT EXISTS "LastAuthAt" timestamp with time zone;
    ALTER TABLE "Subscribers" ADD COLUMN IF NOT EXISTS "LastAuthReason" character varying(200);
    ALTER TABLE "Subscribers" ADD COLUMN IF NOT EXISTS "LastAuthResult" character varying(20);

    ALTER TABLE "SubscriberPackageHistories" ADD COLUMN IF NOT EXISTS "AmountCharged" numeric NOT NULL DEFAULT 0.0;
    ALTER TABLE "SubscriberPackageHistories" ADD COLUMN IF NOT EXISTS "CreatedByName" text;
    ALTER TABLE "SubscriberPackageHistories" ADD COLUMN IF NOT EXISTS "CreatedByUserId" uuid;
    ALTER TABLE "SubscriberPackageHistories" ADD COLUMN IF NOT EXISTS "EndDate" timestamp with time zone;
    ALTER TABLE "SubscriberPackageHistories" ADD COLUMN IF NOT EXISTS "Quantity" integer NOT NULL DEFAULT 0;
    ALTER TABLE "SubscriberPackageHistories" ADD COLUMN IF NOT EXISTS "SiteId" uuid;
    ALTER TABLE "SubscriberPackageHistories" ADD COLUMN IF NOT EXISTS "StartDate" timestamp with time zone;

    ALTER TABLE "NasDevices" ADD COLUMN IF NOT EXISTS "DashboardInterfaces" text;

    CREATE TABLE IF NOT EXISTS "PaymentGatewayConfigs" (
        "Id" uuid NOT NULL,
        "OrganizationId" uuid NOT NULL,
        "SiteId" uuid,
        "Provider" character varying(50) NOT NULL,
        "DisplayName" character varying(100) NOT NULL,
        "Mode" character varying(10) NOT NULL,
        "MerchantId" character varying(200),
        "ApiKey" character varying(500),
        "ApiSecret" character varying(500),
        "SaltOrWebhookSecret" character varying(500),
        "CallbackUrl" character varying(500),
        "IsActive" boolean NOT NULL,
        "IsDefault" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "PK_PaymentGatewayConfigs" PRIMARY KEY ("Id")
    );

    CREATE TABLE IF NOT EXISTS "SmsGatewayConfigs" (
        "Id" uuid NOT NULL,
        "OrganizationId" uuid NOT NULL,
        "SiteId" uuid,
        "ProviderName" character varying(100) NOT NULL,
        "ApiUrl" character varying(1000) NOT NULL,
        "HttpMethod" character varying(10) NOT NULL,
        "PostBodyTemplate" text,
        "ContentType" character varying(100),
        "ApiKey" character varying(500),
        "SenderId" character varying(50),
        "SuccessKeyword" character varying(200),
        "SendOnRecharge" boolean NOT NULL,
        "SendExpiryReminder" boolean NOT NULL,
        "ReminderDaysBefore" integer NOT NULL,
        "SendOnExpiry" boolean NOT NULL,
        "RechargeTemplate" character varying(1000) NOT NULL,
        "ReminderTemplate" character varying(1000) NOT NULL,
        "ExpiredTemplate" character varying(1000) NOT NULL,
        "RechargeTemplateId" character varying(50),
        "ReminderTemplateId" character varying(50),
        "ExpiredTemplateId" character varying(50),
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "PK_SmsGatewayConfigs" PRIMARY KEY ("Id")
    );

    CREATE TABLE IF NOT EXISTS "SmsLogs" (
        "Id" uuid NOT NULL,
        "SiteId" uuid,
        "SubscriberId" uuid,
        "Mobile" character varying(20) NOT NULL,
        "Message" character varying(1000) NOT NULL,
        "Purpose" character varying(20) NOT NULL,
        "Status" character varying(20) NOT NULL,
        "ProviderResponse" character varying(1000),
        "CreatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "PK_SmsLogs" PRIMARY KEY ("Id")
    );

    CREATE INDEX IF NOT EXISTS "IX_Subscribers_ExpireDate" ON "Subscribers" ("ExpireDate");
    CREATE INDEX IF NOT EXISTS "IX_Subscribers_PPPoEUsername" ON "Subscribers" ("PPPoEUsername");
    CREATE INDEX IF NOT EXISTS "IX_Subscribers_SiteId" ON "Subscribers" ("SiteId");
    CREATE INDEX IF NOT EXISTS "IX_SubscriberPackageHistories_SiteId_CreatedAt" ON "SubscriberPackageHistories" ("SiteId", "CreatedAt");
    CREATE INDEX IF NOT EXISTS "IX_SubscriberPackageHistories_SubscriberId" ON "SubscriberPackageHistories" ("SubscriberId");
    CREATE INDEX IF NOT EXISTS "IX_RadiusAuthenticationLogs_CreatedAt" ON "RadiusAuthenticationLogs" ("CreatedAt");
    CREATE INDEX IF NOT EXISTS "IX_RadiusAuthenticationLogs_SubscriberId" ON "RadiusAuthenticationLogs" ("SubscriberId");
    CREATE INDEX IF NOT EXISTS "IX_RadiusAccountingSessions_SubscriberId_IsActive" ON "RadiusAccountingSessions" ("SubscriberId", "IsActive");
    CREATE INDEX IF NOT EXISTS "IX_PaymentGatewayConfigs_OrganizationId_SiteId" ON "PaymentGatewayConfigs" ("OrganizationId", "SiteId");
    CREATE INDEX IF NOT EXISTS "IX_SmsGatewayConfigs_OrganizationId_SiteId" ON "SmsGatewayConfigs" ("OrganizationId", "SiteId");
    CREATE INDEX IF NOT EXISTS "IX_SmsLogs_CreatedAt" ON "SmsLogs" ("CreatedAt");
    CREATE INDEX IF NOT EXISTS "IX_SmsLogs_SubscriberId" ON "SmsLogs" ("SubscriberId");

    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN

    UPDATE "Subscribers"
    SET "IsActive" = TRUE, "ConnectionEnabled" = TRUE
    WHERE "IsActive" = FALSE
      AND "ConnectionEnabled" = FALSE
      AND "ExpireDate" IS NOT NULL
      AND "ExpireDate" < NOW();
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN

    UPDATE "SubscriberPackageHistories" h
    SET "SiteId" = s."SiteId"
    FROM "Subscribers" s
    WHERE h."SubscriberId" = s."Id" AND h."SiteId" IS NULL;

    UPDATE "SubscriberPackageHistories"
    SET "Quantity" = 1
    WHERE "Quantity" IS NULL OR "Quantity" < 1;

    UPDATE "SubscriberPackageHistories"
    SET "StartDate" = "AssignedAt"
    WHERE "StartDate" IS NULL;

    UPDATE "SubscriberPackageHistories"
    SET "EndDate" = "AssignedAt" + ("ValidityDays" || ' days')::interval
    WHERE "EndDate" IS NULL AND "ValidityDays" > 0;

    UPDATE "SubscriberPackageHistories"
    SET "AmountCharged" = "Price"
    WHERE "AmountCharged" = 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN

    UPDATE "Subscribers"
    SET "PPPoEUsername" = BTRIM("PPPoEUsername")
    WHERE "PPPoEUsername" <> BTRIM("PPPoEUsername");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261112072328_UatEnhancements_RechargeSmsPaymentDashboard', '10.0.10');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072353_UniquePppoeUsername') THEN

    DO $$
    DECLARE dup_list TEXT;
    BEGIN
        SELECT string_agg(u || ' (' || c || ' times)', ', ')
        INTO dup_list
        FROM (
            SELECT LOWER("PPPoEUsername") AS u, COUNT(*) AS c
            FROM "Subscribers"
            WHERE "PPPoEUsername" <> ''
            GROUP BY LOWER("PPPoEUsername")
            HAVING COUNT(*) > 1
            ORDER BY 1
            LIMIT 50
        ) d;

        IF dup_list IS NOT NULL THEN
            RAISE EXCEPTION 'Duplicate PPPoE usernames found: %. Fix them (Database/check-duplicate-pppoe-usernames.sql) and run the migration again.', dup_list;
        END IF;
    END $$;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072353_UniquePppoeUsername') THEN

    CREATE UNIQUE INDEX IF NOT EXISTS "UX_Subscribers_PPPoEUsername_Lower"
    ON "Subscribers" (LOWER("PPPoEUsername"))
    WHERE "PPPoEUsername" <> '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072353_UniquePppoeUsername') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261112072353_UniquePppoeUsername', '10.0.10');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112092725_UserOwnLogo') THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "LogoUrl" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112092725_UserOwnLogo') THEN

    UPDATE "Users" u
    SET "LogoUrl" = o."LogoUrl"
    FROM "Organizations" o
    WHERE u."OrganizationId" = o."Id"
      AND u."LogoUrl" IS NULL
      AND o."LogoUrl" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Sites" s WHERE s."UserId" = u."Id");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112092725_UserOwnLogo') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261112092725_UserOwnLogo', '10.0.10');
    END IF;
END $EF$;
COMMIT;

