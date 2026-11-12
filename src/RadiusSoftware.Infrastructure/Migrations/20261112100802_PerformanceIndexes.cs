using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RadiusSoftware.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Indexes for the hottest queries (IF NOT EXISTS: safe on databases where
            // an index was already created by hand). No data is changed.

            // RADIUS accounting: every Start / Interim / Stop packet looks up its
            // session by NAS + Acct-Session-Id (was a full table scan).
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_RadiusAccountingSessions_NasId_AcctSessionId""
                ON ""RadiusAccountingSessions"" (""NasId"", ""AcctSessionId"");");

            // Accounting-On/Off closes all open sessions of one NAS
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_RadiusAccountingSessions_NasId_IsActive""
                ON ""RadiusAccountingSessions"" (""NasId"") WHERE ""IsActive"";");

            // Auth log page / dashboard: filter by NAS (site) and date
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_RadiusAuthenticationLogs_NasId_CreatedAt""
                ON ""RadiusAuthenticationLogs"" (""NasId"", ""CreatedAt"");");

            // Static IP / Hotspot users that log in by MAC
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_Subscribers_MacAddress_Upper""
                ON ""Subscribers"" (UPPER(""MacAddress"")) WHERE ""MacAddress"" <> '';");

            // Current package of a subscriber
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_SubscriberPackageHistories_SubscriberId_IsCurrent""
                ON ""SubscriberPackageHistories"" (""SubscriberId"") WHERE ""IsCurrent"";");

            // Wallet history per site, newest first
            migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_WalletTransactions_SiteId_CreatedAt""
                ON ""WalletTransactions"" (""SiteId"", ""CreatedAt"");");

            migrationBuilder.Sql(@"ANALYZE ""RadiusAccountingSessions""; ANALYZE ""RadiusAuthenticationLogs""; ANALYZE ""Subscribers"";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_RadiusAccountingSessions_NasId_AcctSessionId"";");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_RadiusAccountingSessions_NasId_IsActive"";");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_RadiusAuthenticationLogs_NasId_CreatedAt"";");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_Subscribers_MacAddress_Upper"";");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_SubscriberPackageHistories_SubscriberId_IsCurrent"";");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_WalletTransactions_SiteId_CreatedAt"";");
        }
    }
}
