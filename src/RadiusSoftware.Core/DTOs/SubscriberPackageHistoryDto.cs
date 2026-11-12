namespace RadiusSoftware.Core.DTOs;

public class SubscriberPackageHistoryDto
{
    public Guid Id { get; set; }

    public Guid SubscriberId { get; set; }

    public Guid? PackageId { get; set; }

    public string PackageName { get; set; } = string.Empty;

    public decimal DownloadMbps { get; set; }

    public decimal UploadMbps { get; set; }

    public decimal Price { get; set; }

    public int ValidityDays { get; set; }

    public string Action { get; set; } = string.Empty;

    public DateTime AssignedAt { get; set; }

    public DateTime? EndedAt { get; set; }

    public bool IsCurrent { get; set; }

    public string? Comment { get; set; }

    // Recharge period
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int Quantity { get; set; } = 1;
    public decimal AmountCharged { get; set; }
    public string? CreatedByName { get; set; }
}
