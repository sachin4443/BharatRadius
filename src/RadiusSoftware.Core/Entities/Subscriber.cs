using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RadiusSoftware.Core.Entities;

public class Subscriber
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    // 1. Relations
    public Guid SiteId { get; set; }

    public Guid? NasId { get; set; }
    public Guid? PackageId { get; set; }

    // 2. Personal & Account Info
    public string SubscriberType { get; set; } = "Individual"; // Individual / Corporate
    public string FullName { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PortalUsername { get; set; } = string.Empty;
    public string PortalPassword { get; set; } = string.Empty;

    // 3. Address Details
    public string Address { get; set; } = string.Empty;
    public DateTime? ExpireDate { get; set; }

    public string Zip { get; set; } = string.Empty; // Pincode
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
    // 4. Billing Info
    public string GstNo { get; set; } = string.Empty;
    public string Comment { get; set; } = string.Empty;

    // 5. Technical Details (Merged for Authentication)
    public string Service { get; set; } = "PPPoE"; // PPPoE / Hotspot / Static
    public string PPPoEUsername { get; set; } = string.Empty;
    public string PPPoEPassword { get; set; } = string.Empty;
    public string MacAddress { get; set; } = string.Empty;
    public string StaticIp { get; set; } = string.Empty;

    public bool ConnectionEnabled { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}