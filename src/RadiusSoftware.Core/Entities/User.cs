namespace RadiusSoftware.Core.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Organization Organization { get; set; } = null!;

    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    [System.Text.Json.Serialization.JsonIgnore]
    public string PasswordHash { get; set; } = string.Empty;

    public bool IsSuperAdmin { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>JSON list of dashboard widgets this user wants to see.</summary>
    public string? DashboardConfigJson { get; set; }

    /// <summary>Logo / profile picture uploaded by this user (shown in the sidebar and header).</summary>
    public string? LogoUrl { get; set; }

    // 👇 YEH NAYI PROPERTIES ADD KARNI HAIN 👇
    public Guid? RoleId { get; set; }
    public Role? Role { get; set; }
}