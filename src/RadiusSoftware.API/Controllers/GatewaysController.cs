using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.API.Security;
using RadiusSoftware.API.Services.Sms;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Controllers;

/// <summary>
/// Masters for SMS gateway and payment gateway API keys.
/// Only the super admin and L1 (organization / level-1 site) admins can manage them.
/// A config can be the organization default (no site) or for one particular site.
/// Secrets are write-only: they are never returned to the browser.
/// </summary>
[Authorize]
[Route("api/[controller]")]
[ApiController]
public class GatewaysController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ISiteAccessService _access;
    private readonly ISmsService _sms;

    public GatewaysController(AppDbContext db, ISiteAccessService access, ISmsService sms)
    {
        _db = db;
        _access = access;
        _sms = sms;
    }

    private bool IsL1OrAbove()
    {
        if (_access.IsSuperAdmin) return true;
        var level = User.FindFirst("Level")?.Value;
        return level is "L0" or "L1";
    }

    private Guid? UserOrganizationId =>
        Guid.TryParse(User.FindFirst("OrganizationId")?.Value, out var id) ? id : null;

    /// <summary>Works out the organization for a config and checks the user may manage it.</summary>
    private async Task<(Guid? orgId, IActionResult? error)> ResolveScopeAsync(Guid? siteId, Guid? requestedOrgId)
    {
        if (!IsL1OrAbove())
            return (null, StatusCode(403, new { message = "Only L1 admins can manage gateway settings." }));

        if (siteId.HasValue)
        {
            var site = await _db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == siteId && !s.IsDeleted);
            if (site == null) return (null, BadRequest(new { message = "Site not found." }));
            if (!await _access.CanAccessSiteAsync(site.Id))
                return (null, StatusCode(403, new { message = "You cannot manage this site." }));
            return (site.ParentOrganisationID, null);
        }

        if (_access.IsSuperAdmin)
        {
            var org = requestedOrgId ?? UserOrganizationId;
            if (org == null) return (null, BadRequest(new { message = "Please select an organization." }));
            return (org, null);
        }

        // Organization-wide default: only the organization admin (user without own site)
        var ownSite = await _access.GetOwnSiteAsync();
        if (ownSite != null && ownSite.SiteLevel > 0)
            return (null, BadRequest(new { message = "Please select a site." }));

        return (UserOrganizationId, null);
    }

    private async Task<IQueryable<T>> ScopeAsync<T>(IQueryable<T> q, Func<IQueryable<T>, List<Guid>, Guid?, IQueryable<T>> filter)
    {
        if (_access.IsSuperAdmin) return q;
        var ids = (await _access.GetAccessibleSiteIdsAsync())?.ToList() ?? new List<Guid>();
        var ownSite = await _access.GetOwnSiteAsync();
        // Org admins also see the organization default rows
        Guid? orgForDefaults = ownSite == null || ownSite.SiteLevel == 0 ? UserOrganizationId : null;
        return filter(q, ids, orgForDefaults);
    }

    private static string Mask(string? value) =>
        string.IsNullOrEmpty(value) ? "" : value.Length <= 6 ? "******" : value[..3] + new string('*', Math.Min(10, value.Length - 6)) + value[^3..];

    // =====================================================================
    // SMS GATEWAY
    // =====================================================================

    public class SmsConfigDto
    {
        public Guid? Id { get; set; }
        public Guid? OrganizationId { get; set; }
        public Guid? SiteId { get; set; }
        public string ProviderName { get; set; } = "Custom";
        public string ApiUrl { get; set; } = string.Empty;
        public string HttpMethod { get; set; } = "GET";
        public string? PostBodyTemplate { get; set; }
        public string? ContentType { get; set; }
        /// <summary>Leave empty to keep the saved key.</summary>
        public string? ApiKey { get; set; }
        public string? SenderId { get; set; }
        public string? SuccessKeyword { get; set; }
        public bool SendOnRecharge { get; set; } = true;
        public bool SendExpiryReminder { get; set; } = true;
        public int ReminderDaysBefore { get; set; } = 3;
        public bool SendOnExpiry { get; set; } = true;
        public string? RechargeTemplate { get; set; }
        public string? ReminderTemplate { get; set; }
        public string? ExpiredTemplate { get; set; }
        public string? RechargeTemplateId { get; set; }
        public string? ReminderTemplateId { get; set; }
        public string? ExpiredTemplateId { get; set; }
        public bool IsActive { get; set; } = true;
    }

    [HttpGet("sms")]
    public async Task<IActionResult> ListSms()
    {
        if (!IsL1OrAbove()) return StatusCode(403, new { message = "Only L1 admins can manage gateway settings." });

        var q = await ScopeAsync(_db.SmsGatewayConfigs.AsNoTracking(), (q, ids, org) =>
            q.Where(c => (c.SiteId != null && ids.Contains(c.SiteId.Value)) || (org != null && c.SiteId == null && c.OrganizationId == org)));

        var rows = await (
            from c in q
            join s in _db.Sites.AsNoTracking() on c.SiteId equals s.Id into sj
            from s in sj.DefaultIfEmpty()
            orderby c.CreatedAt descending
            select new { c, SiteName = s != null ? s.SiteName : null }).ToListAsync();

        return Ok(rows.Select(x => new
        {
            x.c.Id, x.c.OrganizationId, x.c.SiteId,
            siteName = x.SiteName ?? "All sites (default)",
            x.c.ProviderName, x.c.ApiUrl, x.c.HttpMethod, x.c.PostBodyTemplate, x.c.ContentType,
            hasApiKey = !string.IsNullOrEmpty(x.c.ApiKey),
            apiKeyMasked = Mask(x.c.ApiKey),
            x.c.SenderId, x.c.SuccessKeyword,
            x.c.SendOnRecharge, x.c.SendExpiryReminder, x.c.ReminderDaysBefore, x.c.SendOnExpiry,
            x.c.RechargeTemplate, x.c.ReminderTemplate, x.c.ExpiredTemplate,
            x.c.RechargeTemplateId, x.c.ReminderTemplateId, x.c.ExpiredTemplateId,
            x.c.IsActive, x.c.UpdatedAt
        }));
    }

    [HttpPost("sms")]
    public async Task<IActionResult> SaveSms([FromBody] SmsConfigDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ApiUrl) || !Uri.TryCreate(dto.ApiUrl.Replace("{", "").Replace("}", ""), UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
            return BadRequest(new { message = "Please enter a valid SMS API URL (http/https)." });

        var (orgId, error) = await ResolveScopeAsync(dto.SiteId, dto.OrganizationId);
        if (error != null) return error;

        SmsGatewayConfig? cfg;
        if (dto.Id.HasValue && dto.Id != Guid.Empty)
        {
            cfg = await _db.SmsGatewayConfigs.FirstOrDefaultAsync(c => c.Id == dto.Id);
            if (cfg == null) return NotFound(new { message = "SMS configuration not found." });
            var (_, oldError) = await ResolveScopeAsync(cfg.SiteId, cfg.OrganizationId);
            if (oldError != null) return oldError;
        }
        else
        {
            // One config per site / organization default
            cfg = await _db.SmsGatewayConfigs.FirstOrDefaultAsync(c => c.OrganizationId == orgId && c.SiteId == dto.SiteId);
            if (cfg == null)
            {
                cfg = new SmsGatewayConfig();
                _db.SmsGatewayConfigs.Add(cfg);
            }
        }

        var defaults = new SmsGatewayConfig();
        cfg.OrganizationId = orgId!.Value;
        cfg.SiteId = dto.SiteId;
        cfg.ProviderName = string.IsNullOrWhiteSpace(dto.ProviderName) ? "Custom" : dto.ProviderName.Trim();
        cfg.ApiUrl = dto.ApiUrl.Trim();
        cfg.HttpMethod = string.Equals(dto.HttpMethod, "POST", StringComparison.OrdinalIgnoreCase) ? "POST" : "GET";
        cfg.PostBodyTemplate = dto.PostBodyTemplate;
        cfg.ContentType = string.IsNullOrWhiteSpace(dto.ContentType) ? "application/json" : dto.ContentType.Trim();
        if (!string.IsNullOrWhiteSpace(dto.ApiKey)) cfg.ApiKey = dto.ApiKey.Trim();
        cfg.SenderId = dto.SenderId?.Trim();
        cfg.SuccessKeyword = dto.SuccessKeyword?.Trim();
        cfg.SendOnRecharge = dto.SendOnRecharge;
        cfg.SendExpiryReminder = dto.SendExpiryReminder;
        cfg.ReminderDaysBefore = Math.Clamp(dto.ReminderDaysBefore, 0, 30);
        cfg.SendOnExpiry = dto.SendOnExpiry;
        cfg.RechargeTemplate = string.IsNullOrWhiteSpace(dto.RechargeTemplate) ? defaults.RechargeTemplate : dto.RechargeTemplate.Trim();
        cfg.ReminderTemplate = string.IsNullOrWhiteSpace(dto.ReminderTemplate) ? defaults.ReminderTemplate : dto.ReminderTemplate.Trim();
        cfg.ExpiredTemplate = string.IsNullOrWhiteSpace(dto.ExpiredTemplate) ? defaults.ExpiredTemplate : dto.ExpiredTemplate.Trim();
        cfg.RechargeTemplateId = dto.RechargeTemplateId?.Trim();
        cfg.ReminderTemplateId = dto.ReminderTemplateId?.Trim();
        cfg.ExpiredTemplateId = dto.ExpiredTemplateId?.Trim();
        cfg.IsActive = dto.IsActive;
        cfg.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = "SMS gateway saved.", id = cfg.Id });
    }

    [HttpDelete("sms/{id:guid}")]
    public async Task<IActionResult> DeleteSms(Guid id)
    {
        var cfg = await _db.SmsGatewayConfigs.FirstOrDefaultAsync(c => c.Id == id);
        if (cfg == null) return NotFound();
        var (_, error) = await ResolveScopeAsync(cfg.SiteId, cfg.OrganizationId);
        if (error != null) return error;
        _db.SmsGatewayConfigs.Remove(cfg);
        await _db.SaveChangesAsync();
        return Ok(new { message = "SMS gateway deleted." });
    }

    public class TestSmsDto
    {
        public string Mobile { get; set; } = string.Empty;
        public string? Message { get; set; }
    }

    [HttpPost("sms/{id:guid}/test")]
    public async Task<IActionResult> TestSms(Guid id, [FromBody] TestSmsDto dto)
    {
        var cfg = await _db.SmsGatewayConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        if (cfg == null) return NotFound();
        var (_, error) = await ResolveScopeAsync(cfg.SiteId, cfg.OrganizationId);
        if (error != null) return error;

        var text = string.IsNullOrWhiteSpace(dto.Message) ? "Test SMS from Bharat Radius." : dto.Message!;
        var result = await _sms.SendAsync(cfg, dto.Mobile, text, cfg.RechargeTemplateId, "TEST", cfg.SiteId);
        return result.Success ? Ok(new { message = result.Message }) : BadRequest(new { message = result.Message });
    }

    [HttpGet("sms/logs")]
    public async Task<IActionResult> SmsLogs([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        if (!IsL1OrAbove()) return StatusCode(403, new { message = "Only L1 admins can view SMS logs." });
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 200);

        var q = await ScopeAsync(_db.SmsLogs.AsNoTracking(), (q, ids, _) =>
            q.Where(l => l.SiteId != null && ids.Contains(l.SiteId.Value)));

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(l => l.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new { items, total, page, pageSize });
    }

    // =====================================================================
    // PAYMENT GATEWAY
    // =====================================================================

    public static readonly string[] PaymentProviders =
        { "Razorpay", "PayU", "Cashfree", "PhonePe", "Paytm", "CCAvenue", "Instamojo", "Other" };

    public class PaymentConfigDto
    {
        public Guid? Id { get; set; }
        public Guid? OrganizationId { get; set; }
        public Guid? SiteId { get; set; }
        public string Provider { get; set; } = "Razorpay";
        public string? DisplayName { get; set; }
        public string Mode { get; set; } = "TEST";
        public string? MerchantId { get; set; }
        public string? ApiKey { get; set; }
        /// <summary>Leave empty to keep the saved secret.</summary>
        public string? ApiSecret { get; set; }
        /// <summary>Leave empty to keep the saved value.</summary>
        public string? SaltOrWebhookSecret { get; set; }
        public string? CallbackUrl { get; set; }
        public bool IsActive { get; set; } = true;
        public bool IsDefault { get; set; }
    }

    [HttpGet("payment/providers")]
    public IActionResult Providers() => Ok(PaymentProviders);

    [HttpGet("payment")]
    public async Task<IActionResult> ListPayment()
    {
        if (!IsL1OrAbove()) return StatusCode(403, new { message = "Only L1 admins can manage gateway settings." });

        var q = await ScopeAsync(_db.PaymentGatewayConfigs.AsNoTracking(), (q, ids, org) =>
            q.Where(c => (c.SiteId != null && ids.Contains(c.SiteId.Value)) || (org != null && c.SiteId == null && c.OrganizationId == org)));

        var rows = await (
            from c in q
            join s in _db.Sites.AsNoTracking() on c.SiteId equals s.Id into sj
            from s in sj.DefaultIfEmpty()
            orderby c.CreatedAt descending
            select new { c, SiteName = s != null ? s.SiteName : null }).ToListAsync();

        return Ok(rows.Select(x => new
        {
            x.c.Id, x.c.OrganizationId, x.c.SiteId,
            siteName = x.SiteName ?? "All sites (default)",
            x.c.Provider, x.c.DisplayName, x.c.Mode, x.c.MerchantId, x.c.ApiKey,
            hasApiSecret = !string.IsNullOrEmpty(x.c.ApiSecret),
            apiSecretMasked = Mask(x.c.ApiSecret),
            hasSalt = !string.IsNullOrEmpty(x.c.SaltOrWebhookSecret),
            x.c.CallbackUrl, x.c.IsActive, x.c.IsDefault, x.c.UpdatedAt
        }));
    }

    [HttpPost("payment")]
    public async Task<IActionResult> SavePayment([FromBody] PaymentConfigDto dto)
    {
        if (!PaymentProviders.Contains(dto.Provider))
            return BadRequest(new { message = "Unknown payment provider." });
        if (string.IsNullOrWhiteSpace(dto.ApiKey) && string.IsNullOrWhiteSpace(dto.MerchantId))
            return BadRequest(new { message = "Please enter the API key / merchant id." });

        var (orgId, error) = await ResolveScopeAsync(dto.SiteId, dto.OrganizationId);
        if (error != null) return error;

        PaymentGatewayConfig? cfg;
        if (dto.Id.HasValue && dto.Id != Guid.Empty)
        {
            cfg = await _db.PaymentGatewayConfigs.FirstOrDefaultAsync(c => c.Id == dto.Id);
            if (cfg == null) return NotFound(new { message = "Payment gateway not found." });
            var (_, oldError) = await ResolveScopeAsync(cfg.SiteId, cfg.OrganizationId);
            if (oldError != null) return oldError;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(dto.ApiSecret))
                return BadRequest(new { message = "Please enter the API secret." });
            cfg = new PaymentGatewayConfig();
            _db.PaymentGatewayConfigs.Add(cfg);
        }

        cfg.OrganizationId = orgId!.Value;
        cfg.SiteId = dto.SiteId;
        cfg.Provider = dto.Provider;
        cfg.DisplayName = string.IsNullOrWhiteSpace(dto.DisplayName) ? dto.Provider : dto.DisplayName.Trim();
        cfg.Mode = string.Equals(dto.Mode, "LIVE", StringComparison.OrdinalIgnoreCase) ? "LIVE" : "TEST";
        cfg.MerchantId = dto.MerchantId?.Trim();
        cfg.ApiKey = dto.ApiKey?.Trim();
        if (!string.IsNullOrWhiteSpace(dto.ApiSecret)) cfg.ApiSecret = dto.ApiSecret.Trim();
        if (!string.IsNullOrWhiteSpace(dto.SaltOrWebhookSecret)) cfg.SaltOrWebhookSecret = dto.SaltOrWebhookSecret.Trim();
        cfg.CallbackUrl = dto.CallbackUrl?.Trim();
        cfg.IsActive = dto.IsActive;
        cfg.IsDefault = dto.IsDefault;
        cfg.UpdatedAt = DateTime.UtcNow;

        // Only one default gateway per site / organization default
        if (cfg.IsDefault)
        {
            var others = await _db.PaymentGatewayConfigs
                .Where(c => c.Id != cfg.Id && c.OrganizationId == cfg.OrganizationId && c.SiteId == cfg.SiteId && c.IsDefault)
                .ToListAsync();
            foreach (var o in others) o.IsDefault = false;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Payment gateway saved.", id = cfg.Id });
    }

    [HttpDelete("payment/{id:guid}")]
    public async Task<IActionResult> DeletePayment(Guid id)
    {
        var cfg = await _db.PaymentGatewayConfigs.FirstOrDefaultAsync(c => c.Id == id);
        if (cfg == null) return NotFound();
        var (_, error) = await ResolveScopeAsync(cfg.SiteId, cfg.OrganizationId);
        if (error != null) return error;
        _db.PaymentGatewayConfigs.Remove(cfg);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Payment gateway deleted." });
    }
}
