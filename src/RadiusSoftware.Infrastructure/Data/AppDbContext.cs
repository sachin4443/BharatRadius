using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Core.Entities;

namespace RadiusSoftware.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Menu> Menus => Set<Menu>();
    public DbSet<RoleMenuPermission> RoleMenuPermissions => Set<RoleMenuPermission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<Site> Sites => Set<Site>();
    public DbSet<NasDevice> NasDevices => Set<NasDevice>();
    public DbSet<PackageProfile> PackageProfiles => Set<PackageProfile>();
    public DbSet<Subscriber> Subscribers => Set<Subscriber>();
    public DbSet<PasswordReset> PasswordResets => Set<PasswordReset>();
    public DbSet<RadiusAuthenticationLog> RadiusAuthenticationLogs => Set<RadiusAuthenticationLog>();
    public DbSet<RadiusAccountingSession> RadiusAccountingSessions => Set<RadiusAccountingSession>();
    public DbSet<SubscriberPackageHistory> SubscriberPackageHistories => Set<SubscriberPackageHistory>();
    public DbSet<SiteWallet> SiteWallets { get; set; }
    public DbSet<CustomerApplicationForm> CustomerApplicationForms { get; set; }
    public DbSet<EmailLog> EmailLogs { get; set; }
    public DbSet<CAFDocument> CAFDocuments { get; set; }
    public DbSet<WalletTransaction> WalletTransactions { get; set; }
    public DbSet<SmsGatewayConfig> SmsGatewayConfigs => Set<SmsGatewayConfig>();
    public DbSet<SmsLog> SmsLogs => Set<SmsLog>();
    public DbSet<PaymentGatewayConfig> PaymentGatewayConfigs => Set<PaymentGatewayConfig>();
    public DbSet<WalletTopup> WalletTopups => Set<WalletTopup>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Organization Code unique index configuration
        modelBuilder.Entity<Organization>()
            .HasIndex(o => o.Code)
            .IsUnique();

        // Organization to Users relationship (Cascade delete on organization removal)
        modelBuilder.Entity<User>()
            .HasOne(u => u.Organization)
            .WithMany(o => o.Users)
            .HasForeignKey(u => u.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<SiteWallet>()
    .HasIndex(x => x.SiteId)
    .IsUnique();

        modelBuilder.Entity<WalletTransaction>()
            .HasIndex(x => x.SiteId);

        modelBuilder.Entity<WalletTransaction>()
            .HasIndex(x => x.CreatedAt);

        modelBuilder.Entity<WalletTransaction>()
            .HasIndex(x => x.SubscriberId);
        modelBuilder.Entity<SiteWallet>()
    .HasOne(x => x.Site)
    .WithMany()
    .HasForeignKey(x => x.SiteId)
    .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<WalletTransaction>()
            .HasOne(x => x.Site)
            .WithMany()
            .HasForeignKey(x => x.SiteId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<WalletTransaction>()
            .HasOne(x => x.Subscriber)
            .WithMany()
            .HasForeignKey(x => x.SubscriberId)
            .OnDelete(DeleteBehavior.SetNull);

        // ---- Indexes for fast subscriber list / dashboard / reports ----
        modelBuilder.Entity<Subscriber>().HasIndex(x => x.SiteId);
        modelBuilder.Entity<Subscriber>().HasIndex(x => x.ExpireDate);
        modelBuilder.Entity<Subscriber>().HasIndex(x => x.PPPoEUsername);

        modelBuilder.Entity<RadiusAccountingSession>().HasIndex(x => new { x.SubscriberId, x.IsActive });
        modelBuilder.Entity<RadiusAuthenticationLog>().HasIndex(x => x.CreatedAt);
        modelBuilder.Entity<RadiusAuthenticationLog>().HasIndex(x => x.SubscriberId);

        modelBuilder.Entity<SubscriberPackageHistory>().HasIndex(x => x.SubscriberId);
        modelBuilder.Entity<SubscriberPackageHistory>().HasIndex(x => new { x.SiteId, x.CreatedAt });

        modelBuilder.Entity<SmsGatewayConfig>().HasIndex(x => new { x.OrganizationId, x.SiteId });
        modelBuilder.Entity<SmsLog>().HasIndex(x => x.CreatedAt);
        modelBuilder.Entity<SmsLog>().HasIndex(x => x.SubscriberId);
        modelBuilder.Entity<PaymentGatewayConfig>().HasIndex(x => new { x.OrganizationId, x.SiteId });

        // Online wallet top-ups: one row per gateway order
        modelBuilder.Entity<WalletTopup>().HasIndex(x => x.ProviderOrderId).IsUnique();
        modelBuilder.Entity<WalletTopup>().HasIndex(x => new { x.SiteId, x.CreatedAt });
    }
}