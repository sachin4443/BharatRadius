namespace RadiusSoftware.Core.DTOs
{
    public class AddChildWalletDto
    {
        public Guid SiteId { get; set; }

        public decimal Amount { get; set; }

        public string Description { get; set; } = string.Empty;
    }


    public class WalletBalanceDto
    {
        public Guid SiteId { get; set; }

        public decimal Balance { get; set; }
    }


    public class WalletRechargeDto
    {
        public Guid SubscriberId { get; set; }

        public Guid PackageId { get; set; }
    }
}