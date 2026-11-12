using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RadiusSoftware.Core.Entities
{
    public class WalletTransaction
    {
        [Key]
        public Guid Id { get; set; }

        // Jis site ke wallet me transaction hua
        public Guid SiteId { get; set; }

        // Parent L2 site - child ko balance dete waqt
        public Guid? FromSiteId { get; set; }

        // Child site - balance receive karte waqt
        public Guid? ToSiteId { get; set; }

        // Subscriber recharge ke case me
        public Guid? SubscriberId { get; set; }

        // Package/recharge ke case me
        public Guid? PackageId { get; set; }

        [Required]
        [MaxLength(30)]
        public string TransactionType { get; set; } = string.Empty;
        // CREDIT
        // DEBIT

        [Column(TypeName = "numeric(18,2)")]
        public decimal Amount { get; set; }

        [Column(TypeName = "numeric(18,2)")]
        public decimal BalanceBefore { get; set; }

        [Column(TypeName = "numeric(18,2)")]
        public decimal BalanceAfter { get; set; }

        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        public virtual Site? Site { get; set; }
        public virtual Subscriber? Subscriber { get; set; }
    }
}