using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RadiusSoftware.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNasRadiusConfiguration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAccountingConfigured",
                table: "NasDevices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsRadiusConfigured",
                table: "NasDevices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "RadiusConfigError",
                table: "NasDevices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RadiusConfiguredAt",
                table: "NasDevices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RadiusLastVerifiedAt",
                table: "NasDevices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RadiusStatus",
                table: "NasDevices",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsAccountingConfigured",
                table: "NasDevices");

            migrationBuilder.DropColumn(
                name: "IsRadiusConfigured",
                table: "NasDevices");

            migrationBuilder.DropColumn(
                name: "RadiusConfigError",
                table: "NasDevices");

            migrationBuilder.DropColumn(
                name: "RadiusConfiguredAt",
                table: "NasDevices");

            migrationBuilder.DropColumn(
                name: "RadiusLastVerifiedAt",
                table: "NasDevices");

            migrationBuilder.DropColumn(
                name: "RadiusStatus",
                table: "NasDevices");
        }
    }
}
