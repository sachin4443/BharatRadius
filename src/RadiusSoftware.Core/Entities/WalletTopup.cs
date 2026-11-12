using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RadiusSoftware.Core.Entities;

/// <summary>
/// An online payment made by a site (L2 / L3 ...) to add money to its own wallet.
/// The wallet is credited only once, after the payment gateway has confirmed
/// the payment (signature check or webhook).
/// </summary>
public class WalletTopup
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Site whose wallet is credited.</summary>
    public Guid SiteId { get; set; }

    /// <summary>Panel user who started the payment.</summary>
    public Guid? UserId { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal Amount { get; set; }

    [MaxLength(10)]
    public string Currency { get; set; } = "INR";

    [MaxLength(50)]
    public string Provider { get; set; } = "Razorpay";

    /// <summary>Gateway account (set by L1) that received the money.</summary>
    public Guid? PaymentGatewayConfigId { get; set; }

    [MaxLength(100)]
    public string ProviderOrderId { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? ProviderPaymentId { get; set; }

    /// <summary>upi / card / netbanking / wallet ... as reported by the gateway.</summary>
    [MaxLength(50)]
    public string? PaymentMethod { get; set; }

    /// <summary>CREATED → PAID, or FAILED.</summary>
    [MaxLength(20)]
    public string Status { get; set; } = "CREATED";

    [MaxLength(300)]
    public string? FailureReason { get; set; }

    public Guid? WalletTransactionId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
