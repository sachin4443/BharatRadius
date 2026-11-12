using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RadiusSoftware.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRadiusAuthenticationAccounting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ConnectionEnabled",
                table: "Subscribers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "RadiusAccountingSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubscriberId = table.Column<Guid>(type: "uuid", nullable: true),
                    NasId = table.Column<Guid>(type: "uuid", nullable: true),
                    Username = table.Column<string>(type: "text", nullable: false),
                    AcctSessionId = table.Column<string>(type: "text", nullable: false),
                    AcctStatusType = table.Column<string>(type: "text", nullable: false),
                    AcctAuthentic = table.Column<string>(type: "text", nullable: true),
                    FramedIpAddress = table.Column<string>(type: "text", nullable: true),
                    CallingStationId = table.Column<string>(type: "text", nullable: true),
                    CalledStationId = table.Column<string>(type: "text", nullable: true),
                    NasIpAddress = table.Column<string>(type: "text", nullable: true),
                    NasPort = table.Column<string>(type: "text", nullable: true),
                    NasPortType = table.Column<string>(type: "text", nullable: true),
                    ServiceType = table.Column<string>(type: "text", nullable: true),
                    StartTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastUpdateTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StopTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SessionTime = table.Column<long>(type: "bigint", nullable: false),
                    InputOctets = table.Column<long>(type: "bigint", nullable: false),
                    OutputOctets = table.Column<long>(type: "bigint", nullable: false),
                    InputPackets = table.Column<long>(type: "bigint", nullable: false),
                    OutputPackets = table.Column<long>(type: "bigint", nullable: false),
                    TerminateCause = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusAccountingSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RadiusAuthenticationLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubscriberId = table.Column<Guid>(type: "uuid", nullable: true),
                    NasId = table.Column<Guid>(type: "uuid", nullable: true),
                    Username = table.Column<string>(type: "text", nullable: false),
                    Result = table.Column<string>(type: "text", nullable: false),
                    FailureReason = table.Column<string>(type: "text", nullable: true),
                    CallingStationId = table.Column<string>(type: "text", nullable: true),
                    FramedIpAddress = table.Column<string>(type: "text", nullable: true),
                    AcctSessionId = table.Column<string>(type: "text", nullable: true),
                    NasIpAddress = table.Column<string>(type: "text", nullable: true),
                    RadiusIdentifier = table.Column<int>(type: "integer", nullable: true),
                    AuthenticationMethod = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RadiusAuthenticationLogs", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RadiusAccountingSessions");

            migrationBuilder.DropTable(
                name: "RadiusAuthenticationLogs");

            migrationBuilder.DropColumn(
                name: "ConnectionEnabled",
                table: "Subscribers");
        }
    }
}
