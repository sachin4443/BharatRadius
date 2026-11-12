public class PackageProfileDto
{
    public Guid Id { get; set; }

    public string PackageName { get; set; } = string.Empty;
    public string PlanCategory { get; set; } = "Unlimited";

    public decimal DownloadMbps { get; set; }
    public string DownloadUnit { get; set; } = "Mbps";

    public decimal UploadMbps { get; set; }
    public string UploadUnit { get; set; } = "Mbps";

    public decimal Price { get; set; }

    public int ExpiryDays { get; set; }
    public string ValidityType { get; set; } = "Days";

    public string Description { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}