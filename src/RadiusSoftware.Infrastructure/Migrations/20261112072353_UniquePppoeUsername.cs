using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RadiusSoftware.Infrastructure.Migrations
{
    /// <summary>
    /// Makes the PPPoE username unique (case-insensitive) across all subscribers.
    ///
    /// If the database already contains duplicate usernames this migration stops
    /// with an error listing them. Fix them first (see Database/check-duplicate-pppoe-usernames.sql)
    /// and run "dotnet ef database update" again. Nothing is changed or deleted automatically.
    /// </summary>
    public partial class UniquePppoeUsername : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
DECLARE dup_list TEXT;
BEGIN
    SELECT string_agg(u || ' (' || c || ' times)', ', ')
    INTO dup_list
    FROM (
        SELECT LOWER(""PPPoEUsername"") AS u, COUNT(*) AS c
        FROM ""Subscribers""
        WHERE ""PPPoEUsername"" <> ''
        GROUP BY LOWER(""PPPoEUsername"")
        HAVING COUNT(*) > 1
        ORDER BY 1
        LIMIT 50
    ) d;

    IF dup_list IS NOT NULL THEN
        RAISE EXCEPTION 'Duplicate PPPoE usernames found: %. Fix them (Database/check-duplicate-pppoe-usernames.sql) and run the migration again.', dup_list;
    END IF;
END $$;");

            migrationBuilder.Sql(@"
CREATE UNIQUE INDEX IF NOT EXISTS ""UX_Subscribers_PPPoEUsername_Lower""
ON ""Subscribers"" (LOWER(""PPPoEUsername""))
WHERE ""PPPoEUsername"" <> '';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""UX_Subscribers_PPPoEUsername_Lower"";");
        }
    }
}
