using Microsoft.EntityFrameworkCore;
using RadiusSoftware.API.Security;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Services.Query;

/// <summary>One row of the subscriber list (only the columns the UI needs).</summary>
public class SubscriberRow
{
    public Guid Id { get; set; }
    public Guid SiteId { get; set; }
    public string? SiteName { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Service { get; set; } = string.Empty;
    [System.Text.Json.Serialization.JsonPropertyName("pppoeUsername")]
    public string PPPoEUsername { get; set; } = string.Empty;
    public string MacAddress { get; set; } = string.Empty;
    public string StaticIp { get; set; } = string.Empty;
    public Guid? PackageId { get; set; }
    public string? PackageName { get; set; }
    public decimal? PackagePrice { get; set; }
    public Guid? NasId { get; set; }
    public string? NasName { get; set; }
    public DateTime? ExpireDate { get; set; }
    public bool IsActive { get; set; }
    public bool ConnectionEnabled { get; set; }
    public bool IsOnline { get; set; }
    public string? LastAuthResult { get; set; }
    public string? LastAuthReason { get; set; }
    public DateTime? LastAuthAt { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>Suspended / Disabled / Expired / Online / WrongPassword / Active</summary>
    public string Status { get; set; } = "Active";
}

public static class SubscriberStatus
{
    public const string Suspended = "Suspended";
    public const string Disabled = "Disabled";
    public const string Expired = "Expired";
    public const string Online = "Online";
    public const string WrongPassword = "WrongPassword";
    public const string Active = "Active";

    public const string WrongPasswordReason = "Wrong Password.";
}

/// <summary>India day boundaries expressed in UTC (DB stores UTC).</summary>
public static class IstClock
{
    private static readonly TimeZoneInfo Ist = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata");

    public static DateTime NowIst => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Ist);

    /// <summary>UTC instant of 00:00 IST, <paramref name="addDays"/> days from today.</summary>
    public static DateTime DayStartUtc(int addDays = 0) =>
        DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeToUtc(NowIst.Date.AddDays(addDays), Ist), DateTimeKind.Utc);

    public static DateTime ToUtc(DateTime istLocalDate) =>
        DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(istLocalDate, DateTimeKind.Unspecified), Ist), DateTimeKind.Utc);

    public static DateTime ToIst(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Ist);
}

public class SubscriberListFilter
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
    public string? Search { get; set; }

    /// <summary>
    /// all, online, active, expired, suspended, disabled, wrongpassword,
    /// expiring-today, expiring-tomorrow, expiring-week, expired-month, no-package
    /// </summary>
    public string? Status { get; set; }
    public Guid? SiteId { get; set; }
    public Guid? NasId { get; set; }
    public Guid? PackageId { get; set; }
    public string? SortBy { get; set; }
    public string? SortDir { get; set; }
}

public interface ISubscriberQueryService
{
    Task<IQueryable<SubscriberRow>> RowsAsync();
    IQueryable<SubscriberRow> ApplyFilter(IQueryable<SubscriberRow> rows, SubscriberListFilter filter);
    IQueryable<SubscriberRow> ApplySort(IQueryable<SubscriberRow> rows, SubscriberListFilter filter);
}

public class SubscriberQueryService : ISubscriberQueryService
{
    /// <summary>A session without an accounting update for this long is treated as offline.</summary>
    public static readonly TimeSpan StaleSessionAfter = TimeSpan.FromMinutes(30);

    private readonly AppDbContext _db;
    private readonly ISiteAccessService _access;

    public SubscriberQueryService(AppDbContext db, ISiteAccessService access)
    {
        _db = db;
        _access = access;
    }

    public async Task<IQueryable<SubscriberRow>> RowsAsync()
    {
        var siteIds = await _access.GetAccessibleSiteIdsAsync();
        var now = DateTime.UtcNow;
        var staleCutoff = now - StaleSessionAfter;

        var subscribers = _db.Subscribers.AsNoTracking();
        if (siteIds != null)
        {
            var ids = siteIds.ToList();
            subscribers = subscribers.Where(s => ids.Contains(s.SiteId));
        }

        var withOnline =
            from s in subscribers
            select new
            {
                s,
                IsOnline = _db.RadiusAccountingSessions.Any(r =>
                    r.SubscriberId == s.Id &&
                    r.IsActive &&
                    (r.LastUpdateTime ?? r.StartTime ?? r.CreatedAt) >= staleCutoff)
            };

        return
            from x in withOnline
            join site in _db.Sites.AsNoTracking() on x.s.SiteId equals site.Id into siteJoin
            from site in siteJoin.DefaultIfEmpty()
            join pkg in _db.PackageProfiles.AsNoTracking() on x.s.PackageId equals pkg.Id into pkgJoin
            from pkg in pkgJoin.DefaultIfEmpty()
            join nas in _db.NasDevices.AsNoTracking() on x.s.NasId equals nas.Id into nasJoin
            from nas in nasJoin.DefaultIfEmpty()
            select new SubscriberRow
            {
                Id = x.s.Id,
                SiteId = x.s.SiteId,
                SiteName = site != null ? site.SiteName : null,
                FullName = x.s.FullName,
                Mobile = x.s.Mobile,
                Email = x.s.Email,
                Address = x.s.Address,
                City = x.s.City,
                Service = x.s.Service,
                PPPoEUsername = x.s.PPPoEUsername,
                MacAddress = x.s.MacAddress,
                StaticIp = x.s.StaticIp,
                PackageId = x.s.PackageId,
                PackageName = pkg != null ? pkg.PackageName : null,
                PackagePrice = pkg != null ? pkg.Price : null,
                NasId = x.s.NasId,
                NasName = nas != null ? nas.NasName : null,
                ExpireDate = x.s.ExpireDate,
                IsActive = x.s.IsActive,
                ConnectionEnabled = x.s.ConnectionEnabled,
                IsOnline = x.IsOnline,
                LastAuthResult = x.s.LastAuthResult,
                LastAuthReason = x.s.LastAuthReason,
                LastAuthAt = x.s.LastAuthAt,
                CreatedAt = x.s.CreatedAt,
                Status =
                    !x.s.IsActive ? SubscriberStatus.Suspended :
                    !x.s.ConnectionEnabled ? SubscriberStatus.Disabled :
                    x.s.ExpireDate != null && x.s.ExpireDate <= now ? SubscriberStatus.Expired :
                    x.IsOnline ? SubscriberStatus.Online :
                    x.s.LastAuthResult == "REJECT" && x.s.LastAuthReason == SubscriberStatus.WrongPasswordReason
                        ? SubscriberStatus.WrongPassword :
                    SubscriberStatus.Active
            };
    }

