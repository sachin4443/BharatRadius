using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RadiusSoftware.Core.Entities;

public class PackageProfile
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid SiteId { get; set; }
    [ForeignKey("SiteId")]
    public Site Site { get; set; } = null!;

    public string PackageName { get; set; } = string.Empty;
    public string PlanCategory { get; set; } = "Unlimited";

    public decimal DownloadMbps { get; set; }
    public string DownloadUnit { get; set; } = "Mbps";

    public decimal UploadMbps { get; set; }
    public string UploadUnit { get; set; } = "Mbps";

    public decimal Price { get; set; }

    public int ExpiryDays { get; set; } // Validity Duration
    public string ValidityType { get; set; } = "Days";

    public string Description { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}