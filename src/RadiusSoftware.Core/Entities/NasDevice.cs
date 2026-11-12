using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RadiusSoftware.Core.Entities;

public class NasDevice
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    // Site Relationship
    public Guid SiteId { get; set; }

    [ForeignKey("SiteId")]
    public Site Site { get; set; } = null!;

    // NAS Information
    public string NasName { get; set; } = string.Empty;

    public string NasType { get; set; } = "MikroTik";

    public string NasIpAddress { get; set; } = string.Empty;

    // RADIUS Shared Secret
    public string SharedSecret { get; set; } = string.Empty;

    // CoA / Accounting
    public int CoaPort { get; set; } = 3799;

    public int InterimTime { get; set; } = 300;

    public bool IsEnabled { get; set; } = true;

    // MikroTik API Credentials
    public string ApiUsername { get; set; } = string.Empty;

    public string ApiPassword { get; set; } = string.Empty;

    public int ApiPort { get; set; } = 8728;

    public int WinboxPort { get; set; } = 8291;

    // Router Connectivity
    public bool IsOnline { get; set; } = false;

    public DateTime? LastSeen { get; set; }

    // RADIUS Configuration
    public bool IsRadiusConfigured { get; set; } = false;

    public bool IsAccountingConfigured { get; set; } = false;

    public string RadiusStatus { get; set; } = "NOT_CONFIGURED";

    public string? RadiusConfigError { get; set; }

    public DateTime? RadiusConfiguredAt { get; set; }

    public DateTime? RadiusLastVerifiedAt { get; set; }

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}