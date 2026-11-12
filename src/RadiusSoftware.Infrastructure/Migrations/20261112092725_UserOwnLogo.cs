using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RadiusSoftware.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UserOwnLogo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Every user (organization admin, each site admin) gets their own logo.
            migrationBuilder.Sql(@"ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""LogoUrl"" text;");

            // Organization admins keep the logo they uploaded before (it was stored on the company)
            migrationBuilder.Sql(@"
UPDATE ""Users"" u
SET ""LogoUrl"" = o.""LogoUrl""
FROM ""Organizations"" o
WHERE u.""OrganizationId"" = o.""Id""
  AND u.""LogoUrl"" IS NULL
  AND o.""LogoUrl"" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ""Sites"" s WHERE s.""UserId"" = u.""Id"");");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LogoUrl",
                table: "Users");
        }
    }
}
