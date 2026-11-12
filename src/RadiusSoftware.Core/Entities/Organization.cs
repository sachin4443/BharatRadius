namespace RadiusSoftware.Core.Entities;

public class Organization
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public int Level { get; set; } = 1;
    public string Type { get; set; } = "ClientPortal";

    // Branding & General Info
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Domain { get; set; }
    public string? LogoUrl { get; set; }
    public string? FavIconUrl { get; set; }
    public string? PrimaryColor { get; set; } = "#0d6efd";
    public string? SecondaryColor { get; set; } = "#6c757d";
    public string? Currency { get; set; } = "INR";
    public string? Address { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<User> Users { get; set; } = new List<User>();
}