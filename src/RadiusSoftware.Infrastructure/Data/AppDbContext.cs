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
    }
}