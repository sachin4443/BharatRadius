using System.ComponentModel.DataAnnotations;

namespace RadiusSoftware.Core.Entities;

public class SubscriberPackageHistory
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid SubscriberId { get; set; }

    public Guid? PackageId { get; set; }

    // Snapshot — package delete/change hone par bhi history safe rahe
    public string PackageName { get; set; } = string.Empty;

    public decimal DownloadMbps { get; set; }

    public decimal UploadMbps { get; set; }

    public decimal Price { get; set; }

    public int ValidityDays { get; set; }

    public string Action { get; set; } = "ASSIGNED";
    // ASSIGNED / CHANGED / RENEWED / REMOVED / EXPIRED

    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    public DateTime? EndedAt { get; set; }

    public bool IsCurrent { get; set; } = true;

    public string? Comment { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}