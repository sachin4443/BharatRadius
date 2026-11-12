using System.ComponentModel.DataAnnotations;

namespace RadiusSoftware.Core.Entities;

public class CustomerApplicationForm
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    // Har CAF generation par unique 10-digit number
    public long CafNumber { get; set; }

    // Kis subscriber ka CAF hai
    public Guid SubscriberId { get; set; }

    // Subscriber ka SiteId
    public Guid SiteId { get; set; }

    // CAF generate hone ka time
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    // Generated PDF ka relative path
    public string PdfPath { get; set; } = string.Empty;
}