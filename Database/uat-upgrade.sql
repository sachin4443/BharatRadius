START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    ALTER TABLE "Users" ADD "DashboardConfigJson" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    ALTER TABLE "Subscribers" ADD "LastAuthAt" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    ALTER TABLE "Subscribers" ADD "LastAuthReason" character varying(200);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    ALTER TABLE "Subscribers" ADD "LastAuthResult" character varying(20);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    ALTER TABLE "SubscriberPackageHistories" ADD "AmountCharged" numeric NOT NULL DEFAULT 0.0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    ALTER TABLE "SubscriberPackageHistories" ADD "CreatedByName" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    ALTER TABLE "SubscriberPackageHistories" ADD "CreatedByUserId" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    ALTER TABLE "SubscriberPackageHistories" ADD "EndDate" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    ALTER TABLE "SubscriberPackageHistories" ADD "Quantity" integer NOT NULL DEFAULT 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    ALTER TABLE "SubscriberPackageHistories" ADD "SiteId" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    ALTER TABLE "SubscriberPackageHistories" ADD "StartDate" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    ALTER TABLE "NasDevices" ADD "DashboardInterfaces" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE TABLE "PaymentGatewayConfigs" (
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
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE TABLE "SmsGatewayConfigs" (
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
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE TABLE "SmsLogs" (
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
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE INDEX "IX_Subscribers_ExpireDate" ON "Subscribers" ("ExpireDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE INDEX "IX_Subscribers_PPPoEUsername" ON "Subscribers" ("PPPoEUsername");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE INDEX "IX_Subscribers_SiteId" ON "Subscribers" ("SiteId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE INDEX "IX_SubscriberPackageHistories_SiteId_CreatedAt" ON "SubscriberPackageHistories" ("SiteId", "CreatedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE INDEX "IX_SubscriberPackageHistories_SubscriberId" ON "SubscriberPackageHistories" ("SubscriberId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE INDEX "IX_RadiusAuthenticationLogs_CreatedAt" ON "RadiusAuthenticationLogs" ("CreatedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE INDEX "IX_RadiusAuthenticationLogs_SubscriberId" ON "RadiusAuthenticationLogs" ("SubscriberId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE INDEX "IX_RadiusAccountingSessions_SubscriberId_IsActive" ON "RadiusAccountingSessions" ("SubscriberId", "IsActive");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE INDEX "IX_PaymentGatewayConfigs_OrganizationId_SiteId" ON "PaymentGatewayConfigs" ("OrganizationId", "SiteId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE INDEX "IX_SmsGatewayConfigs_OrganizationId_SiteId" ON "SmsGatewayConfigs" ("OrganizationId", "SiteId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE INDEX "IX_SmsLogs_CreatedAt" ON "SmsLogs" ("CreatedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261112072328_UatEnhancements_RechargeSmsPaymentDashboard') THEN
    CREATE INDEX "IX_SmsLogs_SubscriberId" ON "SmsLogs" ("SubscriberId");
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

