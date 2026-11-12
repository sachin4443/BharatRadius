using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RadiusSoftware.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeSubscriberMacAddresses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Data only (no schema change): store MAC addresses in one format
            // XX:XX:XX:XX:XX:XX so the RADIUS server can match Static IP / Hotspot
            // users that log in by MAC. Values that are not a MAC are left untouched.
            migrationBuilder.Sql(@"
UPDATE ""Subscribers""
SET ""MacAddress"" = UPPER(REGEXP_REPLACE(
        REGEXP_REPLACE(BTRIM(""MacAddress""), '[^0-9A-Fa-f]', '', 'g'),
        '(..)(..)(..)(..)(..)(..)', '\1:\2:\3:\4:\5:\6'))
WHERE ""MacAddress"" <> ''
  AND (BTRIM(""MacAddress"") ~* '^([0-9a-f]{2}[-:.]?){5}[0-9a-f]{2}$'
       OR BTRIM(""MacAddress"") ~* '^([0-9a-f]{4}\.){2}[0-9a-f]{4}$');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
