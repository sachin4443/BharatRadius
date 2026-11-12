using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Core.DTOs;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;
using System.Security.Claims;

namespace RadiusSoftware.API.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class WalletController : ControllerBase
    {
        private readonly AppDbContext _context;

        public WalletController(AppDbContext context)
        {
            _context = context;
        }

        // =========================================================
        // CURRENT LOGGED-IN SITE
        // =========================================================

        private async Task<Site?> GetLoggedInSite()
        {
            var userIdStr =
                User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!Guid.TryParse(userIdStr, out var userId))
                return null;

            return await _context.Sites
                .FirstOrDefaultAsync(s =>
                    s.UserId == userId &&
                    !s.IsDeleted);
        }


        // =========================================================
        // GET CURRENT SITE WALLET BALANCE
        //
        // GET:
        // /api/Wallet/balance
        // =========================================================

        [HttpGet("balance")]
        public async Task<IActionResult> GetBalance()
        {
            try
            {
                var site = await GetLoggedInSite();

                if (site == null)
                {
                    return Unauthorized(new
                    {
                        message = "Logged-in site not found."
                    });
                }

                var wallet = await _context.SiteWallets
                    .AsNoTracking()
                    .FirstOrDefaultAsync(w =>
                        w.SiteId == site.Id);

                return Ok(new
                {
                    siteId = site.Id,
                    siteName = site.SiteName,
                    balance = wallet?.Balance ?? 0
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Unable to load wallet.",
                    error = ex.Message,
                    innerError = ex.InnerException?.Message
                });
            }
        }


        // =========================================================
        // GET DIRECT CHILD SITES
        //
        // GET:
        // /api/Wallet/child-sites
        //
        // L2:
        // Current L2 site
        //       ↓
        // Direct child sites
        // =========================================================

        [HttpGet("child-sites")]
        public async Task<IActionResult> GetChildSites()
        {
            try
            {
                var parentSite = await GetLoggedInSite();

                if (parentSite == null)
                {
                    return Unauthorized(new
                    {
                        message = "Logged-in site not found."
                    });
                }

                var childSites = await _context.Sites
                    .AsNoTracking()
                    .Where(s =>
                        s.ParentSiteId == parentSite.Id &&
                        !s.IsDeleted)
                    .Select(s => new
                    {
                        id = s.Id,
                        name = s.SiteName,
                        userId = s.UserId,

                        walletBalance =
                            _context.SiteWallets
                                .Where(w => w.SiteId == s.Id)
                                .Select(w => w.Balance)
                                .FirstOrDefault()
                    })
                    .OrderBy(x => x.name)
                    .ToListAsync();

                return Ok(childSites);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = "Unable to load child sites.",
                    error = ex.Message,
                    innerError = ex.InnerException?.Message
                });
            }
        }


        // =========================================================
        // L2 -> CHILD SITE WALLET TRANSFER
        //
        // POST:
        // /api/Wallet/add-to-child
        //
        // BODY:
        // {
        //   "siteId": "...",
        //   "amount": 1000,
        //   "description": "Wallet funding"
        // }
        //
        // RESULT:
        //
        // Parent Wallet:
        //     DEBIT
        //
        // Child Wallet:
        //     CREDIT
        //
        // TWO transaction records are created.
        // =========================================================

        [HttpPost("add-to-child")]
        public async Task<IActionResult> AddToChild([FromBody] AddChildWalletDto model)
        {
            if (model == null || model.SiteId == Guid.Empty || model.Amount <= 0)
            {
                return BadRequest(new { message = "Invalid request or amount must be greater than zero." });
            }

            await using var dbTransaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var parentSite = await GetLoggedInSite();
                if (parentSite == null)
                {
                    await dbTransaction.RollbackAsync();
                    return Unauthorized(new { message = "Logged-in site not found." });
                }

                var childSite = await _context.Sites
                    .FirstOrDefaultAsync(s => s.Id == model.SiteId && s.ParentSiteId == parentSite.Id && !s.IsDeleted);

                if (childSite == null)
                {
                    await dbTransaction.RollbackAsync();
                    return BadRequest(new { message = "Selected site is not a child site of your site." });
                }

                // 1. Parent Wallet (Agar nahi hai toh automatic create ho jayega)
                // Row lock so parallel transfers cannot corrupt the balance
                var parentSiteIdForLock = parentSite.Id;
                var parentWallet = await _context.SiteWallets
                    .FromSqlInterpolated($@"SELECT * FROM ""SiteWallets"" WHERE ""SiteId"" = {parentSiteIdForLock} FOR UPDATE")
                    .FirstOrDefaultAsync();

                if (parentWallet == null)
                {
                    parentWallet = new SiteWallet
                    {
                        Id = Guid.NewGuid(),
                        SiteId = parentSite.Id,
                        Balance = 0,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.SiteWallets.Add(parentWallet);
                    await _context.SaveChangesAsync();
                }

                // 2. Child Wallet (Agar nahi hai toh automatic create ho jayega)
                // Row lock so parallel transfers cannot corrupt the balance
                var childSiteIdForLock = childSite.Id;
                var childWallet = await _context.SiteWallets
                    .FromSqlInterpolated($@"SELECT * FROM ""SiteWallets"" WHERE ""SiteId"" = {childSiteIdForLock} FOR UPDATE")
                    .FirstOrDefaultAsync();

                if (childWallet == null)
                {
                    childWallet = new SiteWallet
                    {
                        Id = Guid.NewGuid(),
                        SiteId = childSite.Id,
                        Balance = 0,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.SiteWallets.Add(childWallet);
                    await _context.SaveChangesAsync();
                }

                var parentBalanceBefore = parentWallet.Balance;
                var childBalanceBefore = childWallet.Balance;

                // 3. Parent se Amount Debit (Unrestricted - balance minus mein bhi ja sakta hai)
                parentWallet.Balance -= model.Amount;
                parentWallet.UpdatedAt = DateTime.UtcNow;

                var parentTransaction = new WalletTransaction
                {
                    Id = Guid.NewGuid(),
                    SiteId = parentSite.Id,
                    FromSiteId = parentSite.Id,
                    ToSiteId = childSite.Id,
                    TransactionType = "DEBIT",
                    Amount = model.Amount,
                    BalanceBefore = parentBalanceBefore,
                    BalanceAfter = parentWallet.Balance,
                    Description = string.IsNullOrWhiteSpace(model.Description)
                        ? $"Amount transferred to child site {childSite.SiteName}"
                        : $"Amount transferred to child site {childSite.SiteName}. {model.Description}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.WalletTransactions.Add(parentTransaction);

                // 4. Child mein Amount Credit
                childWallet.Balance += model.Amount;
                childWallet.UpdatedAt = DateTime.UtcNow;

                var childTransaction = new WalletTransaction
                {
                    Id = Guid.NewGuid(),
                    SiteId = childSite.Id,
                    FromSiteId = parentSite.Id,
                    ToSiteId = childSite.Id,
                    TransactionType = "CREDIT",
                    Amount = model.Amount,
                    BalanceBefore = childBalanceBefore,
                    BalanceAfter = childWallet.Balance,
                    Description = string.IsNullOrWhiteSpace(model.Description)
                        ? $"Amount received from parent site {parentSite.SiteName}"
                        : $"Amount received from parent site {parentSite.SiteName}. {model.Description}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.WalletTransactions.Add(childTransaction);

                await _context.SaveChangesAsync();
                await dbTransaction.CommitAsync();

                return Ok(new
                {
                    message = "Amount transferred successfully.",
                    transactionId = parentTransaction.Id,
                    parentBalance = parentWallet.Balance,
                    childBalance = childWallet.Balance
                });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                return StatusCode(500, new
                {
                    message = "Wallet transfer failed.",
                    error = ex.Message,
                    innerError = ex.InnerException?.Message
                });
            }
        }

        // =========================================================
        // TRANSACTION HISTORY
        //
        // GET:
        //
        // /api/Wallet/transactions
        //
        // Optional:
        //
        // /api/Wallet/transactions?siteId=GUID
        //
        // /api/Wallet/transactions?type=DEBIT
        //
        // /api/Wallet/transactions?type=CREDIT
        //
        // =========================================================

        [HttpGet("transactions")]
        public async Task<IActionResult> GetTransactions(
            [FromQuery] Guid? siteId = null,
            [FromQuery] string? type = null,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            try
            {
                var loggedInSite = await GetLoggedInSite();

                if (loggedInSite == null)
                {
                    return Unauthorized(new
                    {
                        message = "Logged-in site not found."
                    });
                }


                // =====================================================
                // DIRECT CHILD SITE IDS
                // =====================================================

                var childSiteIds =
                    await _context.Sites
                        .AsNoTracking()
                        .Where(s =>
                            s.ParentSiteId == loggedInSite.Id &&
                            !s.IsDeleted)
                        .Select(s => s.Id)
                        .ToListAsync();


                // =====================================================
                // LOGGED-IN SITE + DIRECT CHILDREN
                //
                // This allows L2 to track:
                //
                // L2 -> Child transfer
                //
                // Child -> Subscriber recharge
                //
                // =====================================================

                var visibleSiteIds =
                    childSiteIds
                        .Append(loggedInSite.Id)
                        .ToList();


                // =====================================================
                // QUERY
                // =====================================================

                var query =
                    _context.WalletTransactions
                        .AsNoTracking()
                        .Where(t =>
                            visibleSiteIds.Contains(t.SiteId));


                // =====================================================
                // SITE FILTER
                // =====================================================

                if (siteId.HasValue)
                {
                    if (!visibleSiteIds.Contains(siteId.Value))
                    {
                        return Forbid();
                    }

                    query =
                        query.Where(t =>
                            t.SiteId == siteId.Value);
                }


                // =====================================================
                // TYPE FILTER
                // =====================================================

                if (!string.IsNullOrWhiteSpace(type))
                {
                    var transactionType =
                        type.Trim().ToUpper();

                    if (transactionType != "CREDIT" &&
                        transactionType != "DEBIT")
                    {
                        return BadRequest(new
                        {
                            message =
                                "Transaction type must be CREDIT or DEBIT."
                        });
                    }

                    query =
                        query.Where(t =>
                            t.TransactionType == transactionType);
                }


                // =====================================================
                // DATE FILTER
                // =====================================================

                if (from.HasValue)
                {
                    query =
                        query.Where(t =>
                            t.CreatedAt >= from.Value);
                }

                if (to.HasValue)
                {
                    var endDate =
                        to.Value.Date.AddDays(1);

                    query =
                        query.Where(t =>
                            t.CreatedAt < endDate);
                }


                // =====================================================
                // RESULT
                // =====================================================

                var transactions =
                    await query
                        .OrderByDescending(t =>
                            t.CreatedAt)
                        .Select(t => new
                        {
                            t.Id,

                            t.SiteId,

                            t.TransactionType,

                            t.Amount,

                            t.BalanceBefore,

                            t.BalanceAfter,

                            t.Description,

                            t.SubscriberId,

                            t.PackageId,

                            t.FromSiteId,

                            t.ToSiteId,

                            t.CreatedAt,

                            SiteName =
                                _context.Sites
                                    .Where(s =>
                                        s.Id == t.SiteId)
                                    .Select(s =>
                                        s.SiteName)
                                    .FirstOrDefault(),

                            FromSiteName =
                                _context.Sites
                                    .Where(s =>
                                        s.Id == t.FromSiteId)
                                    .Select(s =>
                                        s.SiteName)
                                    .FirstOrDefault(),

                            ToSiteName =
                                _context.Sites
                                    .Where(s =>
                                        s.Id == t.ToSiteId)
                                    .Select(s =>
                                        s.SiteName)
                                    .FirstOrDefault(),

                            SubscriberName =
                                _context.Subscribers
                                    .Where(s =>
                                        s.Id == t.SubscriberId)
                                    .Select(s =>
                                        s.FullName)
                                    .FirstOrDefault(),

                            PackageName =
                                _context.PackageProfiles
                                    .Where(p =>
                                        p.Id == t.PackageId)
                                    .Select(p =>
                                        p.PackageName)
                                    .FirstOrDefault()
                        })
                        .ToListAsync();


                return Ok(transactions);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message =
                        "Unable to load wallet transactions.",

                    error =
                        ex.Message,

                    innerError =
                        ex.InnerException?.Message
                });
            }
        }
    }
}