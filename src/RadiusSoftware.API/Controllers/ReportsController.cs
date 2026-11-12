using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.API.Security;
using RadiusSoftware.API.Services.Query;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Controllers;

/// <summary>
/// Reports: recharges (day / month wise), expired users, pending recharges,
/// package wise sales and recharge list. All dates are India time.
/// </summary>
[Authorize]
[Route("api/[controller]")]
[ApiController]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ISiteAccessService _access;
    private readonly ISubscriberQueryService _subscribers;

    public ReportsController(AppDbContext db, ISiteAccessService access, ISubscriberQueryService subscribers)
    {
        _db = db;
        _access = access;
        _subscribers = subscribers;
    }

    public class ReportFilter
    {
        /// <summary>IST date, default: first day of this month</summary>
        public DateTime? From { get; set; }
        /// <summary>IST date (inclusive), default: today</summary>
        public DateTime? To { get; set; }
        public Guid? SiteId { get; set; }
        public Guid? PackageId { get; set; }
        /// <summary>day or month</summary>
        public string? GroupBy { get; set; }
        public string? Search { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 50;
    }

    private (DateTime fromIst, DateTime toIst, DateTime fromUtc, DateTime toUtcExclusive) Range(ReportFilter f)
    {
        var nowIst = IstClock.NowIst;
        var fromIst = (f.From ?? new DateTime(nowIst.Year, nowIst.Month, 1)).Date;
        var toIst = (f.To ?? nowIst).Date;
        if (toIst < fromIst) (fromIst, toIst) = (toIst, fromIst);
        if ((toIst - fromIst).TotalDays > 731) fromIst = toIst.AddDays(-731);
        return (fromIst, toIst, IstClock.ToUtc(fromIst), IstClock.ToUtc(toIst.AddDays(1)));
    }

    private async Task<IQueryable<SubscriberRow>> ScopedSubscribersAsync(ReportFilter f)
    {
        if (f.SiteId.HasValue && !await _access.CanAccessSiteAsync(f.SiteId.Value))
            return Enumerable.Empty<SubscriberRow>().AsQueryable();
        var rows = await _subscribers.RowsAsync();
        if (f.SiteId.HasValue) rows = rows.Where(r => r.SiteId == f.SiteId.Value);
        return rows;
    }

    private class RechargeItem
    {
        public Guid Id { get; set; }
        public Guid SubscriberId { get; set; }
        public string Username { get; set; } = "";
        public string FullName { get; set; } = "";
        public string Mobile { get; set; } = "";
        public string? SiteName { get; set; }
        public Guid? PackageId { get; set; }
        public string PackageName { get; set; } = "";
        public int Quantity { get; set; }
        public decimal Amount { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string Action { get; set; } = "";
        public string? CreatedByName { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    private IQueryable<RechargeItem> RechargeQuery(IQueryable<SubscriberRow> subs) =>
        from h in _db.SubscriberPackageHistories.AsNoTracking()
        join s in subs on h.SubscriberId equals s.Id
        select new RechargeItem
        {
            Id = h.Id,
            SubscriberId = s.Id,
            Username = s.PPPoEUsername,
            FullName = s.FullName,
            Mobile = s.Mobile,
            SiteName = s.SiteName,
            PackageId = h.PackageId,
            PackageName = h.PackageName,
            Quantity = h.Quantity < 1 ? 1 : h.Quantity,
            Amount = h.AmountCharged > 0 ? h.AmountCharged : h.Price,
            StartDate = h.StartDate ?? h.AssignedAt,
            EndDate = h.EndDate ?? h.EndedAt,
            Action = h.Action,
            CreatedByName = h.CreatedByName,
            CreatedAt = h.CreatedAt
        };

    // =========================================================
    // OVERVIEW: totals + day/month wise table
    // GET api/Reports/overview?from=2026-11-01&to=2026-11-30&groupBy=day
    // =========================================================
    [HttpGet("overview")]
    public async Task<IActionResult> Overview([FromQuery] ReportFilter f)
    {
        var (fromIst, toIst, fromUtc, toUtc) = Range(f);
        var subs = await ScopedSubscribersAsync(f);
        var now = DateTime.UtcNow;

        var recharges = await RechargeQuery(subs)
            .Where(r => r.CreatedAt >= fromUtc && r.CreatedAt < toUtc)
            .Select(r => new { r.CreatedAt, r.Amount, r.SubscriberId })
            .ToListAsync();

        var expired = await subs
            .Where(s => s.ExpireDate >= fromUtc && s.ExpireDate < toUtc && s.ExpireDate <= now)
            .Select(s => new { s.ExpireDate, s.Id })
            .ToListAsync();

        var created = await subs
            .Where(s => s.CreatedAt >= fromUtc && s.CreatedAt < toUtc)
            .Select(s => s.CreatedAt)
            .ToListAsync();

        // Users whose package expired in the range and have NOT recharged since
        var pendingNow = await subs.CountAsync(s => s.Status == SubscriberStatus.Expired);
        var expiringNext7 = await subs.CountAsync(s => s.ExpireDate > now && s.ExpireDate < IstClock.DayStartUtc(8));

        var byMonth = string.Equals(f.GroupBy, "month", StringComparison.OrdinalIgnoreCase);
        string Key(DateTime utc)
        {
            var d = IstClock.ToIst(utc);
            return byMonth ? d.ToString("yyyy-MM") : d.ToString("yyyy-MM-dd");
        }

        var keys = new List<string>();
        if (byMonth)
        {
            for (var d = new DateTime(fromIst.Year, fromIst.Month, 1); d <= toIst; d = d.AddMonths(1))
                keys.Add(d.ToString("yyyy-MM"));
        }
        else
        {
            for (var d = fromIst; d <= toIst; d = d.AddDays(1))
                keys.Add(d.ToString("yyyy-MM-dd"));
        }

        var rGroups = recharges.GroupBy(r => Key(r.CreatedAt)).ToDictionary(g => g.Key, g => (Count: g.Count(), Amount: g.Sum(x => x.Amount)));
        var eGroups = expired.GroupBy(e => Key(e.ExpireDate!.Value)).ToDictionary(g => g.Key, g => g.Count());
        var nGroups = created.GroupBy(Key).ToDictionary(g => g.Key, g => g.Count());

        var rows = keys.Select(k => new
        {
            period = k,
            rechargeCount = rGroups.TryGetValue(k, out var r) ? r.Count : 0,
            rechargeAmount = rGroups.TryGetValue(k, out var r2) ? r2.Amount : 0,
            expiredCount = eGroups.TryGetValue(k, out var e) ? e : 0,
            newSubscribers = nGroups.TryGetValue(k, out var n) ? n : 0
        }).ToList();

        return Ok(new
        {
            from = fromIst.ToString("yyyy-MM-dd"),
            to = toIst.ToString("yyyy-MM-dd"),
            groupBy = byMonth ? "month" : "day",
            totals = new
            {
                rechargeCount = recharges.Count,
                rechargeAmount = recharges.Sum(r => r.Amount),
                uniqueSubscribersRecharged = recharges.Select(r => r.SubscriberId).Distinct().Count(),
                expiredCount = expired.Count,
                expiredNotRenewed = pendingNow,
                expiringNext7Days = expiringNext7,
                pendingRecharges = pendingNow + expiringNext7,
                newSubscribers = created.Count
            },
            rows
        });
    }

    // =========================================================
    // RECHARGE LIST (+ CSV)
    // =========================================================
    [HttpGet("recharges")]
    public async Task<IActionResult> Recharges([FromQuery] ReportFilter f, [FromQuery] bool csv = false)
    {
        var (_, _, fromUtc, toUtc) = Range(f);
        var subs = await ScopedSubscribersAsync(f);

        var q = RechargeQuery(subs).Where(r => r.CreatedAt >= fromUtc && r.CreatedAt < toUtc);
        if (f.PackageId.HasValue) q = q.Where(r => r.PackageId == f.PackageId);
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            var term = $"%{f.Search.Trim()}%";
            q = q.Where(r => EF.Functions.ILike(r.Username, term) || EF.Functions.ILike(r.FullName, term) || EF.Functions.ILike(r.Mobile, term));
        }

        q = q.OrderByDescending(r => r.CreatedAt);

        if (csv)
        {
            var all = await q.Take(100_000).ToListAsync();
            var sb = new System.Text.StringBuilder();
            sb.AppendLine("Date (IST),Username,Full Name,Mobile,Site,Package,Qty,Amount,Start Date,End Date,Type,By");
            static string C(string? v)
            {
                v ??= "";
                if (v.Length > 0 && "=+-@".Contains(v[0])) v = "'" + v;
                return "\"" + v.Replace("\"", "\"\"") + "\"";
            }
            foreach (var r in all)
            {
                sb.AppendLine(string.Join(",",
                    C(IstClock.ToIst(r.CreatedAt).ToString("yyyy-MM-dd HH:mm")), C(r.Username), C(r.FullName), C(r.Mobile),
                    C(r.SiteName), C(r.PackageName), r.Quantity, r.Amount.ToString("0.00"),
                    C(r.StartDate.HasValue ? IstClock.ToIst(r.StartDate.Value).ToString("yyyy-MM-dd") : ""),
                    C(r.EndDate.HasValue ? IstClock.ToIst(r.EndDate.Value).ToString("yyyy-MM-dd") : ""),
                    C(r.Action), C(r.CreatedByName)));
            }
            var bytes = System.Text.Encoding.UTF8.GetPreamble().Concat(System.Text.Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
            return File(bytes, "text/csv", $"recharges-{DateTime.UtcNow:yyyyMMdd}.csv");
        }

        var page = Math.Max(1, f.Page);
        var pageSize = Math.Clamp(f.PageSize, 10, 500);
        var total = await q.CountAsync();
        var amount = await q.SumAsync(r => (decimal?)r.Amount) ?? 0;
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new { items, total, totalAmount = amount, page, pageSize });
    }

    // =========================================================
    // PACKAGE WISE SALES
    // =========================================================
    [HttpGet("package-sales")]
    public async Task<IActionResult> PackageSales([FromQuery] ReportFilter f)
    {
        var (_, _, fromUtc, toUtc) = Range(f);
        var subs = await ScopedSubscribersAsync(f);

        var rows = await RechargeQuery(subs)
            .Where(r => r.CreatedAt >= fromUtc && r.CreatedAt < toUtc)
            .GroupBy(r => r.PackageName)
            .Select(g => new
            {
                packageName = g.Key,
                count = g.Count(),
                quantity = g.Sum(x => x.Quantity),
                amount = g.Sum(x => x.Amount)
            })
            .OrderByDescending(x => x.amount)
            .ToListAsync();

        // Current active subscribers per package
        var activePerPackage = await subs
            .Where(s => s.Status != SubscriberStatus.Expired && s.PackageName != null)
            .GroupBy(s => s.PackageName!)
            .Select(g => new { packageName = g.Key, activeSubscribers = g.Count() })
            .ToListAsync();

        return Ok(new { rows, activePerPackage });
    }
}
