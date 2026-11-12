namespace RadiusSoftware.Core.DTOs;

public class LoginRequestDto
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;

    /// <summary>Keep the user logged in for several days on this device.</summary>
    public bool RememberMe { get; set; }
}

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string OrgType { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public bool IsSuperAdmin { get; set; }
}