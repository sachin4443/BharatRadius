using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RadiusSoftware.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UatEnhancements_RechargeSmsPaymentDashboard : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Written with IF NOT EXISTS so the migration also works on databases
            // where some of these columns / indexes were already created by hand
            // (e.g. IX_Subscribers_SiteId), and can safely be run again.
            migrationBuilder.Sql(@"
ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""DashboardConfigJson"" text;

ALTER TABLE ""Subscribers"" ADD COLUMN IF NOT EXISTS ""LastAuthAt"" timestamp with time zone;
ALTER TABLE ""Subscribers"" ADD COLUMN IF NOT EXISTS ""LastAuthReason"" character varying(200);
ALTER TABLE ""Subscribers"" ADD COLUMN IF NOT EXISTS ""LastAuthResult"" character varying(20);

ALTER TABLE ""SubscriberPackageHistories"" ADD COLUMN IF NOT EXISTS ""AmountCharged"" numeric NOT NULL DEFAULT 0.0;
ALTER TABLE ""SubscriberPackageHistories"" ADD COLUMN IF NOT EXISTS ""CreatedByName"" text;
ALTER TABLE ""SubscriberPackageHistories"" ADD COLUMN IF NOT EXISTS ""CreatedByUserId"" uuid;
ALTER TABLE ""SubscriberPackageHistories"" ADD COLUMN IF NOT EXISTS ""EndDate"" timestamp with time zone;
ALTER TABLE ""SubscriberPackageHistories"" ADD COLUMN IF NOT EXISTS ""Quantity"" integer NOT NULL DEFAULT 0;
ALTER TABLE ""SubscriberPackageHistories"" ADD COLUMN IF NOT EXISTS ""SiteId"" uuid;
ALTER TABLE ""SubscriberPackageHistories"" ADD COLUMN IF NOT EXISTS ""StartDate"" timestamp with time zone;

ALTER TABLE ""NasDevices"" ADD COLUMN IF NOT EXISTS ""DashboardInterfaces"" text;

CREATE TABLE IF NOT EXISTS ""PaymentGatewayConfigs"" (
    ""Id"" uuid NOT NULL,
    ""OrganizationId"" uuid NOT NULL,
    ""SiteId"" uuid,
    ""Provider"" character varying(50) NOT NULL,
    ""DisplayName"" character varying(100) NOT NULL,
    ""Mode"" character varying(10) NOT NULL,
    ""MerchantId"" character varying(200),
    ""ApiKey"" character varying(500),
    ""ApiSecret"" character varying(500),
    ""SaltOrWebhookSecret"" character varying(500),
    ""CallbackUrl"" character varying(500),
    ""IsActive"" boolean NOT NULL,
    ""IsDefault"" boolean NOT NULL,
    ""CreatedAt"" timestamp with time zone NOT NULL,
    ""UpdatedAt"" timestamp with time zone NOT NULL,
    CONSTRAINT ""PK_PaymentGatewayConfigs"" PRIMARY KEY (""Id"")
);

CREATE TABLE IF NOT EXISTS ""SmsGatewayConfigs"" (
    ""Id"" uuid NOT NULL,
    ""OrganizationId"" uuid NOT NULL,
    ""SiteId"" uuid,
    ""ProviderName"" character varying(100) NOT NULL,
    ""ApiUrl"" character varying(1000) NOT NULL,
    ""HttpMethod"" character varying(10) NOT NULL,
    ""PostBodyTemplate"" text,
    ""ContentType"" character varying(100),
    ""ApiKey"" character varying(500),
    ""SenderId"" character varying(50),
    ""SuccessKeyword"" character varying(200),
    ""SendOnRecharge"" boolean NOT NULL,
    ""SendExpiryReminder"" boolean NOT NULL,
    ""ReminderDaysBefore"" integer NOT NULL,
    ""SendOnExpiry"" boolean NOT NULL,
    ""RechargeTemplate"" character varying(1000) NOT NULL,
    ""ReminderTemplate"" character varying(1000) NOT NULL,
    ""ExpiredTemplate"" character varying(1000) NOT NULL,
    ""RechargeTemplateId"" character varying(50),
    ""ReminderTemplateId"" character varying(50),
    ""ExpiredTemplateId"" character varying(50),
    ""IsActive"" boolean NOT NULL,
    ""CreatedAt"" timestamp with time zone NOT NULL,
    ""UpdatedAt"" timestamp with time zone NOT NULL,
    CONSTRAINT ""PK_SmsGatewayConfigs"" PRIMARY KEY (""Id"")
);

CREATE TABLE IF NOT EXISTS ""SmsLogs"" (
    ""Id"" uuid NOT NULL,
    ""SiteId"" uuid,
    ""SubscriberId"" uuid,
    ""Mobile"" character varying(20) NOT NULL,
    ""Message"" character varying(1000) NOT NULL,
    ""Purpose"" character varying(20) NOT NULL,
    ""Status"" character varying(20) NOT NULL,
    ""ProviderResponse"" character varying(1000),
    ""CreatedAt"" timestamp with time zone NOT NULL,
    CONSTRAINT ""PK_SmsLogs"" PRIMARY KEY (""Id"")
);

CREATE INDEX IF NOT EXISTS ""IX_Subscribers_ExpireDate"" ON ""Subscribers"" (""ExpireDate"");
CREATE INDEX IF NOT EXISTS ""IX_Subscribers_PPPoEUsername"" ON ""Subscribers"" (""PPPoEUsername"");
CREATE INDEX IF NOT EXISTS ""IX_Subscribers_SiteId"" ON ""Subscribers"" (""SiteId"");
CREATE INDEX IF NOT EXISTS ""IX_SubscriberPackageHistories_SiteId_CreatedAt"" ON ""SubscriberPackageHistories"" (""SiteId"", ""CreatedAt"");
CREATE INDEX IF NOT EXISTS ""IX_SubscriberPackageHistories_SubscriberId"" ON ""SubscriberPackageHistories"" (""SubscriberId"");
CREATE INDEX IF NOT EXISTS ""IX_RadiusAuthenticationLogs_CreatedAt"" ON ""RadiusAuthenticationLogs"" (""CreatedAt"");
CREATE INDEX IF NOT EXISTS ""IX_RadiusAuthenticationLogs_SubscriberId"" ON ""RadiusAuthenticationLogs"" (""SubscriberId"");
CREATE INDEX IF NOT EXISTS ""IX_RadiusAccountingSessions_SubscriberId_IsActive"" ON ""RadiusAccountingSessions"" (""SubscriberId"", ""IsActive"");
CREATE INDEX IF NOT EXISTS ""IX_PaymentGatewayConfigs_OrganizationId_SiteId"" ON ""PaymentGatewayConfigs"" (""OrganizationId"", ""SiteId"");
CREATE INDEX IF NOT EXISTS ""IX_SmsGatewayConfigs_OrganizationId_SiteId"" ON ""SmsGatewayConfigs"" (""OrganizationId"", ""SiteId"");
CREATE INDEX IF NOT EXISTS ""IX_SmsLogs_CreatedAt"" ON ""SmsLogs"" (""CreatedAt"");
CREATE INDEX IF NOT EXISTS ""IX_SmsLogs_SubscriberId"" ON ""SmsLogs"" (""SubscriberId"");
");

            // ---------------------------------------------------------------
            // DATA FIXES
            // ---------------------------------------------------------------

            // 1. The old expiry job switched expired users OFF (IsActive = false AND
            //    ConnectionEnabled = false). Expiry is now checked by date in the
            //    RADIUS server, so these users are switched back ON; they stay
            //    blocked as "Expired" until recharged. Manually suspended or
            //    disconnected users only had ONE of the two flags set and are untouched.
            migrationBuilder.Sql(@"
UPDATE ""Subscribers""
SET ""IsActive"" = TRUE, ""ConnectionEnabled"" = TRUE
WHERE ""IsActive"" = FALSE
  AND ""ConnectionEnabled"" = FALSE
  AND ""ExpireDate"" IS NOT NULL
  AND ""ExpireDate"" < NOW();");

            // 2. Fill recharge details for old package history rows
            migrationBuilder.Sql(@"
UPDATE ""SubscriberPackageHistories"" h
SET ""SiteId"" = s.""SiteId""
FROM ""Subscribers"" s
WHERE h.""SubscriberId"" = s.""Id"" AND h.""SiteId"" IS NULL;

UPDATE ""SubscriberPackageHistories""
SET ""Quantity"" = 1
WHERE ""Quantity"" IS NULL OR ""Quantity"" < 1;

UPDATE ""SubscriberPackageHistories""
SET ""StartDate"" = ""AssignedAt""
WHERE ""StartDate"" IS NULL;

UPDATE ""SubscriberPackageHistories""
SET ""EndDate"" = ""AssignedAt"" + (""ValidityDays"" || ' days')::interval
WHERE ""EndDate"" IS NULL AND ""ValidityDays"" > 0;

UPDATE ""SubscriberPackageHistories""
SET ""AmountCharged"" = ""Price""
WHERE ""AmountCharged"" = 0;");

            // 3. Remove spaces around PPPoE usernames (they break RADIUS logins)
            migrationBuilder.Sql(@"
UPDATE ""Subscribers""
SET ""PPPoEUsername"" = BTRIM(""PPPoEUsername"")
WHERE ""PPPoEUsername"" <> BTRIM(""PPPoEUsername"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PaymentGatewayConfigs");

            migrationBuilder.DropTable(
                name: "SmsGatewayConfigs");

            migrationBuilder.DropTable(
                name: "SmsLogs");

            migrationBuilder.DropIndex(
                name: "IX_Subscribers_ExpireDate",
                table: "Subscribers");

            migrationBuilder.DropIndex(
                name: "IX_Subscribers_PPPoEUsername",
                table: "Subscribers");

            migrationBuilder.DropIndex(
                name: "IX_Subscribers_SiteId",
                table: "Subscribers");

            migrationBuilder.DropIndex(
                name: "IX_SubscriberPackageHistories_SiteId_CreatedAt",
                table: "SubscriberPackageHistories");

            migrationBuilder.DropIndex(
                name: "IX_SubscriberPackageHistories_SubscriberId",
                table: "SubscriberPackageHistories");

            migrationBuilder.DropIndex(
                name: "IX_RadiusAuthenticationLogs_CreatedAt",
                table: "RadiusAuthenticationLogs");

            migrationBuilder.DropIndex(
                name: "IX_RadiusAuthenticationLogs_SubscriberId",
                table: "RadiusAuthenticationLogs");

            migrationBuilder.DropIndex(
                name: "IX_RadiusAccountingSessions_SubscriberId_IsActive",
                table: "RadiusAccountingSessions");

            migrationBuilder.DropColumn(
                name: "DashboardConfigJson",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastAuthAt",
                table: "Subscribers");

            migrationBuilder.DropColumn(
                name: "LastAuthReason",
                table: "Subscribers");

            migrationBuilder.DropColumn(
                name: "LastAuthResult",
                table: "Subscribers");

            migrationBuilder.DropColumn(
                name: "AmountCharged",
                table: "SubscriberPackageHistories");

            migrationBuilder.DropColumn(
                name: "CreatedByName",
                table: "SubscriberPackageHistories");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "SubscriberPackageHistories");

            migrationBuilder.DropColumn(
                name: "EndDate",
                table: "SubscriberPackageHistories");

            migrationBuilder.DropColumn(
                name: "Quantity",
                table: "SubscriberPackageHistories");

            migrationBuilder.DropColumn(
                name: "SiteId",
                table: "SubscriberPackageHistories");

            migrationBuilder.DropColumn(
                name: "StartDate",
                table: "SubscriberPackageHistories");

            migrationBuilder.DropColumn(
                name: "DashboardInterfaces",
                table: "NasDevices");
        }
    }
}
