using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.API.Services.Query;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Services.Sms;

public record SmsSendResult(bool Success, string Message);

public interface ISmsService
{
    /// <summary>Site's own config, else nearest parent site's, else the organization default.</summary>
    Task<SmsGatewayConfig?> ResolveConfigAsync(Guid siteId);

    Task<SmsSendResult> SendAsync(
        SmsGatewayConfig config,
        string mobile,
        string message,
        string? templateId,
        string purpose,
        Guid? siteId = null,
        Guid? subscriberId = null);

    /// <summary>Fills {name} {username} {package} {expiry} {amount} {company} in a template.</summary>
    string Render(string template, Subscriber subscriber, string? packageName, DateTime? expiryUtc, decimal? amount, string? company);

    /// <summary>Sends the "recharge done" SMS if the site has SMS enabled. Never throws.</summary>
    Task TrySendRechargeSmsAsync(Subscriber subscriber, string packageName, DateTime expiryUtc, decimal amount);
}

public class SmsService : ISmsService
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<SmsService> _logger;

    public SmsService(AppDbContext db, IHttpClientFactory httpFactory, ILogger<SmsService> logger)
    {
        _db = db;
        _httpFactory = httpFactory;
        _logger = logger;
    }

    public async Task<SmsGatewayConfig?> ResolveConfigAsync(Guid siteId)
    {
        var visited = new HashSet<Guid>();
        Guid? current = siteId;
        Guid orgId = Guid.Empty;

        while (current.HasValue && visited.Add(current.Value))
        {
            var site = await _db.Sites.AsNoTracking()
                .Where(s => s.Id == current.Value)
                .Select(s => new { s.Id, s.ParentSiteId, s.ParentOrganisationID })
                .FirstOrDefaultAsync();
            if (site == null) break;

            orgId = site.ParentOrganisationID;

            var cfg = await _db.SmsGatewayConfigs.AsNoTracking()
                .FirstOrDefaultAsync(c => c.SiteId == site.Id && c.IsActive);
            if (cfg != null) return cfg;

            current = site.ParentSiteId;
        }

        if (orgId == Guid.Empty) return null;

        return await _db.SmsGatewayConfigs.AsNoTracking()
            .FirstOrDefaultAsync(c => c.OrganizationId == orgId && c.SiteId == null && c.IsActive);
    }

    public string Render(string template, Subscriber subscriber, string? packageName, DateTime? expiryUtc, decimal? amount, string? company)
    {
        var expiry = expiryUtc.HasValue ? IstClock.ToIst(expiryUtc.Value).ToString("dd-MM-yyyy") : "";
        return (template ?? string.Empty)
            .Replace("{name}", string.IsNullOrWhiteSpace(subscriber.FullName) ? subscriber.PPPoEUsername : subscriber.FullName)
            .Replace("{username}", subscriber.PPPoEUsername)
            .Replace("{package}", packageName ?? "")
            .Replace("{expiry}", expiry)
            .Replace("{amount}", amount.HasValue ? amount.Value.ToString("0.##") : "")
            .Replace("{company}", company ?? "");
    }

    public async Task<SmsSendResult> SendAsync(
        SmsGatewayConfig config,
        string mobile,
        string message,
        string? templateId,
        string purpose,
        Guid? siteId = null,
        Guid? subscriberId = null)
    {
        mobile = new string((mobile ?? "").Where(char.IsDigit).ToArray());
        if (mobile.Length == 12 && mobile.StartsWith("91")) mobile = mobile[2..];

        SmsSendResult result;

        if (mobile.Length < 10)
        {
            result = new SmsSendResult(false, "Invalid mobile number.");
        }
        else if (string.IsNullOrWhiteSpace(config.ApiUrl))
        {
            result = new SmsSendResult(false, "SMS API URL is not configured.");
        }
        else
        {
            try
            {
                string Fill(string text, Func<string, string> encode) => text
                    .Replace("{mobile}", encode(mobile))
                    .Replace("{message}", encode(message))
                    .Replace("{senderid}", encode(config.SenderId ?? ""))
                    .Replace("{apikey}", encode(config.ApiKey ?? ""))
                    .Replace("{templateid}", encode(templateId ?? ""));

                var url = Fill(config.ApiUrl, WebUtility.UrlEncode);
                var client = _httpFactory.CreateClient("sms");
                HttpResponseMessage response;

                if (string.Equals(config.HttpMethod, "POST", StringComparison.OrdinalIgnoreCase))
                {
                    var contentType = string.IsNullOrWhiteSpace(config.ContentType) ? "application/json" : config.ContentType;
                    Func<string, string> bodyEncode = contentType.Contains("json", StringComparison.OrdinalIgnoreCase)
                        ? v => JsonEncodedText.Encode(v).ToString()
                        : WebUtility.UrlEncode;
                    var body = Fill(config.PostBodyTemplate ?? "", bodyEncode);
                    response = await client.PostAsync(url, new StringContent(body, Encoding.UTF8, contentType));
                }
                else
                {
                    response = await client.GetAsync(url);
                }

                var text = await response.Content.ReadAsStringAsync();
                if (text.Length > 900) text = text[..900];

                var ok = response.IsSuccessStatusCode &&
                         (string.IsNullOrWhiteSpace(config.SuccessKeyword) ||
                          text.Contains(config.SuccessKeyword, StringComparison.OrdinalIgnoreCase));

                result = new SmsSendResult(ok, ok ? "SMS sent." : $"Provider replied HTTP {(int)response.StatusCode}: {text}");
                if (!ok) _logger.LogWarning("SMS to {Mobile} failed: {Reply}", mobile, text);

                _db.SmsLogs.Add(new SmsLog
                {
                    SiteId = siteId,
                    SubscriberId = subscriberId,
                    Mobile = mobile,
                    Message = message.Length > 1000 ? message[..1000] : message,
                    Purpose = purpose,
                    Status = ok ? "SENT" : "FAILED",
                    ProviderResponse = text
                });
                await _db.SaveChangesAsync();
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "SMS sending failed");
                result = new SmsSendResult(false, "SMS sending failed: " + ex.Message);
            }
        }

        _db.SmsLogs.Add(new SmsLog
        {
            SiteId = siteId,
            SubscriberId = subscriberId,
            Mobile = mobile,
            Message = message.Length > 1000 ? message[..1000] : message,
            Purpose = purpose,
            Status = "FAILED",
            ProviderResponse = result.Message
        });
        await _db.SaveChangesAsync();
        return result;
    }

    public async Task TrySendRechargeSmsAsync(Subscriber subscriber, string packageName, DateTime expiryUtc, decimal amount)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(subscriber.Mobile)) return;
            var cfg = await ResolveConfigAsync(subscriber.SiteId);
            if (cfg == null || !cfg.SendOnRecharge) return;

            var company = await _db.Sites.AsNoTracking().Where(s => s.Id == subscriber.SiteId)
                .Select(s => s.CompanyName != "" ? s.CompanyName : s.SiteName).FirstOrDefaultAsync();

            var text = Render(cfg.RechargeTemplate, subscriber, packageName, expiryUtc, amount, company);
            await SendAsync(cfg, subscriber.Mobile, text, cfg.RechargeTemplateId, "RECHARGE", subscriber.SiteId, subscriber.Id);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Recharge SMS could not be sent for {Username}", subscriber.PPPoEUsername);
        }
    }
}

