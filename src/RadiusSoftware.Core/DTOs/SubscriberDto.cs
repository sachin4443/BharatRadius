namespace RadiusSoftware.Core.DTOs;

public class SubscriberDto
{
    public Guid Id { get; set; }
    public Guid SiteId { get; set; }
    public Guid? NasId { get; set; }
    public Guid? PackageId { get; set; }
    public string SubscriberType { get; set; } = "Individual";
    public string FullName { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PortalUsername { get; set; } = string.Empty;
    public DateTime? ExpireDate { get; set; }
    public string PortalPassword { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Zip { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string GstNo { get; set; } = string.Empty;
    public string Comment { get; set; } = string.Empty;
    public string Service { get; set; } = "PPPoE";
    public string PPPoEUsername { get; set; } = string.Empty;
    public string PPPoEPassword { get; set; } = string.Empty;
    public string MacAddress { get; set; } = string.Empty;
    public string StaticIp { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}