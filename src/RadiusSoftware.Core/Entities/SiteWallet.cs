using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RadiusSoftware.Core.Entities
{
    public class SiteWallet
    {
        [Key]
        public Guid Id { get; set; }

        public Guid SiteId { get; set; }

        [Column(TypeName = "numeric(18,2)")]
        public decimal Balance { get; set; } = 0;

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public virtual Site? Site { get; set; }
    }
}