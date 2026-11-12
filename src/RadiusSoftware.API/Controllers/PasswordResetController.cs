using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Core.DTOs;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;
using System.Net;
using System.Net.Mail;

namespace RadiusSoftware.API.Controllers;

[Route("api/auth")]
[ApiController]
public class PasswordResetController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;

    public PasswordResetController(AppDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequestDto model)
    {
        if (model == null || string.IsNullOrEmpty(model.Email))
        {
            return BadRequest(new { message = "Please enter your email address." });
        }

        // Sirf Users table mein email check ho raha hai aur active user hona chahiye
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == model.Email && u.IsActive);

        if (user == null)
        {
            return BadRequest(new { message = "This email is not registered in our system." });
        }

        // Read Email Settings
        var mailSettings = _configuration.GetSection("EmailSettings");
        var senderEmail = mailSettings["Mail"];
        var senderPassword = mailSettings["Password"];
        var host = mailSettings["Host"];
        var portStr = mailSettings["Port"];

        if (string.IsNullOrEmpty(senderEmail) || string.IsNullOrEmpty(host))
        {
            return StatusCode(500, new { message = "Email server configuration is missing on the server." });
        }

        int port = string.IsNullOrEmpty(portStr) ? 465 : int.Parse(portStr);

        // Generate 6-digit random OTP
        var random = new Random();
        var otp = random.Next(100000, 999999).ToString();

        // Capture Device / IP Details
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
        var userAgent = Request.Headers["User-Agent"].ToString();

        // Save into PasswordResets table
        var passwordResetRecord = new PasswordReset
        {
            Email = model.Email,
            Otp = otp,
            IsUsed = false,
            ExpiryTime = DateTime.UtcNow.AddMinutes(10),
            IpAddress = ipAddress,
            UserAgent = string.IsNullOrEmpty(userAgent) ? "Unknown Device" : userAgent
        };

        _context.PasswordResets.Add(passwordResetRecord);
        await _context.SaveChangesAsync();

        try
        {
            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(senderEmail, senderPassword),
                EnableSsl = true,
                UseDefaultCredentials = false,
                Timeout = 15000 // 15 seconds timeout taaki request hang na ho
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(senderEmail, "Bharat Radius Software"),
                Subject = "Password Reset OTP - Bharat Radius Software",
                Body = $@"
            <div style='font-family: Arial, sans-serif; padding: 20px; color: #333;'>
                <h2 style='color: #2563eb;'>Radius Software</h2>
                <p>Hello <b>{user.FullName}</b>,</p>
                <p>You have requested to reset your password for your ISP Enterprise Portal account.</p>
                <div style='background: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 20px; font-weight: bold; letter-spacing: 2px; text-align: center; width: fit-content;'>
                    {otp}
                </div>
                <p style='margin-top: 15px;'>This OTP is valid for <b>10 minutes</b>.</p>
                <p style='color: #666; font-size: 12px;'>Request originated from IP: {ipAddress}</p>
                <hr style='border: none; border-top: 1px solid #eee;' />
                <p style='font-size: 12px; color: #aaa;'>If you did not request this, please ignore this email.</p>
            </div>",
                IsBodyHtml = true
            };
            mailMessage.To.Add(model.Email);

            await client.SendMailAsync(mailMessage);
            return Ok(new { message = "OTP sent successfully to your email." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Failed to send email. Check SMTP settings or network block. Details: {ex.Message}" });
        }
    }

    [HttpPost("verify-otp")]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequestDto model)
    {
        var resetRecord = await _context.PasswordResets
            .Where(r => r.Email == model.Email && !r.IsUsed)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync();

        if (resetRecord == null || resetRecord.ExpiryTime < DateTime.UtcNow)
        {
            return BadRequest(new { message = "OTP has expired or was not requested. Please try again." });
        }

        if (resetRecord.Otp != model.Otp)
        {
            return BadRequest(new { message = "Invalid OTP. Please enter the correct code." });
        }

        return Ok(new { message = "OTP Verified Successfully" });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequestDto model)
    {
        var resetRecord = await _context.PasswordResets
            .Where(r => r.Email == model.Email && !r.IsUsed)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync();

        if (resetRecord == null || resetRecord.ExpiryTime < DateTime.UtcNow || resetRecord.Otp != model.Otp)
        {
            return BadRequest(new { message = "Session expired or invalid OTP. Please restart the process." });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == model.Email && u.IsActive);
        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        // Update password in plain text format as requested
        user.PasswordHash = model.NewPassword;
        resetRecord.IsUsed = true;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Password changed successfully. You can now login." });
    }
}