    public IQueryable<SubscriberRow> ApplyFilter(IQueryable<SubscriberRow> rows, SubscriberListFilter f)
    {
        if (f.SiteId.HasValue) rows = rows.Where(r => r.SiteId == f.SiteId.Value);
        if (f.NasId.HasValue) rows = rows.Where(r => r.NasId == f.NasId.Value);
        if (f.PackageId.HasValue) rows = rows.Where(r => r.PackageId == f.PackageId.Value);

        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            var term = $"%{f.Search.Trim()}%";
            rows = rows.Where(r =>
                EF.Functions.ILike(r.FullName, term) ||
                EF.Functions.ILike(r.PPPoEUsername, term) ||
                EF.Functions.ILike(r.Mobile, term) ||
                EF.Functions.ILike(r.Address, term) ||
                EF.Functions.ILike(r.MacAddress, term) ||
                EF.Functions.ILike(r.StaticIp, term) ||
                (r.PackageName != null && EF.Functions.ILike(r.PackageName, term)) ||
                (r.NasName != null && EF.Functions.ILike(r.NasName, term)));
        }

        var todayStart = IstClock.DayStartUtc(0);
        var tomorrowStart = IstClock.DayStartUtc(1);
        var dayAfterStart = IstClock.DayStartUtc(2);
        var weekEnd = IstClock.DayStartUtc(8);
        var monthStart = IstClock.ToUtc(new DateTime(IstClock.NowIst.Year, IstClock.NowIst.Month, 1));
        var now = DateTime.UtcNow;

        switch ((f.Status ?? "all").Trim().ToLowerInvariant())
        {
            case "online": rows = rows.Where(r => r.Status == SubscriberStatus.Online); break;
            case "active": rows = rows.Where(r => r.Status == SubscriberStatus.Active || r.Status == SubscriberStatus.Online || r.Status == SubscriberStatus.WrongPassword); break;
            case "offline": rows = rows.Where(r => r.Status == SubscriberStatus.Active || r.Status == SubscriberStatus.WrongPassword); break;
            case "expired": rows = rows.Where(r => r.Status == SubscriberStatus.Expired); break;
            case "suspended": rows = rows.Where(r => r.Status == SubscriberStatus.Suspended); break;
            case "disabled": rows = rows.Where(r => r.Status == SubscriberStatus.Disabled); break;
            case "wrongpassword": rows = rows.Where(r => r.Status == SubscriberStatus.WrongPassword); break;
            case "no-package": rows = rows.Where(r => r.PackageId == null); break;
            case "expiring-today":
                rows = rows.Where(r => r.ExpireDate >= todayStart && r.ExpireDate < tomorrowStart); break;
            case "expiring-tomorrow":
                rows = rows.Where(r => r.ExpireDate >= tomorrowStart && r.ExpireDate < dayAfterStart); break;
            case "expiring-week":
                rows = rows.Where(r => r.ExpireDate > now && r.ExpireDate < weekEnd); break;
            case "expired-month":
                rows = rows.Where(r => r.ExpireDate >= monthStart && r.ExpireDate <= now); break;
        }

        return rows;
    }

    public IQueryable<SubscriberRow> ApplySort(IQueryable<SubscriberRow> rows, SubscriberListFilter f)
    {
        var desc = !string.Equals(f.SortDir, "asc", StringComparison.OrdinalIgnoreCase);
        return (f.SortBy ?? "createdAt").ToLowerInvariant() switch
        {
            "name" => desc ? rows.OrderByDescending(r => r.FullName) : rows.OrderBy(r => r.FullName),
            "username" => desc ? rows.OrderByDescending(r => r.PPPoEUsername) : rows.OrderBy(r => r.PPPoEUsername),
            "expiredate" => desc ? rows.OrderByDescending(r => r.ExpireDate) : rows.OrderBy(r => r.ExpireDate),
            "package" => desc ? rows.OrderByDescending(r => r.PackageName) : rows.OrderBy(r => r.PackageName),
            "status" => desc ? rows.OrderByDescending(r => r.Status) : rows.OrderBy(r => r.Status),
            _ => desc ? rows.OrderByDescending(r => r.CreatedAt) : rows.OrderBy(r => r.CreatedAt),
        };
    }
}
