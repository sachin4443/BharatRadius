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
            migrationBuilder.AddColumn<string>(
                name: "DashboardConfigJson",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastAuthAt",
                table: "Subscribers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastAuthReason",
                table: "Subscribers",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastAuthResult",
                table: "Subscribers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AmountCharged",
                table: "SubscriberPackageHistories",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByName",
                table: "SubscriberPackageHistories",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "SubscriberPackageHistories",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EndDate",
                table: "SubscriberPackageHistories",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Quantity",
                table: "SubscriberPackageHistories",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "SiteId",
                table: "SubscriberPackageHistories",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StartDate",
                table: "SubscriberPackageHistories",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DashboardInterfaces",
                table: "NasDevices",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PaymentGatewayConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    SiteId = table.Column<Guid>(type: "uuid", nullable: true),
                    Provider = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Mode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    MerchantId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ApiKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ApiSecret = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SaltOrWebhookSecret = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CallbackUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentGatewayConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SmsGatewayConfigs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    SiteId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProviderName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ApiUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    HttpMethod = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    PostBodyTemplate = table.Column<string>(type: "text", nullable: true),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ApiKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SenderId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    SuccessKeyword = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SendOnRecharge = table.Column<bool>(type: "boolean", nullable: false),
                    SendExpiryReminder = table.Column<bool>(type: "boolean", nullable: false),
                    ReminderDaysBefore = table.Column<int>(type: "integer", nullable: false),
                    SendOnExpiry = table.Column<bool>(type: "boolean", nullable: false),
                    RechargeTemplate = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ReminderTemplate = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ExpiredTemplate = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    RechargeTemplateId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ReminderTemplateId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ExpiredTemplateId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SmsGatewayConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SmsLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SiteId = table.Column<Guid>(type: "uuid", nullable: true),
                    SubscriberId = table.Column<Guid>(type: "uuid", nullable: true),
                    Mobile = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Purpose = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ProviderResponse = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SmsLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Subscribers_ExpireDate",
                table: "Subscribers",
                column: "ExpireDate");

            migrationBuilder.CreateIndex(
                name: "IX_Subscribers_PPPoEUsername",
                table: "Subscribers",
                column: "PPPoEUsername");

            migrationBuilder.CreateIndex(
                name: "IX_Subscribers_SiteId",
                table: "Subscribers",
                column: "SiteId");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriberPackageHistories_SiteId_CreatedAt",
                table: "SubscriberPackageHistories",
                columns: new[] { "SiteId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SubscriberPackageHistories_SubscriberId",
                table: "SubscriberPackageHistories",
                column: "SubscriberId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusAuthenticationLogs_CreatedAt",
                table: "RadiusAuthenticationLogs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusAuthenticationLogs_SubscriberId",
                table: "RadiusAuthenticationLogs",
                column: "SubscriberId");

            migrationBuilder.CreateIndex(
                name: "IX_RadiusAccountingSessions_SubscriberId_IsActive",
                table: "RadiusAccountingSessions",
                columns: new[] { "SubscriberId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_PaymentGatewayConfigs_OrganizationId_SiteId",
                table: "PaymentGatewayConfigs",
                columns: new[] { "OrganizationId", "SiteId" });

            migrationBuilder.CreateIndex(
                name: "IX_SmsGatewayConfigs_OrganizationId_SiteId",
                table: "SmsGatewayConfigs",
                columns: new[] { "OrganizationId", "SiteId" });

            migrationBuilder.CreateIndex(
                name: "IX_SmsLogs_CreatedAt",
                table: "SmsLogs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SmsLogs_SubscriberId",
                table: "SmsLogs",
                column: "SubscriberId");

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
