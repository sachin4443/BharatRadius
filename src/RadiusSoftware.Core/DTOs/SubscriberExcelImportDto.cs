namespace RadiusSoftware.Core.DTOs;

public class SubscriberExcelImportDto
{
    // NAS
    public string? NasId { get; set; }
    public string? NasName { get; set; }

    // PACKAGE
    public string? PackageId { get; set; }
    public string? PackageName { get; set; }

    // PERSONAL
    public string? SubscriberType { get; set; }
    public string? FullName { get; set; }
    public string? CompanyName { get; set; }
    public string? Mobile { get; set; }
    public string? Email { get; set; }

    // PORTAL
    public string? PortalUsername { get; set; }
    public string? PortalPassword { get; set; }

    // ADDRESS
    public string? Address { get; set; }
    public string? Zip { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? PhotoUrl { get; set; }

    // BILLING
    public string? GstNo { get; set; }
    public string? Comment { get; set; }

    // TECHNICAL
    public string? Service { get; set; }
    public string? PPPoEUsername { get; set; }
    public string? PPPoEPassword { get; set; }
    public string? MacAddress { get; set; }
    public string? StaticIp { get; set; }

    // STATUS
    public string? ConnectionEnabled { get; set; }
    public string? IsActive { get; set; }
}