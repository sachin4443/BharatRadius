using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.API.Security;
using RadiusSoftware.API.Services.MikroTik;
using RadiusSoftware.API.Services.Query;
using RadiusSoftware.API.Services.Billing;
using Microsoft.Extensions.Caching.Memory;
using RadiusSoftware.API.Services.Sms;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Controllers;

/// <summary>
/// Subscriber recharge / renewal / package change.
///
///  - Active subscriber (expiry in the future): the new period starts at the current
///    expiry, so paid days are never lost ("advance recharge").
///    Expired subscriber: the new period starts now. (ExpiryCalculator)
///  - Quantity buys several periods at once (e.g. 3 x 1 month).
///  - Amount = package price x quantity, deducted from the paying site's wallet.
///    The wallet row is locked (SELECT ... FOR UPDATE) so double clicks or two
///    operators at the same time can never double-charge or overdraw it.
/// </summary>
[Authorize]
[SiteScoped(ScopedResource.Subscriber, "subscriberId")]
[Route("api/[controller]")]
[ApiController]
public class RechargeController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ISiteAccessService _access;
    private readonly IMikroTikService _mikroTik;
    private readonly ISmsService _sms;
    private readonly ILogger<RechargeController> _logger;
    private readonly IMemoryCache _cache;

    public RechargeController(
        AppDbContext db,
        ISiteAccessService access,
        IMikroTikService mikroTik,
        ISmsService sms,
        ILogger<RechargeController> logger,
        IMemoryCache cache)
    {
        _cache = cache;
        _db = db;
        _access = access;
        _mikroTik = mikroTik;
        _sms = sms;
        _logger = logger;
    }

    public class RechargeRequest
    {
        public Guid PackageId { get; set; }
        public int Quantity { get; set; } = 1;
        /// <summary>"auto" (default), "now" or "expiry"</summary>
        public string? StartFrom { get; set; }
        public string? Comment { get; set; }
        /// <summary>
        /// Unique id created by the browser for one recharge click. The same id is
        /// processed only once (double click / network retry protection).
        /// </summary>
        public Guid? RequestId { get; set; }
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<Guid, byte> RunningRequests = new();

    /// <summary>Site whose wallet pays: the logged-in user's own site, else the subscriber's site.</summary>
    private async Task<Guid> PayingSiteIdAsync(Subscriber sub)
    {
        var own = await _access.GetOwnSiteAsync();
        return own?.Id ?? sub.SiteId;
    }

    // =========================================================
    // PREVIEW (shown in the recharge popup before confirming)
    // GET api/Recharge/{subscriberId}/preview?packageId=..&quantity=1
    // =========================================================
    [HttpGet("{subscriberId:guid}/preview")]
    public async Task<IActionResult> Preview(Guid subscriberId, [FromQuery] Guid packageId, [FromQuery] int quantity = 1, [FromQuery] string? startFrom = null)
    {
        var sub = await _db.Subscribers.AsNoTracking().FirstOrDefaultAsync(s => s.Id == subscriberId);
        if (sub == null) return NotFound(new { message = "Subscriber not found." });

        var package = await _db.PackageProfiles.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == packageId && p.SiteId == sub.SiteId && p.IsActive);
        if (package == null) return BadRequest(new { message = "Package is not available for this subscriber's site." });

        quantity = Math.Clamp(quantity, 1, ExpiryCalculator.MaxQuantity);
        var now = DateTime.UtcNow;
        var start = ExpiryCalculator.RechargeStart(sub.ExpireDate, now, startFrom);
        var end = ExpiryCalculator.AddValidity(start, package, quantity);
        var amount = package.Price * quantity;

        var payingSite = await PayingSiteIdAsync(sub);
        var balance = await _db.SiteWallets.AsNoTracking()
            .Where(w => w.SiteId == payingSite).Select(w => (decimal?)w.Balance).FirstOrDefaultAsync() ?? 0;

        return Ok(new
        {
            username = sub.PPPoEUsername,
            currentPackageId = sub.PackageId,
            currentExpiry = sub.ExpireDate,
            packageId = package.Id,
            packageName = package.PackageName,
            downloadMbps = package.DownloadMbps,
            uploadMbps = package.UploadMbps,
            price = package.Price,
            validity = ExpiryCalculator.Describe(package),
            isActive = sub.ExpireDate.HasValue && sub.ExpireDate.Value > now,
            quantity,
            startDate = start,
            endDate = end,
            amount,
            walletBalance = balance,
            balanceAfter = balance - amount,
            sufficientBalance = balance >= amount
        });
    }

    // =========================================================
    // RECHARGE
    // POST api/Recharge/{subscriberId}
    // =========================================================
    [HttpPost("{subscriberId:guid}")]
    public async Task<IActionResult> Recharge(Guid subscriberId, [FromBody] RechargeRequest request)
    {
        if (request == null || request.PackageId == Guid.Empty)
            return BadRequest(new { success = false, message = "Please select a package." });

        var quantity = Math.Clamp(request.Quantity, 1, ExpiryCalculator.MaxQuantity);

        // Duplicate protection: the same click is never charged twice
        if (request.RequestId.HasValue)
        {
            var doneKey = $"recharge-done:{request.RequestId}";
            if (_cache.TryGetValue(doneKey, out object? previous) && previous != null)
                return Ok(previous);
            if (!RunningRequests.TryAdd(request.RequestId.Value, 0))
                return Conflict(new { success = false, message = "This recharge is already being processed." });
        }

        try
        {
            var result = await ProcessRechargeAsync(subscriberId, request, quantity);
            if (request.RequestId.HasValue && result is OkObjectResult ok && ok.Value != null)
                _cache.Set($"recharge-done:{request.RequestId}", ok.Value, TimeSpan.FromMinutes(30));
            return result;
        }
        finally
        {
            if (request.RequestId.HasValue) RunningRequests.TryRemove(request.RequestId.Value, out _);
        }
    }

    private async Task<IActionResult> ProcessRechargeAsync(Guid subscriberId, RechargeRequest request, int quantity)
    {

        var sub = await _db.Subscribers.FirstOrDefaultAsync(s => s.Id == subscriberId);
        if (sub == null) return NotFound(new { success = false, message = "Subscriber not found." });

        var package = await _db.PackageProfiles.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.PackageId && p.SiteId == sub.SiteId && p.IsActive);
        if (package == null)
            return BadRequest(new { success = false, message = "Package is not available for this subscriber's site." });

        var payingSiteId = await PayingSiteIdAsync(sub);
        var amount = package.Price * quantity;
        var now = DateTime.UtcNow;
        Guid? oldPackageId;

        var userName = User.Identity?.Name;
        var userId = _access.CurrentUserId;

        DateTime start, end;
        decimal balanceAfter;

        await using (var tx = await _db.Database.BeginTransactionAsync())
        {
            // Lock the wallet row until commit
            var wallet = await _db.SiteWallets
                .FromSqlInterpolated($@"SELECT * FROM ""SiteWallets"" WHERE ""SiteId"" = {payingSiteId} FOR UPDATE")
                .FirstOrDefaultAsync();

            if (wallet == null && amount > 0)
            {
                await tx.RollbackAsync();
                return BadRequest(new { success = false, message = "Site wallet has not been initialized. Please add balance first." });
            }

            if (wallet != null && wallet.Balance < amount)
            {
                await tx.RollbackAsync();
                return BadRequest(new
                {
                    success = false,
                    message = $"Insufficient wallet balance. Required ₹{amount:0.00}, available ₹{wallet.Balance:0.00}.",
                    requiredAmount = amount,
                    availableBalance = wallet.Balance
                });
            }

            // Re-read subscriber inside the transaction (another operator may have recharged)
            await _db.Entry(sub).ReloadAsync();
            oldPackageId = sub.PackageId;

            start = ExpiryCalculator.RechargeStart(sub.ExpireDate, now, request.StartFrom);
            end = ExpiryCalculator.AddValidity(start, package, quantity);

            var currentHistory = await _db.SubscriberPackageHistories
                .Where(h => h.SubscriberId == sub.Id && h.IsCurrent)
                .ToListAsync();

            var renewal = oldPackageId == package.Id;
            foreach (var h in currentHistory)
            {
                // Keep the original Action (reports count every history row as one recharge)
                h.IsCurrent = false;
                h.EndedAt = start > now ? h.EndDate ?? sub.ExpireDate : now;
            }

            balanceAfter = wallet?.Balance ?? 0;
            if (wallet != null && amount > 0)
            {
                var before = wallet.Balance;
                wallet.Balance -= amount;
                wallet.UpdatedAt = now;
                balanceAfter = wallet.Balance;

                _db.WalletTransactions.Add(new WalletTransaction
                {
                    Id = Guid.NewGuid(),
                    SiteId = payingSiteId,
                    SubscriberId = sub.Id,
                    PackageId = package.Id,
                    TransactionType = "DEBIT",
                    Amount = amount,
                    BalanceBefore = before,
                    BalanceAfter = wallet.Balance,
                    Description = $"Recharge {sub.PPPoEUsername} - {package.PackageName} x{quantity} " +
                                  $"({IstClock.ToIst(start):dd-MM-yyyy} to {IstClock.ToIst(end):dd-MM-yyyy})",
                    CreatedAt = now
                });
            }

            var validityDays = (int)Math.Round((end - start).TotalDays);
            _db.SubscriberPackageHistories.Add(new SubscriberPackageHistory
            {
                Id = Guid.NewGuid(),
                SubscriberId = sub.Id,
                SiteId = sub.SiteId,
                PackageId = package.Id,
                PackageName = package.PackageName,
                DownloadMbps = package.DownloadMbps,
                UploadMbps = package.UploadMbps,
                Price = package.Price,
                ValidityDays = validityDays,
                Quantity = quantity,
                AmountCharged = amount,
                StartDate = start,
                EndDate = end,
                Action = currentHistory.Count == 0 && oldPackageId == null ? "ASSIGNED" : renewal ? "RENEWED" : "CHANGED",
                AssignedAt = now,
                IsCurrent = true,
                CreatedByUserId = userId,
                CreatedByName = userName,
                Comment = string.IsNullOrWhiteSpace(request.Comment)
                    ? $"Recharge: {package.PackageName} x{quantity}"
                    : request.Comment.Trim(),
                CreatedAt = now
            });

            sub.PackageId = package.Id;
            sub.ExpireDate = end;
            sub.UpdatedAt = now;

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }

        // ---- After commit: apply new speed to a live session ----
        string sessionMessage = "Subscriber is offline. The package applies on next login.";
        var activeSession = await _db.RadiusAccountingSessions.AsNoTracking()
            .Where(r => r.SubscriberId == sub.Id && r.IsActive)
            .OrderByDescending(r => r.LastUpdateTime)
            .FirstOrDefaultAsync();

        if (activeSession != null && oldPackageId != package.Id && sub.NasId.HasValue)
        {
            var nas = await _db.NasDevices.AsNoTracking().FirstOrDefaultAsync(n => n.Id == sub.NasId);
            if (nas != null)
            {
                try
                {
                    var rate = $"{package.UploadMbps:0.##}M/{package.DownloadMbps:0.##}M";
                    var coa = string.IsNullOrWhiteSpace(activeSession.AcctSessionId) || string.IsNullOrWhiteSpace(nas.SharedSecret)
                        ? null
                        : await _mikroTik.ChangePppRateLimitAsync(nas.NasIpAddress, nas.ApiPort, nas.ApiUsername,
                            nas.ApiPassword, activeSession.AcctSessionId, rate, nas.SharedSecret);

                    if (coa?.Success == true)
                    {
                        sessionMessage = $"Live session updated to {rate} without disconnecting.";
                    }
                    else
                    {
                        var dc = await _mikroTik.DisconnectPppSessionAsync(nas.NasIpAddress, nas.ApiPort,
                            nas.ApiUsername, nas.ApiPassword, sub.PPPoEUsername);
                        sessionMessage = dc.Success
                            ? "Session reconnected so the new speed applies."
                            : "Recharge saved, but the live session could not be updated: " + dc.Message;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Live session update after recharge failed");
                    sessionMessage = "Recharge saved, but the router could not be reached to update the live session.";
                }
            }
        }
        else if (activeSession != null)
        {
            sessionMessage = "Subscriber is online. Validity extended.";
        }

        await _sms.TrySendRechargeSmsAsync(sub, package.PackageName, end, amount);

        return Ok(new
        {
            success = true,
            message = $"Recharge successful. {package.PackageName} valid from {IstClock.ToIst(start):dd-MM-yyyy} to {IstClock.ToIst(end):dd-MM-yyyy}. ₹{amount:0.00} deducted. {sessionMessage}",
            startDate = start,
            endDate = end,
            amount,
            remainingWalletBalance = balanceAfter
        });
    }

    // =========================================================
    // RECHARGE HISTORY
    // GET api/Recharge/{subscriberId}/history
    // =========================================================
    [HttpGet("{subscriberId:guid}/history")]
    public async Task<IActionResult> History(Guid subscriberId)
    {
        var rows = await _db.SubscriberPackageHistories.AsNoTracking()
            .Where(h => h.SubscriberId == subscriberId)
            .OrderByDescending(h => h.CreatedAt)
            .Select(h => new
            {
                h.Id,
                h.PackageId,
                h.PackageName,
                h.DownloadMbps,
                h.UploadMbps,
                h.Price,
                h.Quantity,
                h.AmountCharged,
                startDate = h.StartDate ?? h.AssignedAt,
                endDate = h.EndDate ?? h.EndedAt,
                h.ValidityDays,
                h.Action,
                h.IsCurrent,
                h.Comment,
                h.CreatedByName,
                h.CreatedAt
            })
            .ToListAsync();

        return Ok(rows);
    }
}
