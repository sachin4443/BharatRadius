namespace RadiusSoftware.Core.DTOs;

public class OrganizationCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Domain { get; set; }
    public string? Address { get; set; }
    public string Currency { get; set; } = "INR";
    public string? LogoUrl { get; set; }
    public string? PrimaryColor { get; set; } = "#0d6efd";
    public string? SecondaryColor { get; set; } = "#6c757d";

    // Admin Details
    public string AdminFullName { get; set; } = string.Empty;
    public string AdminUsername { get; set; } = string.Empty;
    public string AdminEmail { get; set; } = string.Empty;
    public string AdminMobile { get; set; } = string.Empty;
    public string AdminPassword { get; set; } = string.Empty;
}

public class OrganizationUpdateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Domain { get; set; }
    public string? Address { get; set; }
    public string Currency { get; set; } = "INR";
    public string? LogoUrl { get; set; }
    public string? PrimaryColor { get; set; }
    public string? SecondaryColor { get; set; }
    public string? NewPassword { get; set; }
}