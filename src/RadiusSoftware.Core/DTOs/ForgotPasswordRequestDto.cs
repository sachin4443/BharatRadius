namespace RadiusSoftware.Core.DTOs;

public class ForgotPasswordRequestDto
{
    public string Email { get; set; } = string.Empty;
}

public class VerifyOtpRequestDto
{
    public string Email { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
}

public class ResetPasswordRequestDto
{
    public string Email { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}