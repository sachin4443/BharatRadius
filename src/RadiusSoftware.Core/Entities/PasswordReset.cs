namespace RadiusSoftware.Core.Entities;

public class PasswordReset
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
    public bool IsUsed { get; set; } = false;
    public DateTime ExpiryTime { get; set; }
    public string IpAddress { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}