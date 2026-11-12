namespace RadiusSoftware.Core.DTOs;

public class CreateSiteDto
{
    public string SiteName { get; set; } = string.Empty;
    public string SiteEmail { get; set; } = string.Empty;
    public string? SiteDomain { get; set; }
    public string SiteMobileNo { get; set; } = string.Empty;
    public bool UseOwnDomain { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string? CompanyTagline { get; set; }
    public string SiteAddress { get; set; } = string.Empty;
    public string? SiteDescription { get; set; }
    public string State { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Zip { get; set; } = string.Empty;
    public string BusinessType { get; set; } = string.Empty;
    public string CurrencyId { get; set; } = string.Empty;
    public string TimeZone { get; set; } = string.Empty;

    // Admin Info
    public string AdminFullName { get; set; } = string.Empty;
    public string AdminUsername { get; set; } = string.Empty;
    public string AdminEmail { get; set; } = string.Empty;
    public string AdminMobile { get; set; } = string.Empty;
    public string AdminPassword { get; set; } = string.Empty;

    // ✨ Checkbox se aane wali permitted menus ki list
    public List<Guid> MenuIds { get; set; } = new();
}