/// <summary>
/// Every hour: sends "expiring soon" reminders and "expired" messages.
/// Each subscriber gets each message only once per expiry date (checked in SmsLogs).
/// </summary>
public class SmsReminderService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SmsReminderService> _logger;

    public SmsReminderService(IServiceScopeFactory scopeFactory, ILogger<SmsReminderService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var hour = IstClock.NowIst.Hour;
                // Only send between 9 AM and 8 PM IST
                if (hour >= 9 && hour < 20)
                {
                    await RunOnceAsync(stoppingToken);
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SMS reminder run failed.");
            }

            try { await Task.Delay(TimeSpan.FromHours(1), stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var sms = scope.ServiceProvider.GetRequiredService<ISmsService>();

        var configs = await db.SmsGatewayConfigs.AsNoTracking().Where(c => c.IsActive).ToListAsync(ct);
        if (configs.Count == 0) return;

        var now = DateTime.UtcNow;
        var maxDays = Math.Clamp(configs.Max(c => c.ReminderDaysBefore), 0, 30);
        var windowEnd = IstClock.DayStartUtc(maxDays + 1);
        var expiredSince = IstClock.DayStartUtc(-1);

        var candidates = await (
            from s in db.Subscribers.AsNoTracking()
            where s.ExpireDate != null && s.Mobile != "" && s.IsActive &&
                  s.ExpireDate >= expiredSince && s.ExpireDate < windowEnd
            join p in db.PackageProfiles.AsNoTracking() on s.PackageId equals p.Id into pj
            from p in pj.DefaultIfEmpty()
            join site in db.Sites.AsNoTracking() on s.SiteId equals site.Id
            select new { Sub = s, PackageName = p != null ? p.PackageName : "", Company = site.CompanyName != "" ? site.CompanyName : site.SiteName }
        ).ToListAsync(ct);

        var configCache = new Dictionary<Guid, SmsGatewayConfig?>();

        foreach (var c in candidates)
        {
            if (!configCache.TryGetValue(c.Sub.SiteId, out var cfg))
            {
                cfg = await sms.ResolveConfigAsync(c.Sub.SiteId);
                configCache[c.Sub.SiteId] = cfg;
            }
            if (cfg == null) continue;

            var expiry = c.Sub.ExpireDate!.Value;
            string? purpose = null;
            string? template = null;
            string? templateId = null;

            if (expiry <= now)
            {
                if (cfg.SendOnExpiry) { purpose = "EXPIRED"; template = cfg.ExpiredTemplate; templateId = cfg.ExpiredTemplateId; }
            }
            else if (cfg.SendExpiryReminder && expiry < IstClock.DayStartUtc(cfg.ReminderDaysBefore + 1))
            {
                purpose = "REMINDER"; template = cfg.ReminderTemplate; templateId = cfg.ReminderTemplateId;
            }

            if (purpose == null) continue;

            // Send each message only once for this expiry date
            var since = purpose == "EXPIRED"
                ? expiry.AddMinutes(-1)
                : expiry.AddDays(-(cfg.ReminderDaysBefore + 1));
            var alreadySent = await db.SmsLogs.AsNoTracking().AnyAsync(l =>
                l.SubscriberId == c.Sub.Id && l.Purpose == purpose && l.CreatedAt >= since, ct);
            if (alreadySent) continue;

            var text = sms.Render(template!, c.Sub, c.PackageName, expiry, null, c.Company);
            await sms.SendAsync(cfg, c.Sub.Mobile, text, templateId, purpose, c.Sub.SiteId, c.Sub.Id);
        }
    }
}
