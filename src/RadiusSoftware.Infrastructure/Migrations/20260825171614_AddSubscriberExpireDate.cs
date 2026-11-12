using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RadiusSoftware.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriberExpireDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ExpireDate",
                table: "Subscribers",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExpireDate",
                table: "Subscribers");
        }
    }
}
