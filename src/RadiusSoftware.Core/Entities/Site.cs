using System.ComponentModel.DataAnnotations;

namespace RadiusSoftware.Core.Entities;

public class Site
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ParentOrganisationID { get; set; }
    public Organization ParentOrganisation { get; set; } = null!;

    public Guid? ParentSiteId { get; set; }
    public int? ParentSiteMsrNumber { get; set; } // ✨ Integer column for Parent MSR

    public int SiteLevel { get; set; } = 1;       // ✨ Level 1 under Org, Level 2 under Site 1, etc.
    public int SiteMsrNumber { get; set; }       // ✨ Auto-increment global Site ID (1, 2, 3...)

    public string SiteName { get; set; } = string.Empty;
    public string SiteEmail { get; set; } = string.Empty;
    public string? SiteDomain { get; set; }
    public string SiteMobileNo { get; set; } = string.Empty;
    public bool UseOwnDomain { get; set; } = false;

    public string CompanyName { get; set; } = string.Empty;
    public string? CompanyTagline { get; set; }
    public string SiteAddress { get; set; } = string.Empty;
    public string? SiteDescription { get; set; }

    public string State { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Zip { get; set; } = string.Empty;

    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }

    public string BusinessType { get; set; } = "Non Reseller";
    public string CurrencyId { get; set; } = "INR";
    public string TimeZone { get; set; } = "IST";

    public bool IsSubscriberLimit { get; set; } = false;
    public int? LicenseDays { get; set; }
    public bool IsDefaultSite { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; } = false;

    public int Level { get; set; } = 1;

    public DateTime AddDate { get; set; } = DateTime.UtcNow;
    public DateTime LastUpdate { get; set; } = DateTime.UtcNow;

    public Guid? UserId { get; set; }
    public User? User { get; set; }
}