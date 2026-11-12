using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace RadiusSoftware.Core.Entities;

/// <summary>
/// SMS gateway settings. Most Indian SMS providers use a simple HTTP URL, so the
/// URL (and optional POST body) is stored as a template with placeholders:
/// {mobile}, {message}, {senderid}, {apikey}, {templateid}
///
/// SiteId = null means "default for the whole organization"; a site uses its own
/// config first, then the nearest parent site's, then the organization default.
/// </summary>
public class SmsGatewayConfig
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid? SiteId { get; set; }

    [MaxLength(100)]
    public string ProviderName { get; set; } = "Custom";
    [MaxLength(1000)]
    public string ApiUrl { get; set; } = string.Empty;
    [MaxLength(10)]
    public string HttpMethod { get; set; } = "GET";
    public string? PostBodyTemplate { get; set; }
    [MaxLength(100)]
    public string? ContentType { get; set; } = "application/json";

    [JsonIgnore]
    [MaxLength(500)]
    public string? ApiKey { get; set; }
    [MaxLength(50)]
    public string? SenderId { get; set; }
    /// <summary>Text the provider returns on success (empty = HTTP 2xx is enough).</summary>
    [MaxLength(200)]
    public string? SuccessKeyword { get; set; }

    // When to send
    public bool SendOnRecharge { get; set; } = true;
    public bool SendExpiryReminder { get; set; } = true;
    public int ReminderDaysBefore { get; set; } = 3;
    public bool SendOnExpiry { get; set; } = true;

    // Message templates. Placeholders: {name} {username} {package} {expiry} {amount} {company}
    [MaxLength(1000)]
    public string RechargeTemplate { get; set; } =
        "Dear {name}, your internet account {username} is recharged with {package}. Valid till {expiry}. - {company}";
    [MaxLength(1000)]
    public string ReminderTemplate { get; set; } =
        "Dear {name}, your internet plan {package} for {username} will expire on {expiry}. Please recharge to avoid disconnection. - {company}";
    [MaxLength(1000)]
    public string ExpiredTemplate { get; set; } =
        "Dear {name}, your internet plan for {username} has expired on {expiry}. Please recharge to continue. - {company}";

    // DLT template ids (India)
    [MaxLength(50)] public string? RechargeTemplateId { get; set; }
    [MaxLength(50)] public string? ReminderTemplateId { get; set; }
    [MaxLength(50)] public string? ExpiredTemplateId { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class SmsLog
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? SiteId { get; set; }
    public Guid? SubscriberId { get; set; }
    [MaxLength(20)]
    public string Mobile { get; set; } = string.Empty;
    [MaxLength(1000)]
    public string Message { get; set; } = string.Empty;
    /// <summary>RECHARGE / REMINDER / EXPIRED / TEST / MANUAL</summary>
    [MaxLength(20)]
    public string Purpose { get; set; } = "MANUAL";
    /// <summary>SENT / FAILED</summary>
    [MaxLength(20)]
    public string Status { get; set; } = "SENT";
    [MaxLength(1000)]
    public string? ProviderResponse { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Online payment gateway keys (Razorpay, PayU, Cashfree, PhonePe, ...), set by the
/// L1 / organization admin for the organization or for a particular site.
/// Secrets are never sent back to the browser.
/// </summary>
public class PaymentGatewayConfig
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid? SiteId { get; set; }

    [MaxLength(50)]
    public string Provider { get; set; } = "Razorpay";
    [MaxLength(100)]
    public string DisplayName { get; set; } = string.Empty;
    /// <summary>TEST or LIVE</summary>
    [MaxLength(10)]
    public string Mode { get; set; } = "TEST";

    [MaxLength(200)]
    public string? MerchantId { get; set; }
    [MaxLength(500)]
    public string? ApiKey { get; set; }
    [JsonIgnore]
    [MaxLength(500)]
    public string? ApiSecret { get; set; }
    [JsonIgnore]
    [MaxLength(500)]
    public string? SaltOrWebhookSecret { get; set; }
    [MaxLength(500)]
    public string? CallbackUrl { get; set; }

    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
