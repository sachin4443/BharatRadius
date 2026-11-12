using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using RadiusSoftware.Infrastructure.Data;
using System.Net;
using System.Net.Mail;

public interface IEmailService
{
    Task SendSiteWelcomeEmailAsync(Guid targetId, string toEmail, string adminName, string username, string password, string siteName, string companyName, string siteDomain);
}

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger, IServiceScopeFactory scopeFactory)
    {
        _configuration = configuration;
        _logger = logger;
        _scopeFactory = scopeFactory;
    }

    public async Task SendSiteWelcomeEmailAsync(Guid targetId, string toEmail, string adminName, string username, string password, string siteName, string companyName, string siteDomain)
    {
        if (string.IsNullOrWhiteSpace(toEmail)) return;

        string subject = $"Welcome to Bharat Radius - {siteName} Created Successfully!";

        // 🎨 Professional HTML Email Template
        string htmlBody = $@"
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 0; }}
                .email-container {{ max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }}
                .email-header {{ background: linear-gradient(135deg, #1e3c72, #2a5298); color: #ffffff; padding: 30px; text-align: center; }}
                .email-header h1 {{ margin: 0; font-size: 24px; }}
                .email-body {{ padding: 30px; color: #333333; line-height: 1.6; }}
                .info-box {{ background: #f8f9fa; border-left: 4px solid #2a5298; padding: 15px 20px; margin: 20px 0; border-radius: 4px; }}
                .info-box p {{ margin: 8px 0; font-size: 15px; }}
                .credentials {{ background: #eef2f7; padding: 15px; border-radius: 6px; margin: 20px 0; }}
                .credentials span {{ font-weight: bold; color: #1e3c72; }}
                .email-footer {{ background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #777777; }}
            </style>
        </head>
        <body>
            <div class='email-container'>
                <div class='email-header'>
                    <h1>Bharat Radius Portal</h1>
                    <p style='margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;'>ISP Management & Billing System</p>
                </div>
                <div class='email-body'>
                    <p>Dear <strong>{adminName}</strong>,</p>
                    <p>Congratulations! Your new site has been successfully registered and configured on the Bharat Radius platform.</p>
                    
                    <div class='info-box'>
                        <p>🏢 <strong>Site Name:</strong> {siteName}</p>
                        <p>🏛️ <strong>Company:</strong> {(string.IsNullOrEmpty(companyName) ? "N/A" : companyName)}</p>
                        <p>🌐 <strong>Domain:</strong> {(string.IsNullOrEmpty(siteDomain) ? "N/A" : siteDomain)}</p>
                    </div>

                    <p>Here are your administrator login credentials to manage your site dashboard:</p>
                    
                    <div class='credentials'>
                        <p>👤 <strong>Username:</strong> {username}</p>
                        <p>🔑 <strong>Password:</strong> {password}</p>
                    </div>

                    <p>You can now log in to your portal using these details to manage your sub-admins, packages, and subscribers.</p>
                    <p style='margin-top: 30px;'>Best Regards,<br><strong>Team Bharat Radius</strong></p>
                </div>
                <div class='email-footer'>
                    &copy; {DateTime.Now.Year} Bharat Radius. All rights reserved. This is an automated notification.
                </div>
            </div>
        </body>
        </html>";

        string status = "Success";
        string errorMessage = string.Empty;

        try
        {
            var mail = _configuration["EmailSettings:Mail"];
            var pass = _configuration["EmailSettings:Password"];
            var host = _configuration["EmailSettings:Host"];
            var port = int.TryParse(_configuration["EmailSettings:Port"], out var p) ? p : 587;

            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(mail, pass),
                EnableSsl = true
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(mail!, "Bharat Radius"),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true // ✨ HTML Enabled
            };

            mailMessage.To.Add(toEmail);
            await client.SendMailAsync(mailMessage);
        }
        catch (Exception ex)
        {
            status = "Failed";
            errorMessage = ex.Message;
            _logger.LogError(ex, "Failed to send site welcome email to {Email}", toEmail);
        }

        // Database me Email Log save karna
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var emailLog = new EmailLog
            {
                Id = Guid.NewGuid(),
                SubscriberId = targetId,
                RecipientEmail = toEmail,
                Subject = subject,
                Status = status,
                ErrorMessage = errorMessage,
                SentAt = DateTime.UtcNow
            };

            context.EmailLogs.Add(emailLog);
            await context.SaveChangesAsync();
        }
        catch (Exception dbEx)
        {
            _logger.LogError(dbEx, "Failed to save email log into database.");
        }
    }
}