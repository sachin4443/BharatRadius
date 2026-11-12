using System.ComponentModel.DataAnnotations;

namespace RadiusSoftware.Core.Entities;

public class CAFDocument
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    // Kis subscriber ka document hai
    public Guid SubscriberId { get; set; }

    // Document type:
    // Aadhaar
    // PAN
    // DrivingLicence
    // Agreement
    public string DocumentType { get; set; } = string.Empty;

    // Original uploaded filename
    public string FileName { get; set; } = string.Empty;

    // Server par unique stored filename
    public string StoredFileName { get; set; } = string.Empty;

    // Public folder ke andar relative path
    public string RelativePath { get; set; } = string.Empty;

    // Upload time
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}