using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.API.Security;
using RadiusSoftware.API.Services.Query;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Controllers;

/// <summary>Live dashboard numbers, per-user widget config and the RADIUS auth log.</summary>
[Authorize]
[Route("api/[controller]")]
[ApiController]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ISiteAccessService _access;
    private readonly ISubscriberQueryService _subscribers;

    public DashboardController(AppDbContext db, ISiteAccessService access, ISubscriberQueryService subscribers)
    {
        _db = db;
        _access = access;
        _subscribers = subscribers;
    }

    private async Task<List<Guid>?> SiteIdsAsync() => (await _access.GetAccessibleSiteIdsAsync())?.ToList();

    // =========================================================
    // SUMMARY CARDS
    // GET api/Dashboard/summary?siteId=
    // =========================================================
    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] Guid? siteId)
    {
        if (siteId.HasValue && !await _access.CanAccessSiteAsync(siteId.Value)) return Forbid();

        var rows = await _subscribers.RowsAsync();
        if (siteId.HasValue) rows = rows.Where(r => r.SiteId == siteId.Value);

        var statusCounts = await rows.GroupBy(r => r.Status)
            .Select(g => new { g.Key, Count = g.Count() }).ToListAsync();
        int C(string s) => statusCounts.FirstOrDefault(x => x.Key == s)?.Count ?? 0;

        var now = DateTime.UtcNow;
        var today = IstClock.DayStartUtc(0);
        var tomorrow = IstClock.DayStartUtc(1);
        var dayAfter = IstClock.DayStartUtc(2);
        var weekEnd = IstClock.DayStartUtc(8);
        var yesterday = IstClock.DayStartUtc(-1);
        var ist = IstClock.NowIst;
        var monthStart = IstClock.ToUtc(new DateTime(ist.Year, ist.Month, 1));

        var expiringToday = await rows.CountAsync(r => r.ExpireDate >= now && r.ExpireDate < tomorrow);
        var expiringTomorrow = await rows.CountAsync(r => r.ExpireDate >= tomorrow && r.ExpireDate < dayAfter);
        var expiringWeek = await rows.CountAsync(r => r.ExpireDate > now && r.ExpireDate < weekEnd);
        var expiredThisMonth = await rows.CountAsync(r => r.ExpireDate >= monthStart && r.ExpireDate <= now);
        var newThisMonth = await rows.CountAsync(r => r.CreatedAt >= monthStart);
        var noPackage = await rows.CountAsync(r => r.PackageId == null);

        // Recharges (package history rows) of the visible subscribers
        var rechargeRows =
            from h in _db.SubscriberPackageHistories.AsNoTracking()
            join r in rows on h.SubscriberId equals r.Id
            select new { h.CreatedAt, Amount = h.AmountCharged > 0 ? h.AmountCharged : h.Price };

        var todayRecharge = await rechargeRows.Where(x => x.CreatedAt >= today)
            .GroupBy(_ => 1).Select(g => new { Count = g.Count(), Amount = g.Sum(x => x.Amount) }).FirstOrDefaultAsync();
        var yesterdayRecharge = await rechargeRows.Where(x => x.CreatedAt >= yesterday && x.CreatedAt < today)
            .GroupBy(_ => 1).Select(g => new { Count = g.Count(), Amount = g.Sum(x => x.Amount) }).FirstOrDefaultAsync();
        var monthRecharge = await rechargeRows.Where(x => x.CreatedAt >= monthStart)
            .GroupBy(_ => 1).Select(g => new { Count = g.Count(), Amount = g.Sum(x => x.Amount) }).FirstOrDefaultAsync();

        // Wallet balance of the logged-in site (or selected site)
        decimal? siteBalance = null;
        var walletSite = siteId ?? (await _access.GetOwnSiteAsync())?.Id;
        if (walletSite.HasValue)
        {
            siteBalance = await _db.SiteWallets.AsNoTracking()
                .Where(w => w.SiteId == walletSite).Select(w => (decimal?)w.Balance).FirstOrDefaultAsync() ?? 0;
        }

        // Login failures today
        var siteIds = await SiteIdsAsync();
        var authToday = _db.RadiusAuthenticationLogs.AsNoTracking().Where(l => l.CreatedAt >= today);
        if (siteIds != null || siteId.HasValue)
        {
            var allowed = siteId.HasValue ? new List<Guid> { siteId.Value } : siteIds!;
            authToday = authToday.Where(l => _db.NasDevices.Any(n => n.Id == l.NasId && allowed.Contains(n.SiteId)));
        }
        var rejectsToday = await authToday.CountAsync(l => l.Result == "REJECT");

        return Ok(new
        {
            generatedAt = now,
            totalSubscribers = statusCounts.Sum(x => x.Count),
            online = C(SubscriberStatus.Online),
            active = C(SubscriberStatus.Active) + C(SubscriberStatus.Online) + C(SubscriberStatus.WrongPassword),
            activeOffline = C(SubscriberStatus.Active) + C(SubscriberStatus.WrongPassword),
            expired = C(SubscriberStatus.Expired),
            suspended = C(SubscriberStatus.Suspended),
            disabled = C(SubscriberStatus.Disabled),
            wrongPassword = C(SubscriberStatus.WrongPassword),
            noPackage,
            expiringToday,
            expiringTomorrow,
            expiringWeek,
            expiredThisMonth,
            newThisMonth,
            pendingRecharge = C(SubscriberStatus.Expired) + expiringWeek,
            siteBalance,
            todayRechargeCount = todayRecharge?.Count ?? 0,
            todayRechargeAmount = todayRecharge?.Amount ?? 0,
            yesterdayRechargeCount = yesterdayRecharge?.Count ?? 0,
            yesterdayRechargeAmount = yesterdayRecharge?.Amount ?? 0,
            monthRechargeCount = monthRecharge?.Count ?? 0,
            monthRechargeAmount = monthRecharge?.Amount ?? 0,
            rejectsToday
        });
    }

    // =========================================================
    // ONLINE USERS PER NAS
    // =========================================================
    [HttpGet("live-by-nas")]
    public async Task<IActionResult> LiveByNas()
    {
        var rows = await _subscribers.RowsAsync();
        var siteIds = await SiteIdsAsync();

        var nasQuery = _db.NasDevices.AsNoTracking();
        if (siteIds != null) nasQuery = nasQuery.Where(n => siteIds.Contains(n.SiteId));

        var online = await rows.Where(r => r.Status == SubscriberStatus.Online && r.NasId != null)
            .GroupBy(r => r.NasId).Select(g => new { NasId = g.Key, Count = g.Count() }).ToListAsync();

        var nas = await nasQuery.Select(n => new { n.Id, n.NasName, n.NasIpAddress, n.IsOnline, n.DashboardInterfaces }).ToListAsync();

        return Ok(nas.Select(n => new
        {
            n.Id, n.NasName, n.NasIpAddress, n.IsOnline,
            dashboardInterfaces = (n.DashboardInterfaces ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            liveUsers = online.FirstOrDefault(o => o.NasId == n.Id)?.Count ?? 0
        }).OrderByDescending(n => n.liveUsers));
    }

    // =========================================================
    // RADIUS AUTHENTICATION LOG
    // GET api/Dashboard/auth-logs?result=REJECT&search=&page=1
    // =========================================================
    [HttpGet("auth-logs")]
    public async Task<IActionResult> AuthLogs(
        [FromQuery] string? result,
        [FromQuery] string? search,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] Guid? nasId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 5, 200);

        var siteIds = await SiteIdsAsync();
        var q =
            from l in _db.RadiusAuthenticationLogs.AsNoTracking()
            join n in _db.NasDevices.AsNoTracking() on l.NasId equals n.Id into nj
            from n in nj.DefaultIfEmpty()
            join s in _db.Subscribers.AsNoTracking() on l.SubscriberId equals s.Id into sj
            from s in sj.DefaultIfEmpty()
            select new { l, NasName = n != null ? n.NasName : null, NasSiteId = n != null ? (Guid?)n.SiteId : null, FullName = s != null ? s.FullName : null };

        if (siteIds != null) q = q.Where(x => x.NasSiteId != null && siteIds.Contains(x.NasSiteId.Value));
        if (!string.IsNullOrWhiteSpace(result)) q = q.Where(x => x.l.Result == result.ToUpper());
        if (nasId.HasValue) q = q.Where(x => x.l.NasId == nasId);
        if (from.HasValue) { var f = IstClock.ToUtc(from.Value.Date); q = q.Where(x => x.l.CreatedAt >= f); }
        if (to.HasValue) { var t = IstClock.ToUtc(to.Value.Date.AddDays(1)); q = q.Where(x => x.l.CreatedAt < t); }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            q = q.Where(x => EF.Functions.ILike(x.l.Username, term) ||
                             (x.l.CallingStationId != null && EF.Functions.ILike(x.l.CallingStationId, term)) ||
                             (x.l.FailureReason != null && EF.Functions.ILike(x.l.FailureReason, term)) ||
                             (x.FullName != null && EF.Functions.ILike(x.FullName, term)));
        }

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(x => x.l.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new
            {
                x.l.Id,
                x.l.SubscriberId,
                x.l.Username,
                fullName = x.FullName,
                x.l.Result,
                message = x.l.Result == "ACCEPT" ? "Login successful" : x.l.FailureReason,
                macAddress = x.l.CallingStationId,
                ipAddress = x.l.FramedIpAddress,
                nasName = x.NasName,
                x.l.NasIpAddress,
                x.l.CreatedAt
            }).ToListAsync();

        // Counts for the filter chips
        var todayStart = IstClock.DayStartUtc(0);
        var todayQ = _db.RadiusAuthenticationLogs.AsNoTracking().Where(l => l.CreatedAt >= todayStart);
        if (siteIds != null) todayQ = todayQ.Where(l => _db.NasDevices.Any(n => n.Id == l.NasId && siteIds.Contains(n.SiteId)));
        var today = await todayQ.GroupBy(l => l.Result).Select(g => new { g.Key, Count = g.Count() }).ToListAsync();

        return Ok(new
        {
            items,
            total,
            page,
            pageSize,
            todayAccept = today.FirstOrDefault(t => t.Key == "ACCEPT")?.Count ?? 0,
            todayReject = today.FirstOrDefault(t => t.Key == "REJECT")?.Count ?? 0
        });
    }

    // =========================================================
    // PER-USER WIDGET CONFIG
    // =========================================================
    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var userId = _access.CurrentUserId;
        var json = await _db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.DashboardConfigJson).FirstOrDefaultAsync();
        if (string.IsNullOrWhiteSpace(json)) return Ok(new { widgets = (string[]?)null });
        try
        {
            return Ok(new { widgets = JsonSerializer.Deserialize<string[]>(json) });
        }
        catch
        {
            return Ok(new { widgets = (string[]?)null });
        }
    }

    public class DashboardConfigDto
    {
        public List<string> Widgets { get; set; } = new();
    }

    [HttpPut("config")]
    public async Task<IActionResult> SaveConfig([FromBody] DashboardConfigDto dto)
    {
        var userId = _access.CurrentUserId;
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return Unauthorized();

        var widgets = (dto.Widgets ?? new List<string>())
            .Where(w => !string.IsNullOrWhiteSpace(w) && w.Length <= 50)
            .Distinct().Take(100).ToList();
        user.DashboardConfigJson = JsonSerializer.Serialize(widgets);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Dashboard settings saved.", widgets });
    }
}
