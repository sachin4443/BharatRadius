using RadiusSoftware.API.Security;
using RadiusSoftware.API.Services.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.API.Services;
using RadiusSoftware.API.Services.MikroTik;
using RadiusSoftware.Core.DTOs;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Controllers;

[Authorize]
[SiteScoped(ScopedResource.Subscriber, "id")]
[Route("api/[controller]")]
[ApiController]
public class SubscribersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IMikroTikService _mikroTikService;
    private readonly ISubscriberConnectionService _subscriberConnectionService;
    private readonly ISiteAccessService _access;
    private readonly ISubscriberQueryService _subscriberQuery;


    public SubscribersController(
        AppDbContext context,
        IMikroTikService mikroTikService, ISubscriberConnectionService subscriberConnectionService,
        ISiteAccessService access,
        ISubscriberQueryService subscriberQuery)
    {
        _access = access;
        _subscriberQuery = subscriberQuery;
        _context = context;
        _mikroTikService = mikroTikService;
        _subscriberConnectionService = subscriberConnectionService;
    }

    [HttpGet("list")]
    public async Task<IActionResult> GetSubscribers()
    {
        try
        {
            var isSuperAdmin =
                User.FindFirst("IsSuperAdmin")?.Value == "True";

            var userIdStr =
                User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

  

            if (isSuperAdmin)
            {
                var allSubscribers = await _context.Subscribers
                    .AsNoTracking()
                    .OrderByDescending(s => s.CreatedAt)
                    .ToListAsync();

                return Ok(allSubscribers);
            }

            // =========================================================
            // USER ID
            // =========================================================

            // Own site + all child sites (any depth), or whole organization for org admins
            var accessibleSiteIds = (await _access.GetAccessibleSiteIdsAsync())?.ToList() ?? new List<Guid>();

            var subscribers = await _context.Subscribers
                .AsNoTracking()
                .Where(sub => accessibleSiteIds.Contains(sub.SiteId))
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();

            return Ok(subscribers);

            //var subscribers = await _context.Subscribers
            //    .AsNoTracking()
            //    .Where(sub =>
            //        _context.Sites.Any(site =>
            //            site.Id == sub.SiteId &&
            //            site.UserId == currentUserId &&
            //            !site.IsDeleted
            //        )
            //    )
            //    .OrderByDescending(s => s.CreatedAt)
            //    .ToListAsync();

            //return Ok(subscribers);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Unable to load subscribers.",
                error = ex.Message,
                innerError = ex.InnerException?.Message
            });
        }
    }

    // =========================================================
    // FAST PAGED LIST (server side search / filter / sort)
    // GET api/Subscribers/paged?page=1&pageSize=25&search=&status=expired
    // =========================================================
    [HttpGet("paged")]
    public async Task<IActionResult> GetSubscribersPaged([FromQuery] SubscriberListFilter filter)
    {
        filter.Page = Math.Max(1, filter.Page);
        filter.PageSize = Math.Clamp(filter.PageSize, 5, 500);

        var rows = await _subscriberQuery.RowsAsync();

        // Status counters for the summary cards (search / site filters applied, status filter not)
        var counterFilter = new SubscriberListFilter
        {
            Search = filter.Search,
            SiteId = filter.SiteId,
            NasId = filter.NasId,
            PackageId = filter.PackageId
        };
        var counts = await _subscriberQuery.ApplyFilter(rows, counterFilter)
            .GroupBy(r => r.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        var filtered = _subscriberQuery.ApplyFilter(rows, filter);
        var total = await filtered.CountAsync();

        var items = await _subscriberQuery.ApplySort(filtered, filter)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        int Count(string status) => counts.FirstOrDefault(c => c.Status == status)?.Count ?? 0;

        return Ok(new
        {
            items,
            total,
            page = filter.Page,
            pageSize = filter.PageSize,
            totalPages = (int)Math.Ceiling(total / (double)filter.PageSize),
            counts = new
            {
                total = counts.Sum(c => c.Count),
                online = Count(SubscriberStatus.Online),
                active = Count(SubscriberStatus.Active) + Count(SubscriberStatus.Online) + Count(SubscriberStatus.WrongPassword),
                offline = Count(SubscriberStatus.Active) + Count(SubscriberStatus.WrongPassword),
                expired = Count(SubscriberStatus.Expired),
                suspended = Count(SubscriberStatus.Suspended),
                disabled = Count(SubscriberStatus.Disabled),
                wrongPassword = Count(SubscriberStatus.WrongPassword)
            }
        });
    }

    // =========================================================
    // EXPORT CURRENT FILTER AS CSV (opens in Excel)
    // =========================================================
    [HttpGet("export")]
    public async Task<IActionResult> ExportSubscribers([FromQuery] SubscriberListFilter filter)
    {
        var rows = _subscriberQuery.ApplySort(
            _subscriberQuery.ApplyFilter(await _subscriberQuery.RowsAsync(), filter), filter);
        var items = await rows.Take(100_000).ToListAsync();

        static string Csv(string? v)
        {
            v ??= string.Empty;
            // Prevent spreadsheet formula injection
            if (v.Length > 0 && "=+-@".Contains(v[0])) v = "'" + v;
            return "\"" + v.Replace("\"", "\"\"") + "\"";
        }

        var sb = new System.Text.StringBuilder();
        sb.AppendLine("Username,Full Name,Mobile,Address,City,Site,Package,Price,NAS,Status,Expiry Date (IST),Last Login Result,Created (IST)");
        foreach (var r in items)
        {
            sb.AppendLine(string.Join(",",
                Csv(r.PPPoEUsername), Csv(r.FullName), Csv(r.Mobile), Csv(r.Address), Csv(r.City),
                Csv(r.SiteName), Csv(r.PackageName), Csv(r.PackagePrice?.ToString("0.00")), Csv(r.NasName),
                Csv(r.Status),
                Csv(r.ExpireDate.HasValue ? IstClock.ToIst(r.ExpireDate.Value).ToString("yyyy-MM-dd HH:mm") : ""),
                Csv(r.LastAuthReason ?? r.LastAuthResult),
                Csv(IstClock.ToIst(r.CreatedAt).ToString("yyyy-MM-dd HH:mm"))));
        }

        var bytes = System.Text.Encoding.UTF8.GetPreamble()
            .Concat(System.Text.Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv", $"subscribers-{DateTime.UtcNow:yyyyMMdd-HHmm}.csv");
    }

    // =========================================================
    // CHECK IF A PPPoE USERNAME IS FREE (used by the add form)
    // =========================================================
    [HttpGet("check-username")]
    public async Task<IActionResult> CheckUsername([FromQuery] string username, [FromQuery] Guid? excludeId)
    {
        var lower = (username ?? string.Empty).Trim().ToLower();
        if (lower.Length == 0) return Ok(new { available = false });
        var exists = await _context.Subscribers.AsNoTracking()
            .AnyAsync(s => s.PPPoEUsername.ToLower() == lower && (excludeId == null || s.Id != excludeId));
        return Ok(new { available = !exists });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetSubscriberById(Guid id)
    {
        try
        {
            var isSuperAdmin =
                User.FindFirst("IsSuperAdmin")?.Value == "True";

            var userIdStr =
                User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            IQueryable<Subscriber> query =
                _context.Subscribers.AsNoTracking();

            // =====================================================
            // NORMAL USER -> ONLY OWN SITE SUBSCRIBER
            // =====================================================

            if (!isSuperAdmin)
            {
                if (!Guid.TryParse(userIdStr, out var currentUserId))
                {
                    return Unauthorized(new
                    {
                        message = "Invalid logged-in user."
                    });
                }

                // Own site and all child sites
                var accessibleSiteIds = (await _access.GetAccessibleSiteIdsAsync())?.ToList() ?? new List<Guid>();
                query = query.Where(s => accessibleSiteIds.Contains(s.SiteId));
            }

            var sub = await query
                .Where(s => s.Id == id)
                .Select(s => new
                {
                    s.Id,
                    s.SiteId,
                    s.FullName,
                    s.SubscriberType,
                    s.CompanyName,
                    s.Mobile,
                    s.Email,
                    s.PortalUsername,
                    s.Address,
                    s.Zip,
                    s.City,
                    s.State,
                    s.GstNo,
                    s.Comment,
                    s.Service,
                    s.StaticIp,
                    s.MacAddress,
                    s.IsActive,
                    s.ConnectionEnabled,
                    s.PPPoEUsername,
                    s.PPPoEPassword,
                    s.ExpireDate,
                    s.CreatedAt,
                    s.UpdatedAt,
                    s.PhotoUrl,

                    NasName = _context.NasDevices
                        .Where(n => n.Id == s.NasId)
                        .Select(n => n.NasName)
                        .FirstOrDefault() ?? "Global",

                    PackageName = _context.PackageProfiles
                        .Where(p => p.Id == s.PackageId)
                        .Select(p => p.PackageName)
                        .FirstOrDefault() ?? "No Plan",

                    DownloadSpeed = _context.PackageProfiles
                        .Where(p => p.Id == s.PackageId)
                        .Select(p => p.DownloadMbps)
                        .FirstOrDefault(),

                    UploadSpeed = _context.PackageProfiles
                        .Where(p => p.Id == s.PackageId)
                        .Select(p => p.UploadMbps)
                        .FirstOrDefault(),

                    ExpiryDays = _context.PackageProfiles
                        .Where(p => p.Id == s.PackageId)
                        .Select(p => p.ExpiryDays)
                        .FirstOrDefault()
                })
                .FirstOrDefaultAsync();

            if (sub == null)
            {
                return NotFound(new
                {
                    message = "Subscriber not found."
                });
            }

            return Ok(sub);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Unable to get subscriber.",
                error = ex.Message,
                innerError = ex.InnerException?.Message
            });
        }
    }

    [HttpPost("save")]
    public async Task<IActionResult> SaveSubscriber([FromBody] SubscriberDto model)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            var isSuperAdmin = User.FindFirst("IsSuperAdmin")?.Value == "True";
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                            ?? User.FindFirst("sub")?.Value;

            // 1. AUTOMATIC SITE ID ASSIGNMENT
            Guid siteId;
            if (isSuperAdmin)
            {
                if (model.SiteId == Guid.Empty) return BadRequest(new { message = "SiteId is required for SuperAdmin." });
                siteId = model.SiteId;
            }
            else
            {
                if (!Guid.TryParse(userIdStr, out var currentUserId)) return Unauthorized(new { message = "Invalid logged-in user." });

                var userSite = await _context.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == currentUserId && !s.IsDeleted);
                if (userSite == null) return BadRequest(new { message = "No site is assigned to this user." });

                siteId = userSite.Id; // Auto-assign login user's site
            }

            // 1b. When editing, keep the subscriber in its own site (a parent
            //     site may edit subscribers of its child sites)
            if (model.Id != Guid.Empty)
            {
                var currentSiteId = await _context.Subscribers.AsNoTracking()
                    .Where(s => s.Id == model.Id).Select(s => (Guid?)s.SiteId).FirstOrDefaultAsync();
                if (currentSiteId == null) return NotFound(new { message = "Subscriber not found." });
                if (!isSuperAdmin && !await _access.CanAccessSiteAsync(currentSiteId.Value)) return Forbid();
                siteId = currentSiteId.Value;
            }

            // 1c. PPPoE username must be unique across the whole system
            //     (the RADIUS server finds subscribers by username only)
            var pppoeUsername = (model.PPPoEUsername ?? string.Empty).Trim();
            model.PPPoEUsername = pppoeUsername;
            if (!string.IsNullOrEmpty(pppoeUsername))
            {
                var lower = pppoeUsername.ToLower();
                var duplicate = await _context.Subscribers.AsNoTracking()
                    .AnyAsync(s => s.Id != model.Id && s.PPPoEUsername.ToLower() == lower);
                if (duplicate)
                {
                    return Conflict(new { message = $"PPPoE username '{pppoeUsername}' already exists. Please choose another username." });
                }
            }
            else if (model.Id == Guid.Empty && (model.Service ?? "PPPoE") == "PPPoE")
            {
                return BadRequest(new { message = "PPPoE username is required." });
            }

            // 1d. NAS and package must belong to the subscriber's site
            if (model.NasId.HasValue &&
                !await _context.NasDevices.AnyAsync(n => n.Id == model.NasId.Value && n.SiteId == siteId))
            {
                return BadRequest(new { message = "Selected NAS does not belong to this site." });
            }
            if (model.PackageId.HasValue &&
                !await _context.PackageProfiles.AnyAsync(p => p.Id == model.PackageId.Value && p.SiteId == siteId))
            {
                return BadRequest(new { message = "Selected package does not belong to this site." });
            }

            // 2. CREATE NEW SUBSCRIBER
            if (model.Id == Guid.Empty)
            {
                var sub = new Subscriber
                {
                    Id = Guid.NewGuid(),
                    SiteId = siteId,
                    NasId = model.NasId,
                    PackageId = model.PackageId,
                    SubscriberType = model.SubscriberType ?? "Individual",
                    FullName = model.FullName ?? string.Empty,
                    CompanyName = model.CompanyName ?? string.Empty,
                    Mobile = model.Mobile ?? string.Empty,
                    Email = model.Email ?? string.Empty,
                    PortalUsername = model.PortalUsername ?? string.Empty,
                    PortalPassword = model.PortalPassword ?? string.Empty,
                    Address = model.Address ?? string.Empty,
                    Zip = model.Zip ?? string.Empty,
                    City = model.City ?? string.Empty,
                    State = model.State ?? string.Empty,
                    GstNo = model.GstNo ?? string.Empty,
                    Comment = model.Comment ?? string.Empty,
                    Service = model.Service ?? "PPPoE",
                    PPPoEUsername = model.PPPoEUsername ?? string.Empty,
                    PPPoEPassword = model.PPPoEPassword ?? string.Empty,
                    MacAddress = model.MacAddress ?? string.Empty,
                    StaticIp = model.StaticIp ?? string.Empty,
                    IsActive = model.IsActive,
                    ConnectionEnabled = true,
                    ExpireDate = model.ExpireDate.HasValue
    ? DateTime.SpecifyKind(model.ExpireDate.Value, DateTimeKind.Utc)
    : null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Subscribers.Add(sub);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Subscriber added successfully!", id = sub.Id, siteId = sub.SiteId });
            }
            else
            {
                // 3. UPDATE EXISTING SUBSCRIBER
                var existingSubscriber = await _context.Subscribers.FirstOrDefaultAsync(s => s.Id == model.Id);
                if (existingSubscriber == null) return NotFound(new { message = "Subscriber not found." });

                existingSubscriber.SiteId = siteId; // Ensure SiteId remains locked
                existingSubscriber.NasId = model.NasId;
                existingSubscriber.PackageId = model.PackageId;
                existingSubscriber.SubscriberType = model.SubscriberType ?? "Individual";
                existingSubscriber.FullName = model.FullName ?? string.Empty;
                existingSubscriber.CompanyName = model.CompanyName ?? string.Empty;
                existingSubscriber.Mobile = model.Mobile ?? string.Empty;
                existingSubscriber.Email = model.Email ?? string.Empty;
                existingSubscriber.PortalUsername = model.PortalUsername ?? string.Empty;
                existingSubscriber.PortalPassword = model.PortalPassword ?? string.Empty;
                existingSubscriber.Address = model.Address ?? string.Empty;
                existingSubscriber.Zip = model.Zip ?? string.Empty;
                existingSubscriber.City = model.City ?? string.Empty;
                existingSubscriber.State = model.State ?? string.Empty;
                existingSubscriber.GstNo = model.GstNo ?? string.Empty;
                existingSubscriber.Comment = model.Comment ?? string.Empty;
                existingSubscriber.Service = model.Service ?? "PPPoE";

                // ✨ Update PPPoE credentials ONLY if they are not empty (handled via frontend checkbox)
                if (!string.IsNullOrWhiteSpace(model.PPPoEUsername))
                    existingSubscriber.PPPoEUsername = model.PPPoEUsername;

                if (!string.IsNullOrWhiteSpace(model.PPPoEPassword))
                    existingSubscriber.PPPoEPassword = model.PPPoEPassword;

                existingSubscriber.MacAddress = model.MacAddress ?? string.Empty;
                existingSubscriber.StaticIp = model.StaticIp ?? string.Empty;
                existingSubscriber.IsActive = model.IsActive;

                existingSubscriber.ExpireDate = model.ExpireDate.HasValue
                    ? DateTime.SpecifyKind(model.ExpireDate.Value, DateTimeKind.Utc)
                    : null;

                existingSubscriber.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = "Subscriber updated successfully!",
                    id = existingSubscriber.Id,
                    siteId = existingSubscriber.SiteId
                });
            }
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Internal server error.", error = ex.Message });
        }
    }

    

    [HttpDelete("delete/{id}")]
    public async Task<IActionResult> DeleteSubscriber(Guid id)
    {
        var sub = await _context.Subscribers.FindAsync(id);
        if (sub == null) return NotFound();

        _context.Subscribers.Remove(sub);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Subscriber deleted successfully!" });
    }

    #region [Router Communication]

    // ==========================================
    // PHASE 3: MIKROTIK ACTIONS & LIVE TRAFFIC
    // ==========================================

    [HttpPost("disconnect/{id}")]
    public async Task<IActionResult> DisconnectSubscriber(Guid id)
    {
        var sub = await _context.Subscribers
            .FirstOrDefaultAsync(x => x.Id == id);

        if (sub == null)
        {
            return NotFound(new
            {
                success = false,
                message = "Subscriber not found."
            });
        }

        if (sub.NasId == null)
        {
            return BadRequest(new
            {
                success = false,
                message = "No MikroTik NAS is assigned to this subscriber."
            });
        }

        var nas = await _context.NasDevices
            .FirstOrDefaultAsync(x => x.Id == sub.NasId);

        if (nas == null)
        {
            return BadRequest(new
            {
                success = false,
                message = "Assigned MikroTik NAS was not found."
            });
        }

        if (!nas.IsOnline)
        {
            return BadRequest(new
            {
                success = false,
                message = "Assigned MikroTik router is offline."
            });
        }

        if (string.IsNullOrWhiteSpace(sub.PPPoEUsername))
        {
            return BadRequest(new
            {
                success = false,
                message = "PPPoE username is not configured for this subscriber."
            });
        }

        var result = await _mikroTikService.DisconnectPppSessionAsync(
            nas.NasIpAddress,
            nas.ApiPort,
            nas.ApiUsername,
            nas.ApiPassword,
            sub.PPPoEUsername);

        if (!result.Success)
        {
            return BadRequest(new
            {
                success = false,
                message = result.Message
            });
        }

        // Disable subscriber connection after successful disconnect
        sub.ConnectionEnabled = false;
        sub.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            enabled = false,
            message = result.Message
        });
    }

    [HttpPost("reset-mac/{id}")]
    public async Task<IActionResult> ResetMac(Guid id)
    {
        var sub = await _context.Subscribers.FindAsync(id);
        if (sub == null) return NotFound();

        sub.MacAddress = ""; // Clear MAC
        await _context.SaveChangesAsync();
        return Ok(new { message = "MAC Address reset successfully!" });
    }

    [HttpPost("suspend/{id}")]
    public async Task<IActionResult> SuspendSubscriber(Guid id)
    {
        var sub = await _context.Subscribers.FindAsync(id);
        if (sub == null) return NotFound();

        sub.IsActive = !sub.IsActive; // Toggle Status
        await _context.SaveChangesAsync();

        // Agar suspend kiya hai, toh hath-o-hath router se bhi Disconnect mar do
        if (!sub.IsActive && sub.NasId != null)
        {
            await DisconnectSubscriber(id);
        }

        string status = sub.IsActive ? "Activated" : "Suspended";
        return Ok(new { message = $"Subscriber {status} successfully!" });
    }

    [HttpGet("traffic/{id}")]
    public async Task<IActionResult> GetLiveTraffic(Guid id)
    {
        var sub = await _context.Subscribers.FindAsync(id);
        if (sub == null || sub.NasId == null) return BadRequest();

        var nas = await _context.NasDevices.FindAsync(sub.NasId);
        if (nas == null || !nas.IsOnline) return BadRequest();

        try
        {
            using var connection = tik4net.ConnectionFactory.CreateConnection(tik4net.TikConnectionType.Api);
            connection.Open(nas.NasIpAddress, nas.ApiUsername, nas.ApiPassword);

            // PPPoE user ka dynamic interface uska username hota hai (e.g., <pppoe-sarang>)
            var trafficCmd = connection.CreateCommand("/interface/monitor-traffic");
            trafficCmd.AddParameter("interface", $"<pppoe-{sub.PPPoEUsername}>");
            trafficCmd.AddParameter("once", "");

            var traffic = trafficCmd.ExecuteSingleRow();

            if (traffic != null)
            {
                long rx = traffic.Words.ContainsKey("rx-bits-per-second") ? Convert.ToInt64(traffic.Words["rx-bits-per-second"]) : 0;
                long tx = traffic.Words.ContainsKey("tx-bits-per-second") ? Convert.ToInt64(traffic.Words["tx-bits-per-second"]) : 0;

                // Converting bps to Mbps for Graph
                return Ok(new
                {
                    downloadMbps = Math.Round((double)tx / (1024 * 1024), 2), // TX of router is Download for user
                    uploadMbps = Math.Round((double)rx / (1024 * 1024), 2)    // RX of router is Upload for user
                });
            }
            return Ok(new { downloadMbps = 0, uploadMbps = 0 });
        }
        catch
        {
            // If interface not found (User offline), return 0
            return Ok(new { downloadMbps = 0, uploadMbps = 0 });
        }
    }
    #endregion

    [HttpPost("{id}/connection")]
    public async Task<IActionResult> ToggleConnection(Guid id, [FromBody] bool enabled)
    {
        var result = enabled
            ? await _subscriberConnectionService.EnableAsync(id)
            : await _subscriberConnectionService.DisableAsync(id);

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }
    [HttpPost("{id}/photo")]
    public async Task<IActionResult> UploadPhoto(Guid id,IFormFile file)
    {
        var subscriber = await _context.Subscribers
            .FirstOrDefaultAsync(x => x.Id == id);

        if (subscriber == null)
        {
            return NotFound(new
            {
                success = false,
                message = "Subscriber not found."
            });
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new
            {
                success = false,
                message = "Please select a photo."
            });
        }

        var allowedExtensions = new[]
        {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    };

        var extension =
            Path.GetExtension(file.FileName)
                .ToLowerInvariant();

        if (!allowedExtensions.Contains(extension))
        {
            return BadRequest(new
            {
                success = false,
                message = "Only JPG, JPEG, PNG and WEBP images are allowed."
            });
        }

        if (file.Length > 5 * 1024 * 1024)
        {
            return BadRequest(new
            {
                success = false,
                message = "Maximum photo size is 5 MB."
            });
        }

        var uploadsFolder = Path.Combine(
            Directory.GetCurrentDirectory(),
            "wwwroot",
            "uploads",
            "subscribers");

        Directory.CreateDirectory(uploadsFolder);

        if (!string.IsNullOrWhiteSpace(subscriber.PhotoUrl))
        {
            var oldFile = Path.Combine(
                Directory.GetCurrentDirectory(),
                "wwwroot",
                subscriber.PhotoUrl.TrimStart('/')
                    .Replace("/", Path.DirectorySeparatorChar.ToString()));

            if (System.IO.File.Exists(oldFile))
            {
                System.IO.File.Delete(oldFile);
            }
        }

        var fileName =
            $"{subscriber.Id}_{Guid.NewGuid():N}{extension}";

        var filePath = Path.Combine(
            uploadsFolder,
            fileName);

        await using (var stream = new FileStream(
            filePath,
            FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        subscriber.PhotoUrl =
            $"/uploads/subscribers/{fileName}";

        subscriber.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            photoUrl = subscriber.PhotoUrl,
            message = "Subscriber photo updated successfully."
        });
    }

    [HttpGet("{id}/connection-status")]
    public async Task<IActionResult> GetConnectionStatus(Guid id)
    {
        var result =
            await _subscriberConnectionService.GetLiveAsync(id);

        if (result == null)
        {
            return NotFound(new
            {
                success = false,
                message = "Subscriber not found."
            });
        }

        return Ok(result);
    }

    [HttpGet("{id}/history")]
    public async Task<IActionResult> GetSubscriberHistory(Guid id)
    {
        var subscriberExists = await _context.Subscribers
            .AnyAsync(x => x.Id == id);

        if (!subscriberExists)
        {
            return NotFound(new
            {
                success = false,
                message = "Subscriber not found."
            });
        }

        var history = await _context.RadiusAccountingSessions
            .Where(x => x.SubscriberId == id)
            .OrderByDescending(x =>
                x.StartTime ??
                x.LastUpdateTime ??
                x.CreatedAt)
            .Select(x => new SubscriberSessionHistoryDto
            {
                Id = x.Id,

                Username = x.Username,

                SessionId = x.AcctSessionId,

                Status =
                    x.IsActive
                        ? "ONLINE"
                        : (
                            x.AcctStatusType == "Stop"
                                ? "DISCONNECTED"
                                : x.AcctStatusType
                          ),

                IsActive = x.IsActive,

                IpAddress = x.FramedIpAddress,

                MacAddress = x.CallingStationId,

                NasIpAddress = x.NasIpAddress,

                NasName = _context.NasDevices
                    .Where(n => n.Id == x.NasId)
                    .Select(n => n.NasName)
                    .FirstOrDefault(),

                ServiceType = x.ServiceType,

                StartTime = x.StartTime,

                LastUpdateTime = x.LastUpdateTime,

                StopTime = x.StopTime,

                SessionTime = x.SessionTime,

                InputOctets = x.InputOctets,

                OutputOctets = x.OutputOctets,

                InputPackets = x.InputPackets,

                OutputPackets = x.OutputPackets,

                TerminateCause = x.TerminateCause
            })
            .ToListAsync();

        return Ok(new
        {
            success = true,
            count = history.Count,
            data = history
        });
    }

    [HttpGet("{id}/package-history")]
    public async Task<IActionResult> GetPackageHistory(Guid id)
    {
        var exists = await _context.Subscribers
            .AnyAsync(x => x.Id == id);

        if (!exists)
        {
            return NotFound(new
            {
                success = false,
                message = "Subscriber not found."
            });
        }

        var history = await _context
            .SubscriberPackageHistories
            .Where(x => x.SubscriberId == id)
            .OrderByDescending(x => x.AssignedAt)
            .Select(x => new SubscriberPackageHistoryDto
            {
                Id = x.Id,
                SubscriberId = x.SubscriberId,
                PackageId = x.PackageId,

                PackageName = x.PackageName,

                DownloadMbps = x.DownloadMbps,
                UploadMbps = x.UploadMbps,

                Price = x.Price,

                ValidityDays = x.ValidityDays,

                Action = x.Action,

                AssignedAt = x.AssignedAt,

                EndedAt = x.EndedAt,

                IsCurrent = x.IsCurrent,

                Comment = x.Comment,
                StartDate = x.StartDate ?? x.AssignedAt,
                EndDate = x.EndDate ?? x.EndedAt,
                Quantity = x.Quantity < 1 ? 1 : x.Quantity,
                AmountCharged = x.AmountCharged > 0 ? x.AmountCharged : x.Price,
                CreatedByName = x.CreatedByName
            })
            .ToListAsync();

        return Ok(new
        {
            success = true,
            count = history.Count,
            data = history
        });
    }
    [HttpGet("{id}/package")]
    public async Task<IActionResult> GetSubscriberPackage(Guid id)
    {
        var subscriber = await _context.Subscribers
            .FirstOrDefaultAsync(x => x.Id == id);

        if (subscriber == null)
        {
            return NotFound(new
            {
                success = false,
                message = "Subscriber not found."
            });
        }

        if (!subscriber.PackageId.HasValue)
        {
            return Ok(null);
        }

        var package = await _context.PackageProfiles
            .FirstOrDefaultAsync(
                x => x.Id == subscriber.PackageId.Value);

        if (package == null)
        {
            return Ok(null);
        }

        var currentHistory =
            await _context.SubscriberPackageHistories
                .Where(x =>
                    x.SubscriberId == id &&
                    x.IsCurrent)
                .OrderByDescending(
                    x => x.AssignedAt)
                .FirstOrDefaultAsync();

        DateTime? expiryDate = null;

        if (currentHistory != null)
        {
            int totalDays = CalculateTotalDays(package.ExpiryDays, package.ValidityType);
            expiryDate =
                currentHistory.AssignedAt
                    .AddDays(totalDays);
        }

        return Ok(new
        {
            packageId = package.Id,
            packageName = package.PackageName,
            planCategory = package.PlanCategory,

            downloadMbps = package.DownloadMbps,
            downloadUnit = package.DownloadUnit,

            uploadMbps = package.UploadMbps,
            uploadUnit = package.UploadUnit,

            price = package.Price,

            expiryDays = package.ExpiryDays,
            validityType = package.ValidityType,

            assignedAt =
                currentHistory?.AssignedAt,

            expiryDate,

            isCurrent = true
        });
    }

    [HttpPost("{id}/change-package")]
    public async Task<IActionResult> ChangePackage(Guid id, [FromBody] ChangeSubscriberPackageRequest request)
    {
        // =========================================================
        // 0. LOGGED-IN SITE & USER CHECK FOR WALLET
        // =========================================================
        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                            ?? User.FindFirst("sub")?.Value;

        if (!Guid.TryParse(userIdStr, out var currentUserId))
        {
            return Unauthorized(new { success = false, message = "Invalid logged-in user." });
        }

        var site = await _context.Sites
            .FirstOrDefaultAsync(s => s.UserId == currentUserId && !s.IsDeleted);

        if (site == null)
        {
            return BadRequest(new { success = false, message = "Logged-in site not found." });
        }

        // =========================================================
        // 1. SUBSCRIBER
        // =========================================================

        var subscriber =
            await _context.Subscribers
                .FirstOrDefaultAsync(x => x.Id == id);

        if (subscriber == null)
        {
            return NotFound(new
            {
                success = false,
                message = "Subscriber not found."
            });
        }

        // =========================================================
        // 2. NEW PACKAGE
        // =========================================================

        var newPackage =
            await _context.PackageProfiles
                .FirstOrDefaultAsync(x =>
                    x.Id == request.PackageId &&
                    x.SiteId == subscriber.SiteId &&
                    x.IsActive);

        if (newPackage == null)
        {
            return BadRequest(new
            {
                success = false,
                message = "Selected package is not available."
            });
        }

        if (subscriber.PackageId == newPackage.Id)
        {
            return BadRequest(new
            {
                success = false,
                message = "This package is already assigned."
            });
        }

        // =========================================================
        // 3. WALLET BALANCE & DEDUCTION CHECK
        // =========================================================

        // AsNoTracking: the row is read again with a lock inside the transaction
        var wallet = await _context.SiteWallets
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.SiteId == site.Id);

        if (wallet == null)
        {
            return BadRequest(new
            {
                success = false,
                message = "Site wallet has not been initialized."
            });
        }

        decimal packagePrice = newPackage.Price;

        if (wallet.Balance < packagePrice)
        {
            return BadRequest(new
            {
                success = false,
                message = "Insufficient wallet balance to change/assign package.",
                requiredAmount = packagePrice,
                availableBalance = wallet.Balance
            });
        }

        // =========================================================
        // 4. NAS CHECK
        // =========================================================

        if (subscriber.NasId == null)
        {
            return BadRequest(new
            {
                success = false,
                message =
                    "No MikroTik NAS is assigned to this subscriber."
            });
        }

        var nas =
            await _context.NasDevices
                .FirstOrDefaultAsync(x =>
                    x.Id == subscriber.NasId);

        if (nas == null)
        {
            return BadRequest(new
            {
                success = false,
                message =
                    "Assigned MikroTik NAS was not found."
            });
        }

        // =========================================================
        // START DATABASE TRANSACTION (Ensuring Atomicity)
        // =========================================================
        await using var dbTransaction = await _context.Database.BeginTransactionAsync();

        // Lock the wallet row and check the balance again inside the transaction
        // (prevents double deduction on double click / parallel requests)
        var lockedSiteId = site.Id;
        wallet = await _context.SiteWallets
            .FromSqlInterpolated($@"SELECT * FROM ""SiteWallets"" WHERE ""SiteId"" = {lockedSiteId} FOR UPDATE")
            .FirstAsync();
        if (wallet.Balance < packagePrice)
        {
            await dbTransaction.RollbackAsync();
            return BadRequest(new
            {
                success = false,
                message = "Insufficient wallet balance to change/assign package.",
                requiredAmount = packagePrice,
                availableBalance = wallet.Balance
            });
        }

        try
        {
            // =========================================================
            // 5. OLD PACKAGE HISTORY
            // =========================================================

            var oldHistory =
                await _context
                    .SubscriberPackageHistories
                    .Where(x =>
                        x.SubscriberId == id &&
                        x.IsCurrent)
                    .ToListAsync();

            var oldPackageId =
                oldHistory
                    .FirstOrDefault()
                    ?.PackageId
                ?? subscriber.PackageId;

            foreach (var history in oldHistory)
            {
                history.IsCurrent = false;
                history.EndedAt = DateTime.UtcNow;
            }

            // =========================================================
            // 6. WALLET DEDUCTION & TRANSACTION RECORD
            // =========================================================

            var balanceBefore = wallet.Balance;
            wallet.Balance -= packagePrice;
            wallet.UpdatedAt = DateTime.UtcNow;

            _context.WalletTransactions.Add(new WalletTransaction
            {
                Id = Guid.NewGuid(),
                SiteId = site.Id,
                SubscriberId = subscriber.Id,
                PackageId = newPackage.Id,
                TransactionType = "DEBIT",
                Amount = packagePrice,
                BalanceBefore = balanceBefore,
                BalanceAfter = wallet.Balance,
                Description = $"Package change/recharge fee for subscriber {subscriber.FullName} - {newPackage.PackageName}",
                CreatedAt = DateTime.UtcNow
            });

            // =========================================================
            // 7. CALCULATE TOTAL VALIDITY DAYS BASED ON VALIDITY TYPE
            // =========================================================
            int calculatedTotalDays = CalculateTotalDays(newPackage.ExpiryDays, newPackage.ValidityType);

            // =========================================================
            // 8. UPDATE SUBSCRIBER CURRENT PACKAGE & EXPIRY
            // =========================================================

            subscriber.PackageId = newPackage.Id;
            subscriber.ExpireDate = DateTime.UtcNow.AddDays(calculatedTotalDays);
            subscriber.UpdatedAt = DateTime.UtcNow;

            // =========================================================
            // 9. CREATE NEW PACKAGE HISTORY
            // =========================================================

            var newHistory =
                new SubscriberPackageHistory
                {
                    Id = Guid.NewGuid(),

                    SubscriberId =
                        subscriber.Id,

                    PackageId =
                        newPackage.Id,

                    // Snapshot
                    PackageName =
                        newPackage.PackageName,

                    DownloadMbps =
                        newPackage.DownloadMbps,

                    UploadMbps =
                        newPackage.UploadMbps,

                    Price =
                        newPackage.Price,

                    ValidityDays = calculatedTotalDays, // Store total computed days here

                    Action =
                        oldHistory.Count > 0
                            ? "CHANGED"
                            : "ASSIGNED",

                    AssignedAt =
                        DateTime.UtcNow,

                    EndedAt = null,

                    IsCurrent = true,

                    Comment =
                        oldHistory.Count > 0
                            ? $"Package changed to {newPackage.PackageName}"
                            : $"Package assigned: {newPackage.PackageName}"
                };

            _context
                .SubscriberPackageHistories
                .Add(newHistory);

            // =========================================================
            // 10. CHECK ACTIVE RADIUS SESSION
            // =========================================================

            var activeSession =
                await _context
                    .RadiusAccountingSessions
                    .Where(x =>
                        x.SubscriberId == id &&
                        x.IsActive)
                    .OrderByDescending(
                        x => x.LastUpdateTime)
                    .FirstOrDefaultAsync();

            bool wasOnline =
                activeSession != null;

            bool coaAttempted = false;
            bool coaSuccess = false;
            bool disconnected = false;

            string connectionMessage;

            // =========================================================
            // 11. SAVE CHANGES & COMMIT TRANSACTION
            // =========================================================

            await _context.SaveChangesAsync();
            await dbTransaction.CommitAsync();

            // =========================================================
            // 12. IF USER IS ONLINE (Router Session Update)
            // =========================================================

            if (activeSession != null)
            {
                if (string.IsNullOrWhiteSpace(
                    activeSession.AcctSessionId))
                {
                    connectionMessage =
                        $"Package changed successfully (₹{packagePrice} deducted). Active RADIUS session does not have an Acct-Session-Id. Live speed update could not be attempted.";
                }
                else if (string.IsNullOrWhiteSpace(
                    nas.SharedSecret))
                {
                    connectionMessage =
                        $"Package changed successfully (₹{packagePrice} deducted). NAS RADIUS shared secret is missing. Live speed update could not be attempted.";
                }
                else
                {
                    // =====================================================
                    // RATE LIMIT
                    // MikroTik/RADIUS format: Upload / Download
                    // =====================================================

                    string rateLimit =
                        $"{newPackage.UploadMbps}M/{newPackage.DownloadMbps}M";

                    coaAttempted = true;

                    // =====================================================
                    // SEND COA
                    // =====================================================

                    var coaResult =
                        await _mikroTikService
                            .ChangePppRateLimitAsync(
                                nas.NasIpAddress,
                                nas.ApiPort,
                                nas.ApiUsername,
                                nas.ApiPassword,
                                activeSession.AcctSessionId,
                                rateLimit,
                                nas.SharedSecret);

                    coaSuccess =
                        coaResult.Success;

                    if (coaSuccess)
                    {
                        connectionMessage =
                            $"Package changed to {newPackage.PackageName} (₹{packagePrice} deducted). " +
                            $"Live PPPoE session updated successfully to {rateLimit}. " +
                            $"Session {activeSession.AcctSessionId} remains connected.";
                    }
                    else
                    {
                        // =================================================
                        // COA FAILED -> FALLBACK: DISCONNECT SESSION
                        // =================================================

                        var disconnectResult =
                            await _mikroTikService
                                .DisconnectPppSessionAsync(
                                    nas.NasIpAddress,
                                    nas.ApiPort,
                                    nas.ApiUsername,
                                    nas.ApiPassword,
                                    subscriber.PPPoEUsername);

                        disconnected =
                            disconnectResult.Success;

                        if (disconnected)
                        {
                            connectionMessage =
                                $"Package changed to {newPackage.PackageName} (₹{packagePrice} deducted). " +
                                "Live speed update could not be applied, so the existing PPPoE session was disconnected. " +
                                "The next connection will use the new package.";
                        }
                        else
                        {
                            connectionMessage =
                                $"Package changed to {newPackage.PackageName} (₹{packagePrice} deducted), " +
                                $"but live speed update failed and the existing session could not be disconnected. " +
                                $"CoA: {coaResult.Message} | " +
                                $"Disconnect: {disconnectResult.Message}";
                        }
                    }
                }
            }
            else
            {
                // =========================================================
                // USER OFFLINE
                // =========================================================

                connectionMessage =
                    $"Package changed to {newPackage.PackageName} successfully (₹{packagePrice} deducted). " +
                    "Subscriber is currently offline. The new package will be applied on the next connection.";
            }

            // =========================================================
            // 13. FINAL RESPONSE
            // =========================================================

            return Ok(new
            {
                success = true,
                packageChanged = true,
                subscriberId = subscriber.Id,
                oldPackageId = oldPackageId,
                newPackageId = newPackage.Id,
                packageName = newPackage.PackageName,
                downloadMbps = newPackage.DownloadMbps,
                uploadMbps = newPackage.UploadMbps,
                price = newPackage.Price,
                validityDays = calculatedTotalDays,
                remainingWalletBalance = wallet.Balance,
                wasOnline,
                acctSessionId = activeSession?.AcctSessionId,
                coaAttempted,
                coaSuccess,
                disconnected,
                sessionContinued = wasOnline && coaSuccess,
                newConnectionRequired = wasOnline && coaAttempted && !coaSuccess && disconnected,
                message = connectionMessage
            });
        }
        catch (Exception ex)
        {
            await dbTransaction.RollbackAsync();
            return StatusCode(500, new
            {
                success = false,
                message = "An error occurred while changing the package and updating the wallet.",
                error = ex.Message,
                innerError = ex.InnerException?.Message
            });
        }
    }

    // Helper method to convert ExpiryDays and ValidityType into actual total days
    private int CalculateTotalDays(int expiryDays, string? validityType)
    {
        if (string.IsNullOrWhiteSpace(validityType))
        {
            return expiryDays;
        }

        string type = validityType.Trim().ToLowerInvariant();

        if (type.Contains("month"))
        {
            return expiryDays * 30; // Assuming 1 month = 30 days
        }
        else if (type.Contains("year"))
        {
            return expiryDays * 365; // Assuming 1 year = 365 days
        }
        else if (type.Contains("week"))
        {
            return expiryDays * 7; // 1 week = 7 days
        }

        // Default fallback is days
        return expiryDays;
    }

    public class ChangeSubscriberPackageRequest
    {
        public Guid PackageId { get; set; }
    }
    //[HttpGet("{id}/package")]
    //public async Task<IActionResult> GetSubscriberPackage(Guid id)
    //{
    //    var subscriber = await _context.Subscribers
    //        .FirstOrDefaultAsync(x => x.Id == id);

    //    if (subscriber == null)
    //    {
    //        return NotFound(new
    //        {
    //            success = false,
    //            message = "Subscriber not found."
    //        });
    //    }

    //    if (!subscriber.PackageId.HasValue)
    //    {
    //        return Ok(null);
    //    }

    //    var package = await _context.PackageProfiles
    //        .FirstOrDefaultAsync(
    //            x => x.Id == subscriber.PackageId.Value);

    //    if (package == null)
    //    {
    //        return Ok(null);
    //    }

    //    var currentHistory =
    //        await _context.SubscriberPackageHistories
    //            .Where(x =>
    //                x.SubscriberId == id &&
    //                x.IsCurrent)
    //            .OrderByDescending(
    //                x => x.AssignedAt)
    //            .FirstOrDefaultAsync();

    //    DateTime? expiryDate = null;

    //    if (currentHistory != null)
    //    {
    //        expiryDate =
    //            currentHistory.AssignedAt
    //                .AddDays(package.ExpiryDays);
    //    }

    //    return Ok(new
    //    {
    //        packageId = package.Id,
    //        packageName = package.PackageName,
    //        planCategory = package.PlanCategory,

    //        downloadMbps = package.DownloadMbps,
    //        downloadUnit = package.DownloadUnit,

    //        uploadMbps = package.UploadMbps,
    //        uploadUnit = package.UploadUnit,

    //        price = package.Price,

    //        expiryDays = package.ExpiryDays,
    //        validityType = package.ValidityType,

    //        assignedAt =
    //            currentHistory?.AssignedAt,

    //        expiryDate,

    //        isCurrent = true
    //    });
    //}
    //[HttpPost("{id}/change-package")]
    //public async Task<IActionResult> ChangePackage(Guid id, [FromBody] ChangeSubscriberPackageRequest request)
    //{
    //    // =========================================================
    //    // 0. LOGGED-IN SITE & USER CHECK FOR WALLET
    //    // =========================================================
    //    var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
    //                    ?? User.FindFirst("sub")?.Value;

    //    if (!Guid.TryParse(userIdStr, out var currentUserId))
    //    {
    //        return Unauthorized(new { success = false, message = "Invalid logged-in user." });
    //    }

    //    var site = await _context.Sites
    //        .FirstOrDefaultAsync(s => s.UserId == currentUserId && !s.IsDeleted);

    //    if (site == null)
    //    {
    //        return BadRequest(new { success = false, message = "Logged-in site not found." });
    //    }

    //    // =========================================================
    //    // 1. SUBSCRIBER
    //    // =========================================================

    //    var subscriber =
    //        await _context.Subscribers
    //            .FirstOrDefaultAsync(x => x.Id == id);

    //    if (subscriber == null)
    //    {
    //        return NotFound(new
    //        {
    //            success = false,
    //            message = "Subscriber not found."
    //        });
    //    }

    //    // =========================================================
    //    // 2. NEW PACKAGE
    //    // =========================================================

    //    var newPackage =
    //        await _context.PackageProfiles
    //            .FirstOrDefaultAsync(x =>
    //                x.Id == request.PackageId &&
    //                x.IsActive);

    //    if (newPackage == null)
    //    {
    //        return BadRequest(new
    //        {
    //            success = false,
    //            message = "Selected package is not available."
    //        });
    //    }

    //    if (subscriber.PackageId == newPackage.Id)
    //    {
    //        return BadRequest(new
    //        {
    //            success = false,
    //            message = "This package is already assigned."
    //        });
    //    }

    //    // =========================================================
    //    // 3. WALLET BALANCE & DEDUCTION CHECK
    //    // =========================================================

    //    var wallet = await _context.SiteWallets
    //        .FirstOrDefaultAsync(w => w.SiteId == site.Id);

    //    if (wallet == null)
    //    {
    //        return BadRequest(new
    //        {
    //            success = false,
    //            message = "Site wallet has not been initialized."
    //        });
    //    }

    //    decimal packagePrice = newPackage.Price;

    //    if (wallet.Balance < packagePrice)
    //    {
    //        return BadRequest(new
    //        {
    //            success = false,
    //            message = "Insufficient wallet balance to change/assign package.",
    //            requiredAmount = packagePrice,
    //            availableBalance = wallet.Balance
    //        });
    //    }

    //    // =========================================================
    //    // 4. NAS CHECK
    //    // =========================================================

    //    if (subscriber.NasId == null)
    //    {
    //        return BadRequest(new
    //        {
    //            success = false,
    //            message =
    //                "No MikroTik NAS is assigned to this subscriber."
    //        });
    //    }

    //    var nas =
    //        await _context.NasDevices
    //            .FirstOrDefaultAsync(x =>
    //                x.Id == subscriber.NasId);

    //    if (nas == null)
    //    {
    //        return BadRequest(new
    //        {
    //            success = false,
    //            message =
    //                "Assigned MikroTik NAS was not found."
    //        });
    //    }

    //    // =========================================================
    //    // START DATABASE TRANSACTION (Ensuring Atomicity)
    //    // =========================================================
    //    await using var dbTransaction = await _context.Database.BeginTransactionAsync();

    //    try
    //    {
    //        // =========================================================
    //        // 5. OLD PACKAGE HISTORY
    //        // =========================================================

    //        var oldHistory =
    //            await _context
    //                .SubscriberPackageHistories
    //                .Where(x =>
    //                    x.SubscriberId == id &&
    //                    x.IsCurrent)
    //                .ToListAsync();

    //        var oldPackageId =
    //            oldHistory
    //                .FirstOrDefault()
    //                ?.PackageId
    //            ?? subscriber.PackageId;

    //        foreach (var history in oldHistory)
    //        {
    //            history.IsCurrent = false;
    //            history.EndedAt = DateTime.UtcNow;
    //            history.Action = "CHANGED";
    //        }

    //        // =========================================================
    //        // 6. WALLET DEDUCTION & TRANSACTION RECORD
    //        // =========================================================

    //        var balanceBefore = wallet.Balance;
    //        wallet.Balance -= packagePrice;
    //        wallet.UpdatedAt = DateTime.UtcNow;

    //        _context.WalletTransactions.Add(new WalletTransaction
    //        {
    //            Id = Guid.NewGuid(),
    //            SiteId = site.Id,
    //            SubscriberId = subscriber.Id,
    //            PackageId = newPackage.Id,
    //            TransactionType = "DEBIT",
    //            Amount = packagePrice,
    //            BalanceBefore = balanceBefore,
    //            BalanceAfter = wallet.Balance,
    //            Description = $"Package change/recharge fee for subscriber {subscriber.FullName} - {newPackage.PackageName}",
    //            CreatedAt = DateTime.UtcNow
    //        });

    //        // =========================================================
    //        // 7. UPDATE SUBSCRIBER CURRENT PACKAGE & EXPIRY
    //        // =========================================================

    //        subscriber.PackageId = newPackage.Id;
    //        subscriber.ExpireDate = DateTime.UtcNow.AddDays(newPackage.ExpiryDays);
    //        subscriber.UpdatedAt = DateTime.UtcNow;

    //        // =========================================================
    //        // 8. CREATE NEW PACKAGE HISTORY
    //        // =========================================================

    //        var newHistory =
    //            new SubscriberPackageHistory
    //            {
    //                Id = Guid.NewGuid(),

    //                SubscriberId =
    //                    subscriber.Id,

    //                PackageId =
    //                    newPackage.Id,

    //                // Snapshot
    //                PackageName =
    //                    newPackage.PackageName,

    //                DownloadMbps =
    //                    newPackage.DownloadMbps,

    //                UploadMbps =
    //                    newPackage.UploadMbps,

    //                Price =
    //                    newPackage.Price,

    //                ValidityDays =
    //                    newPackage.ExpiryDays,

    //                Action =
    //                    oldHistory.Count > 0
    //                        ? "CHANGED"
    //                        : "ASSIGNED",

    //                AssignedAt =
    //                    DateTime.UtcNow,

    //                EndedAt = null,

    //                IsCurrent = true,

    //                Comment =
    //                    oldHistory.Count > 0
    //                        ? $"Package changed to {newPackage.PackageName}"
    //                        : $"Package assigned: {newPackage.PackageName}"
    //            };

    //        _context
    //            .SubscriberPackageHistories
    //            .Add(newHistory);

    //        // =========================================================
    //        // 9. CHECK ACTIVE RADIUS SESSION
    //        // =========================================================

    //        var activeSession =
    //            await _context
    //                .RadiusAccountingSessions
    //                .Where(x =>
    //                    x.SubscriberId == id &&
    //                    x.IsActive)
    //                .OrderByDescending(
    //                    x => x.LastUpdateTime)
    //                .FirstOrDefaultAsync();

    //        bool wasOnline =
    //            activeSession != null;

    //        bool coaAttempted = false;
    //        bool coaSuccess = false;
    //        bool disconnected = false;

    //        string connectionMessage;

    //        // =========================================================
    //        // 10. SAVE CHANGES & COMMIT TRANSACTION
    //        // =========================================================

    //        await _context.SaveChangesAsync();
    //        await dbTransaction.CommitAsync();

    //        // =========================================================
    //        // 11. IF USER IS ONLINE (Router Session Update)
    //        // =========================================================

    //        if (activeSession != null)
    //        {
    //            if (string.IsNullOrWhiteSpace(
    //                activeSession.AcctSessionId))
    //            {
    //                connectionMessage =
    //                    $"Package changed successfully (₹{packagePrice} deducted). Active RADIUS session does not have an Acct-Session-Id. Live speed update could not be attempted.";
    //            }
    //            else if (string.IsNullOrWhiteSpace(
    //                nas.SharedSecret))
    //            {
    //                connectionMessage =
    //                    $"Package changed successfully (₹{packagePrice} deducted). NAS RADIUS shared secret is missing. Live speed update could not be attempted.";
    //            }
    //            else
    //            {
    //                // =====================================================
    //                // RATE LIMIT
    //                // MikroTik/RADIUS format: Upload / Download
    //                // =====================================================

    //                string rateLimit =
    //                    $"{newPackage.UploadMbps}M/{newPackage.DownloadMbps}M";

    //                coaAttempted = true;

    //                // =====================================================
    //                // SEND COA
    //                // =====================================================

    //                var coaResult =
    //                    await _mikroTikService
    //                        .ChangePppRateLimitAsync(
    //                            nas.NasIpAddress,
    //                            nas.ApiPort,
    //                            nas.ApiUsername,
    //                            nas.ApiPassword,
    //                            activeSession.AcctSessionId,
    //                            rateLimit,
    //                            nas.SharedSecret);

    //                coaSuccess =
    //                    coaResult.Success;

    //                if (coaSuccess)
    //                {
    //                    connectionMessage =
    //                        $"Package changed to {newPackage.PackageName} (₹{packagePrice} deducted). " +
    //                        $"Live PPPoE session updated successfully to {rateLimit}. " +
    //                        $"Session {activeSession.AcctSessionId} remains connected.";
    //                }
    //                else
    //                {
    //                    // =================================================
    //                    // COA FAILED -> FALLBACK: DISCONNECT SESSION
    //                    // =================================================

    //                    var disconnectResult =
    //                        await _mikroTikService
    //                            .DisconnectPppSessionAsync(
    //                                nas.NasIpAddress,
    //                                nas.ApiPort,
    //                                nas.ApiUsername,
    //                                nas.ApiPassword,
    //                                subscriber.PPPoEUsername);

    //                    disconnected =
    //                        disconnectResult.Success;

    //                    if (disconnected)
    //                    {
    //                        connectionMessage =
    //                            $"Package changed to {newPackage.PackageName} (₹{packagePrice} deducted). " +
    //                            "Live speed update could not be applied, so the existing PPPoE session was disconnected. " +
    //                            "The next connection will use the new package.";
    //                    }
    //                    else
    //                    {
    //                        connectionMessage =
    //                            $"Package changed to {newPackage.PackageName} (₹{packagePrice} deducted), " +
    //                            $"but live speed update failed and the existing session could not be disconnected. " +
    //                            $"CoA: {coaResult.Message} | " +
    //                            $"Disconnect: {disconnectResult.Message}";
    //                    }
    //                }
    //            }
    //        }
    //        else
    //        {
    //            // =========================================================
    //            // USER OFFLINE
    //            // =========================================================

    //            connectionMessage =
    //                $"Package changed to {newPackage.PackageName} successfully (₹{packagePrice} deducted). " +
    //                "Subscriber is currently offline. The new package will be applied on the next connection.";
    //        }

    //        // =========================================================
    //        // 12. FINAL RESPONSE
    //        // =========================================================

    //        return Ok(new
    //        {
    //            success = true,
    //            packageChanged = true,
    //            subscriberId = subscriber.Id,
    //            oldPackageId = oldPackageId,
    //            newPackageId = newPackage.Id,
    //            packageName = newPackage.PackageName,
    //            downloadMbps = newPackage.DownloadMbps,
    //            uploadMbps = newPackage.UploadMbps,
    //            price = newPackage.Price,
    //            validityDays = newPackage.ExpiryDays,
    //            remainingWalletBalance = wallet.Balance,
    //            wasOnline,
    //            acctSessionId = activeSession?.AcctSessionId,
    //            coaAttempted,
    //            coaSuccess,
    //            disconnected,
    //            sessionContinued = wasOnline && coaSuccess,
    //            newConnectionRequired = wasOnline && coaAttempted && !coaSuccess && disconnected,
    //            message = connectionMessage
    //        });
    //    }
    //    catch (Exception ex)
    //    {
    //        await dbTransaction.RollbackAsync();
    //        return StatusCode(500, new
    //        {
    //            success = false,
    //            message = "An error occurred while changing the package and updating the wallet.",
    //            error = ex.Message,
    //            innerError = ex.InnerException?.Message
    //        });
    //    }
    //}

    //public class ChangeSubscriberPackageRequest
    //{
    //    public Guid PackageId { get; set; }
    //}
}