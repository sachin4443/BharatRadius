using RadiusSoftware.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.API.Services.MikroTik;
using RadiusSoftware.Core.DTOs;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;
using System.Diagnostics;
using System.Net.Sockets;
using System.Security.Claims;
using System.Text.Json;
using tik4net;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;
namespace RadiusSoftware.API.Controllers;

[Authorize]
[SiteScoped(ScopedResource.Nas, "id")]
[Route("api/[controller]")]
[ApiController]
public class NasController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IMikroTikService _mikroTikService;
    private readonly ILogger<NasController> _logger;

    public NasController(AppDbContext context, IConfiguration configuration,
    IMikroTikService mikroTikService, ILogger<NasController> logger)
    {
        _context = context;
        _configuration = configuration;
        _mikroTikService = mikroTikService;
        _logger = logger;
    }
    [HttpGet("list")]
    public async Task<IActionResult> GetNasList()
    {
        var orgIdStr = User.FindFirst("OrganizationId")?.Value;
        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                        ?? User.FindFirst("sub")?.Value;
        var isSuperAdmin = User.FindFirst("IsSuperAdmin")?.Value == "True";

        // 1. Super Admin -> Sabhi NAS dekhega
        if (isSuperAdmin)
        {
            var allNas = await _context.NasDevices
                .Include(n => n.Site)
                .ToListAsync();
            return Ok(allNas);
        }

        if (!Guid.TryParse(userIdStr, out var currentUserId))
            return Unauthorized();

        Guid? orgId = Guid.TryParse(orgIdStr, out var parsedOrgId) ? parsedOrgId : null;

        IQueryable<Site> siteQuery = _context.Sites.Where(s => !s.IsDeleted);

        var loggedInSite = await _context.Sites.FirstOrDefaultAsync(s => s.UserId == currentUserId && !s.IsDeleted);

        if (loggedInSite != null)
        {
            if (loggedInSite.SiteLevel == 0)
            {
                // 1. Level 0 (Org Owner) -> Poori organization ke saare sites dekhega
                siteQuery = siteQuery.Where(s => s.ParentOrganisationID == loggedInSite.ParentOrganisationID);
            }
            else if (loggedInSite.SiteLevel == 1)
            {
                // 2. Level 1 -> Sirf APNI BRANCH dekhgea (Apni site + Direct Children + Grandchildren)
                // Doosri Level 1 sites ya unke child isme nahi dikhenge.
                var directChildIds = await _context.Sites
                    .Where(s => s.ParentSiteId == loggedInSite.Id && !s.IsDeleted)
                    .Select(s => s.Id)
                    .ToListAsync();

                var grandChildIds = await _context.Sites
                    .Where(s => s.ParentSiteId.HasValue && directChildIds.Contains(s.ParentSiteId.Value) && !s.IsDeleted)
                    .Select(s => s.Id)
                    .ToListAsync();

                var allowedSiteIds = new List<Guid> { loggedInSite.Id };
                allowedSiteIds.AddRange(directChildIds);
                allowedSiteIds.AddRange(grandChildIds);

                siteQuery = siteQuery.Where(s => allowedSiteIds.Contains(s.Id));
            }
            else
            {
                // 3. Normal Site Admin (Level 2+) -> Apna site aur sirf apne direct children
                siteQuery = siteQuery.Where(s => s.Id == loggedInSite.Id || s.ParentSiteId == loggedInSite.Id);
            }
        }
        else if (orgId.HasValue)
        {
            // Agar user ka direct site mapping nahi hai, par Organization admin hai
            siteQuery = siteQuery.Where(s => s.ParentOrganisationID == orgId.Value);
        }
        else
        {
            return Ok(new List<NasDevice>());
        }

        // Unhi sites ke filter kiye huye IDs nikal lo
        var siteIds = await siteQuery.Select(s => s.Id).ToListAsync();

        // Ab unhi IDs ke basis par NAS fetch karo
        var nasList = await _context.NasDevices
            .Include(n => n.Site)
            .Where(n => siteIds.Contains(n.SiteId))
            .ToListAsync();

        return Ok(nasList);
    }
    //[HttpGet("list")]
    //public async Task<IActionResult> GetNasList()
    //{
    //    var orgIdStr = User.FindFirst("OrganizationId")?.Value;

    //    var userIdStr =
    //        User.FindFirst(ClaimTypes.NameIdentifier)?.Value
    //        ?? User.FindFirst("sub")?.Value;

    //    var isSuperAdmin =
    //        User.FindFirst("IsSuperAdmin")?.Value == "True";

    //    // Super Admin -> sab NAS
    //    if (isSuperAdmin)
    //    {
    //        var allNas = await _context.NasDevices
    //            .Include(n => n.Site)
    //            .ToListAsync();

    //        return Ok(allNas);
    //    }

    //    if (!Guid.TryParse(userIdStr, out var currentUserId))
    //        return Unauthorized();

    //    IQueryable<Site> siteQuery = _context.Sites
    //        .Where(s => !s.IsDeleted);

    //    // Organization ID
    //    Guid? orgId = null;

    //    if (Guid.TryParse(orgIdStr, out var parsedOrgId))
    //    {
    //        orgId = parsedOrgId;
    //    }

    //    // Check karo current user ki apni site hai ya nahi
    //    var loggedInSite = await _context.Sites
    //        .FirstOrDefaultAsync(s =>
    //            s.UserId == currentUserId &&
    //            !s.IsDeleted);

    //    if (loggedInSite != null)
    //    {
    //        // User Site Admin hai
    //        // Is user ko apni site ke child sites ke NAS dikhenge
    //        siteQuery = siteQuery.Where(s =>
    //            s.ParentSiteId == loggedInSite.Id);
    //    }
    //    else if (orgId.HasValue)
    //    {
    //        // Organization Admin
    //        siteQuery = siteQuery.Where(s =>
    //            s.ParentOrganisationID == orgId.Value &&
    //            s.ParentSiteId == null);
    //    }
    //    else
    //    {
    //        return Ok(new List<NasDevice>());
    //    }

    //    // User ko jo sites allowed hain unki IDs
    //    var siteIds = await siteQuery
    //        .Select(s => s.Id)
    //        .ToListAsync();

    //    // Ab unhi sites ke NAS
    //    var nasList = await _context.NasDevices
    //        .Include(n => n.Site)
    //        .Where(n => siteIds.Contains(n.SiteId))
    //        .ToListAsync();

    //    return Ok(nasList);
    //}

    [HttpPost("save")]
    public async Task<IActionResult> SaveNas([FromBody] NasDeviceDto model)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                            ?? User.FindFirst("sub")?.Value;

            if (!Guid.TryParse(userIdStr, out var currentUserId))
                return Unauthorized(new { message = "Invalid logged-in user." });

            // ✨ Direct logic: Jo login hai uski site nikal lo
            var userSite = await _context.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == currentUserId && !s.IsDeleted);
            if (userSite == null) return BadRequest(new { message = "No site is assigned to this user." });

            Guid siteId = userSite.Id;

            if (model.Id == Guid.Empty)
            {
                var nas = new NasDevice
                {
                    Id = Guid.NewGuid(),
                    SiteId = siteId, // 🔥 Seedha login user ki site
                    NasName = model.NasName,
                    NasType = model.NasType,
                    NasIpAddress = model.NasIpAddress,
                    SharedSecret = model.SharedSecret,
                    CoaPort = model.CoaPort,
                    InterimTime = model.InterimTime,
                    IsEnabled = model.IsEnabled,
                    ApiUsername = model.ApiUsername,
                    ApiPassword = model.ApiPassword,
                    ApiPort = model.ApiPort,
                    WinboxPort = model.WinboxPort,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.NasDevices.Add(nas);
            }
            else
            {
                var nas = await _context.NasDevices.FindAsync(model.Id);
                if (nas == null) return NotFound(new { message = "NAS device not found" });

                nas.SiteId = siteId; // 🔥 Locked to login user's site
                nas.NasName = model.NasName;
                nas.NasType = model.NasType;
                nas.NasIpAddress = model.NasIpAddress;
                nas.SharedSecret = model.SharedSecret;
                nas.CoaPort = model.CoaPort;
                nas.InterimTime = model.InterimTime;
                nas.IsEnabled = model.IsEnabled;
                nas.ApiUsername = model.ApiUsername;
                nas.ApiPassword = model.ApiPassword;
                nas.ApiPort = model.ApiPort;
                nas.WinboxPort = model.WinboxPort;
                nas.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "NAS Device saved successfully!" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Internal server error: " + ex.Message });
        }
    }

    [HttpPost("test-connection/{id}")]
    public async Task<IActionResult> TestConnection(Guid id)
    {
        var nas = await _context.NasDevices.FindAsync(id);
        if (nas == null) return NotFound(new { message = "NAS not found" });

        bool isOnline = false;
        try
        {
            using var client = new TcpClient();
            // MikroTik API Port (default 8728) par socket connect karke check karte hain
            var result = client.BeginConnect(nas.NasIpAddress, nas.ApiPort, null, null);
            isOnline = result.AsyncWaitHandle.WaitOne(TimeSpan.FromSeconds(3));
            client.EndConnect(result);
        }
        catch
        {
            isOnline = false;
        }

        nas.IsOnline = isOnline;
        nas.LastSeen = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { isOnline, message = isOnline ? "Router is Online & Reachable!" : "Connection Failed / Offline" });
    }

    [HttpDelete("delete/{id}")]
    public async Task<IActionResult> DeleteNas(Guid id)
    {
        var nas = await _context.NasDevices.FindAsync(id);
        if (nas == null) return NotFound();

        _context.NasDevices.Remove(nas);
        await _context.SaveChangesAsync();
        return Ok(new { message = "NAS deleted successfully!" });
    }

    [HttpPost("fetch-router-info/{id}")]
    public async Task<IActionResult> FetchRouterInfo(Guid id)
    {
        var nas = await _context.NasDevices.FindAsync(id);
        if (nas == null) return NotFound(new { message = "NAS not found" });

        try
        {
            var routerStats = await RouterApi.RunAsync<object>(nas, connection =>
            {

                // Fetch system resource and details
                var identity = connection.CreateCommand("/system/identity/print").ExecuteScalar("name")?.ToString() ?? nas.NasName;
                var resRow = connection.CreateCommand("/system/resource/print").ExecuteSingleRow();
                var routerBoardRow = connection.CreateCommand("/system/routerboard/print").ExecuteSingleRow();

                string version = resRow?.Words.ContainsKey("version") == true ? resRow.Words["version"] : "N/A";
                string cpuModel = resRow?.Words.ContainsKey("cpu") == true ? resRow.Words["cpu"] : "N/A";
                string cpuCount = resRow?.Words.ContainsKey("cpu-count") == true ? resRow.Words["cpu-count"] : "1";
                string cpuFrequency = resRow?.Words.ContainsKey("cpu-frequency") == true ? resRow.Words["cpu-frequency"] + " MHz" : "N/A";

                string cpuLoadVal = resRow?.Words.ContainsKey("cpu-load") == true ? resRow.Words["cpu-load"] : "0";
                string uptime = resRow?.Words.ContainsKey("uptime") == true ? resRow.Words["uptime"] : "N/A";
                string architecture = resRow?.Words.ContainsKey("architecture-name") == true ? resRow.Words["architecture-name"] : "N/A";

                string board = routerBoardRow?.Words.ContainsKey("board-name") == true ? routerBoardRow.Words["board-name"] : "MikroTik";
                string model = routerBoardRow?.Words.ContainsKey("model") == true ? routerBoardRow.Words["model"] : "N/A";
                string serial = routerBoardRow?.Words.ContainsKey("serial-number") == true ? routerBoardRow.Words["serial-number"] : "N/A";
                string firmware = routerBoardRow?.Words.ContainsKey("current-firmware") == true ? routerBoardRow.Words["current-firmware"] : "N/A";

                long totalMem = resRow?.Words.ContainsKey("total-memory") == true ? Convert.ToInt64(resRow.Words["total-memory"]) : 0;
                long freeMem = resRow?.Words.ContainsKey("free-memory") == true ? Convert.ToInt64(resRow.Words["free-memory"]) : 0;
                long totalHdd = resRow?.Words.ContainsKey("total-hdd-space") == true ? Convert.ToInt64(resRow.Words["total-hdd-space"]) : 0;
                long freeHdd = resRow?.Words.ContainsKey("free-hdd-space") == true ? Convert.ToInt64(resRow.Words["free-hdd-space"]) : 0;

                // Fast PPPoE count using tik4net CreateCommandAndParameters
                int totalSecrets = 0;
                int activePppoe = 0;

                try
                {
                    var secretCmd = connection.CreateCommandAndParameters("/ppp/secret/print", "count-only", "");
                    totalSecrets = Convert.ToInt32(secretCmd.ExecuteScalar() ?? "0");

                    var activeCmd = connection.CreateCommandAndParameters("/ppp/active/print", "count-only", "");
                    activePppoe = Convert.ToInt32(activeCmd.ExecuteScalar() ?? "0");
                }
                catch
                {
                    totalSecrets = 0;
                    activePppoe = 0;
                }

                int offlineSecrets = totalSecrets - activePppoe;
                int cpuLoadNum = 0;
                int.TryParse(cpuLoadVal, out cpuLoadNum);

                return new
                {
                    success = true,
                    identity,
                    version,
                    architecture,
                    board,
                    model,
                    serial,
                    firmware,
                    cpuModel,
                    cpuCount,
                    cpuFrequency,
                    cpuLoad = cpuLoadVal + "%",
                    cpuLoadNum = cpuLoadNum,
                    uptime,
                    totalMemory = FormatBytes(totalMem),
                    freeMemory = FormatBytes(freeMem),
                    usedMemory = FormatBytes(totalMem - freeMem),
                    memUsageNum = totalMem > 0 ? (int)(((totalMem - freeMem) * 100) / totalMem) : 0,
                    totalHdd = FormatBytes(totalHdd),
                    freeHdd = FormatBytes(freeHdd),
                    ip = nas.NasIpAddress,
                    apiPort = nas.ApiPort,
                    winboxPort = nas.WinboxPort,
                    totalSecrets = totalSecrets,
                    activePppoe = activePppoe,
                    offlineSecrets = offlineSecrets,
                    rxBps = "0 bps",
                    txBps = "0 bps"
                };
            });

            nas.IsOnline = true;
            nas.LastSeen = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(routerStats);
        }
        catch (Exception ex)
        {
            nas.IsOnline = false;
            await _context.SaveChangesAsync();
            return BadRequest(new
            {
                success = false,
                message = ex is RouterUnreachableException ? ex.Message : "Connection error or timeout"
            });
        }
    }
    // =========================================================
    // MIKROTIK INTERFACES (for the graph interface dropdown)
    // GET api/Nas/interfaces/{id}
    // =========================================================
    [HttpGet("interfaces/{id}")]
    public async Task<IActionResult> GetInterfaces(Guid id)
    {
        var nas = await _context.NasDevices.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id);
        if (nas == null) return NotFound(new { message = "NAS not found" });

        try
        {
            var list = await RouterApi.RunAsync(nas, connection =>
            {
                var cmd = connection.CreateCommandAndParameters("/interface/print", ".proplist", "name,type,running,disabled,comment");
                return cmd.ExecuteList()
                    .Select(row => new
                    {
                        name = RouterApi.Word(row, "name"),
                        type = RouterApi.Word(row, "type"),
                        running = RouterApi.Word(row, "running") == "true",
                        disabled = RouterApi.Word(row, "disabled") == "true",
                        comment = RouterApi.Word(row, "comment")
                    })
                    // dynamic pppoe-in interfaces of subscribers are not useful here
                    .Where(i => !string.IsNullOrEmpty(i.name) && i.type != "pppoe-in")
                    .ToList();
            });

            var saved = (nas.DashboardInterfaces ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            return Ok(new { success = true, interfaces = list, dashboardInterfaces = saved });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = "Unable to read interfaces from router: " + ex.Message });
        }
    }

    public class DashboardInterfacesDto
    {
        public List<string> Interfaces { get; set; } = new();
    }

    // =========================================================
    // SAVE INTERFACES SHOWN ON THE DASHBOARD
    // PUT api/Nas/dashboard-interfaces/{id}
    // =========================================================
    [HttpPut("dashboard-interfaces/{id}")]
    public async Task<IActionResult> SaveDashboardInterfaces(Guid id, [FromBody] DashboardInterfacesDto dto)
    {
        var nas = await _context.NasDevices.FirstOrDefaultAsync(n => n.Id == id);
        if (nas == null) return NotFound(new { message = "NAS not found" });

        var names = (dto.Interfaces ?? new List<string>())
            .Select(x => x.Trim()).Where(x => x.Length > 0 && x.Length <= 64 && !x.Contains(','))
            .Distinct().Take(12).ToList();

        nas.DashboardInterfaces = string.Join(",", names);
        nas.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(new { success = true, message = "Dashboard interfaces saved.", interfaces = names });
    }

    // =========================================================
    // LIVE TRAFFIC OF SEVERAL INTERFACES AT ONCE (1 second sample)
    // GET api/Nas/interface-traffic/{id}?interfaces=ether1,sfp1
    // =========================================================
    [HttpGet("interface-traffic/{id}")]
    public async Task<IActionResult> GetInterfaceTraffic(Guid id, [FromQuery] string? interfaces)
    {
        var nas = await _context.NasDevices.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id);
        if (nas == null) return NotFound(new { message = "NAS not found" });

        var wanted = (interfaces ?? nas.DashboardInterfaces ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct().Take(12).ToList();
        if (wanted.Count == 0)
            return Ok(new { success = true, items = Array.Empty<object>() });

        try
        {
            var traffic = await RouterApi.RunAsync(nas, connection => RouterApi.InterfaceTraffic(connection, wanted));

            var items = wanted.Select(name =>
            {
                traffic.TryGetValue(name, out var t);
                return new
                {
                    name,
                    found = traffic.ContainsKey(name),
                    rx = t.rx,
                    tx = t.tx,
                    rxBps = FormatBandwidth(t.rx),
                    txBps = FormatBandwidth(t.tx)
                };
            }).ToList();

            return Ok(new { success = true, time = DateTime.UtcNow, items });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = "Unable to read traffic from router: " + ex.Message });
        }
    }

    // Single interface traffic for the "Real-time traffic" graph.
    // POST api/Nas/live-traffic/{id}?interface=ether1
    [HttpPost("live-traffic/{id}")]
    public async Task<IActionResult> GetLiveTraffic(Guid id, [FromQuery(Name = "interface")] string? interfaceName = null)
    {
        var nas = await _context.NasDevices.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id);
        if (nas == null)
            return NotFound(new { message = "NAS not found" });

        // Interface chosen in the graph dropdown, else the first dashboard interface
        var monitorInterface =
            !string.IsNullOrWhiteSpace(interfaceName)
                ? interfaceName.Trim()
                : (nas.DashboardInterfaces ?? "")
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .FirstOrDefault() ?? "ether1";

        try
        {
            var traffic = await RouterApi.RunAsync(nas, connection =>
                RouterApi.InterfaceTraffic(connection, new[] { monitorInterface }));

            if (!traffic.TryGetValue(monitorInterface, out var t))
            {
                return BadRequest(new { success = false, message = $"Interface '{monitorInterface}' not found on {nas.NasName}." });
            }

            return Ok(new
            {
                success = true,
                @interface = monitorInterface,
                rx = t.rx,
                tx = t.tx,
                rxBps = FormatBandwidth(t.rx),
                txBps = FormatBandwidth(t.tx)
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    private string FormatBytes(long bytes)
    {
        if (bytes == 0) return "0 GB";
        double gb = (double)bytes / (1024 * 1024 * 1024);
        if (gb < 1) return Math.Round((double)bytes / (1024 * 1024), 1) + " MB";
        return Math.Round(gb, 1) + " GB";
    }

    private string FormatBandwidth(long bps)
    {
        if (bps >= 1000000000)
            return $"{bps / 1000000000.0:F2} Gbps";

        if (bps >= 1000000)
            return $"{bps / 1000000.0:F2} Mbps";

        if (bps >= 1000)
            return $"{bps / 1000.0:F2} Kbps";

        return $"{bps} bps";
    }

    [HttpPost("live-ping/{id}")]
    public async Task<IActionResult> GetLivePing(Guid id, [FromQuery] string target = "8.8.8.8")
    {
        var nas = await _context.NasDevices.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id);
        if (nas == null)
            return NotFound(new { message = "NAS not found" });

        target = (target ?? "8.8.8.8").Trim();
        if (target.Length > 253 || target.Any(c => !(char.IsLetterOrDigit(c) || c is '.' or '-' or ':')))
            return BadRequest(new { success = false, message = "Invalid ping target." });

        try
        {
            var rows = await RouterApi.RunAsync(nas, connection =>
                connection.CreateCommandAndParameters("/ping", "address", target, "count", "3").ExecuteList().ToList(),
                timeoutMs: 8000);

            var last = rows.LastOrDefault();
            if (last == null)
                return BadRequest(new { success = false, message = "No ping reply." });

            double.TryParse(RouterApi.Word(last, "packet-loss"), System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var loss);

            return Ok(new
            {
                success = true,
                latency = RouterApi.ParseMs(RouterApi.Word(last, "time")),
                min = RouterApi.ParseMs(RouterApi.Word(last, "min-rtt")),
                avg = RouterApi.ParseMs(RouterApi.Word(last, "avg-rtt")),
                max = RouterApi.ParseMs(RouterApi.Word(last, "max-rtt")),
                packetLoss = loss,
                target
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    // =========================================================
    // ACTIVE PPPoE SESSIONS ON THE ROUTER (to compare with RADIUS)
    // GET api/Nas/ppp-active/{id}
    // =========================================================
    [HttpGet("ppp-active/{id}")]
    public async Task<IActionResult> GetPppActiveCount(Guid id)
    {
        var nas = await _context.NasDevices.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id);
        if (nas == null) return NotFound(new { message = "NAS not found" });

        try
        {
            var count = await RouterApi.RunAsync(nas, connection =>
            {
                var value = connection.CreateCommandAndParameters("/ppp/active/print", "count-only", "").ExecuteScalar();
                return int.TryParse(value?.ToString(), out var n) ? n : 0;
            });
            return Ok(new { success = true, nasId = id, routerActive = count });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpPost("configure/{id}")]
    public async Task<IActionResult> ConfigureNas(Guid id)
    {
        var nas = await _context.NasDevices
            .FirstOrDefaultAsync(n => n.Id == id);

        if (nas == null)
        {
            return NotFound(new
            {
                success = false,
                message = "NAS device not found."
            });
        }

        if (!nas.IsEnabled)
        {
            return BadRequest(new
            {
                success = false,
                message = "NAS device is disabled."
            });
        }

        try
        {
            // =====================================================
            // CONFIGURATION START
            // =====================================================

            nas.RadiusStatus = "CONFIGURING";
            nas.RadiusConfigError = null;
            nas.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // =====================================================
            // 1. MIKROTIK API CONNECTION
            // =====================================================

            var connectionResult =
                await _mikroTikService.TestConnectionAsync(
                    nas.NasIpAddress,
                    nas.ApiPort,
                    nas.ApiUsername,
                    nas.ApiPassword);

            if (!connectionResult.Success)
            {
                nas.RadiusStatus = "FAILED";
                nas.RadiusConfigError =
                    connectionResult.Message;
                nas.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return BadRequest(new
                {
                    success = false,
                    step = "API_CONNECTION",
                    message = connectionResult.Message
                });
            }

            // Router is reachable
            nas.IsOnline = true;
            nas.LastSeen = DateTime.UtcNow;

            // =====================================================
            // 2. ACTUAL RADIUS CONFIGURATION
            // =====================================================

            var radiusResult =
                await _mikroTikService.ConfigureRadiusAsync(
                    nas.NasIpAddress,
                    nas.ApiPort,
                    nas.ApiUsername,
                    nas.ApiPassword,
                    GetRadiusServerIp(),
                    GetRadiusAuthenticationPort(),
                    GetRadiusAccountingPort(),
                    nas.SharedSecret);

            if (!radiusResult.Success)
            {
                nas.RadiusStatus = "FAILED";
                nas.RadiusConfigError =
                    radiusResult.Message;
                nas.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return BadRequest(new
                {
                    success = false,
                    step = "RADIUS_CONFIGURATION",
                    message = radiusResult.Message
                });
            }

            // =====================================================
            // 3. PPP AAA CONFIGURATION
            // =====================================================

            var pppAaaResult =
                await _mikroTikService.ConfigurePppAaaAsync(
                    nas.NasIpAddress,
                    nas.ApiPort,
                    nas.ApiUsername,
                    nas.ApiPassword,
                    nas.InterimTime);

            if (!pppAaaResult.Success)
            {
                nas.RadiusStatus = "FAILED";
                nas.RadiusConfigError =
                    pppAaaResult.Message;
                nas.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return BadRequest(new
                {
                    success = false,
                    step = "PPP_AAA_CONFIGURATION",
                    message = pppAaaResult.Message
                });
            }

            // =====================================================
            // 3.5 SYSLOG / FIREWALL LOGGING CONFIGURATION
            // =====================================================
            var syslogResult = await _mikroTikService.ConfigureSyslogAsync(
                nas.NasIpAddress,
                nas.ApiPort,
                nas.ApiUsername,
                nas.ApiPassword,
                GetRadiusServerIp(), // Aapke server ka IP jahan syslog listen karega
                514                  // Default Syslog Port
            );

            if (!syslogResult.Success)
            {
                nas.RadiusStatus = "FAILED";
                nas.RadiusConfigError = syslogResult.Message;
                nas.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return BadRequest(new
                {
                    success = false,
                    step = "SYSLOG_CONFIGURATION",
                    message = syslogResult.Message
                });
            }

            // =====================================================
            // 4. VERIFY RADIUS
            // =====================================================

            var radiusVerification =
                await _mikroTikService.VerifyRadiusConfigurationAsync(
                    nas.NasIpAddress,
                    nas.ApiPort,
                    nas.ApiUsername,
                    nas.ApiPassword,
                    GetRadiusServerIp(),
                    nas.SharedSecret);

            if (!radiusVerification.Success)
            {
                nas.RadiusStatus = "FAILED";
                nas.RadiusConfigError =
                    radiusVerification.Message;
                nas.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return BadRequest(new
                {
                    success = false,
                    step = "RADIUS_VERIFICATION",
                    message = radiusVerification.Message
                });
            }

            // =====================================================
            // 5. VERIFY PPP AAA
            // =====================================================

            var pppAaaVerification =
                await _mikroTikService.VerifyPppAaaConfigurationAsync(
                    nas.NasIpAddress,
                    nas.ApiPort,
                    nas.ApiUsername,
                    nas.ApiPassword);

            if (!pppAaaVerification.Success)
            {
                nas.RadiusStatus = "FAILED";
                nas.RadiusConfigError =
                    pppAaaVerification.Message;
                nas.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return BadRequest(new
                {
                    success = false,
                    step = "PPP_AAA_VERIFICATION",
                    message = pppAaaVerification.Message
                });
            }

            // =====================================================
            // 6. EVERYTHING SUCCESSFUL
            // =====================================================

            nas.IsRadiusConfigured = true;
            nas.IsAccountingConfigured = true;

            nas.RadiusStatus = "CONFIGURED";

            nas.RadiusConfigError = null;

            nas.RadiusConfiguredAt =
                DateTime.UtcNow;

            nas.RadiusLastVerifiedAt =
                DateTime.UtcNow;

            nas.IsOnline = true;
            nas.LastSeen = DateTime.UtcNow;

            nas.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                configured = true,

                message =
                    "MikroTik RADIUS, PPP AAA and Syslog configuration completed successfully.",

                router = new
                {
                    nas.Id,
                    nas.NasName,
                    nas.NasIpAddress,
                    Identity = connectionResult.Identity,
                    Version = connectionResult.Version
                },

                radius = new
                {
                    configured = true,
                    authenticationPort =
                        GetRadiusAuthenticationPort(),

                    accountingPort =
                        GetRadiusAccountingPort(),

                    server =
                        GetRadiusServerIp()
                },

                pppAaa = new
                {
                    radiusAuthentication = true,
                    accounting = true,
                    interimTime = nas.InterimTime
                },

                status = nas.RadiusStatus
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "NAS configuration failed for {NasId}",
                id);

            nas.RadiusStatus = "FAILED";
            nas.RadiusConfigError = ex.Message;
            nas.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return StatusCode(500, new
            {
                success = false,
                message =
                    "NAS RADIUS configuration failed.",

                error = ex.Message
            });
        }
    }
    //[HttpPost("configure/{id}")]
    //public async Task<IActionResult> ConfigureNas(Guid id)
    //{
    //    var nas = await _context.NasDevices
    //        .FirstOrDefaultAsync(n => n.Id == id);

    //    if (nas == null)
    //    {
    //        return NotFound(new
    //        {
    //            success = false,
    //            message = "NAS device not found."
    //        });
    //    }

    //    if (!nas.IsEnabled)
    //    {
    //        return BadRequest(new
    //        {
    //            success = false,
    //            message = "NAS device is disabled."
    //        });
    //    }

    //    try
    //    {
    //        // =====================================================
    //        // CONFIGURATION START
    //        // =====================================================

    //        nas.RadiusStatus = "CONFIGURING";
    //        nas.RadiusConfigError = null;
    //        nas.UpdatedAt = DateTime.UtcNow;

    //        await _context.SaveChangesAsync();

    //        // =====================================================
    //        // 1. MIKROTIK API CONNECTION
    //        // =====================================================

    //        var connectionResult =
    //            await _mikroTikService.TestConnectionAsync(
    //                nas.NasIpAddress,
    //                nas.ApiPort,
    //                nas.ApiUsername,
    //                nas.ApiPassword);

    //        if (!connectionResult.Success)
    //        {
    //            nas.RadiusStatus = "FAILED";
    //            nas.RadiusConfigError =
    //                connectionResult.Message;
    //            nas.UpdatedAt = DateTime.UtcNow;

    //            await _context.SaveChangesAsync();

    //            return BadRequest(new
    //            {
    //                success = false,
    //                step = "API_CONNECTION",
    //                message = connectionResult.Message
    //            });
    //        }

    //        // Router is reachable
    //        nas.IsOnline = true;
    //        nas.LastSeen = DateTime.UtcNow;

    //        // =====================================================
    //        // 2. ACTUAL RADIUS CONFIGURATION
    //        // =====================================================

    //        var radiusResult =
    //            await _mikroTikService.ConfigureRadiusAsync(
    //                nas.NasIpAddress,
    //                nas.ApiPort,
    //                nas.ApiUsername,
    //                nas.ApiPassword,
    //                GetRadiusServerIp(),
    //                GetRadiusAuthenticationPort(),
    //                GetRadiusAccountingPort(),
    //                nas.SharedSecret);

    //        if (!radiusResult.Success)
    //        {
    //            nas.RadiusStatus = "FAILED";
    //            nas.RadiusConfigError =
    //                radiusResult.Message;
    //            nas.UpdatedAt = DateTime.UtcNow;

    //            await _context.SaveChangesAsync();

    //            return BadRequest(new
    //            {
    //                success = false,
    //                step = "RADIUS_CONFIGURATION",
    //                message = radiusResult.Message
    //            });
    //        }

    //        // =====================================================
    //        // 3. PPP AAA CONFIGURATION
    //        // =====================================================

    //        var pppAaaResult =
    //            await _mikroTikService.ConfigurePppAaaAsync(
    //                nas.NasIpAddress,
    //                nas.ApiPort,
    //                nas.ApiUsername,
    //                nas.ApiPassword,
    //                nas.InterimTime);

    //        if (!pppAaaResult.Success)
    //        {
    //            nas.RadiusStatus = "FAILED";
    //            nas.RadiusConfigError =
    //                pppAaaResult.Message;
    //            nas.UpdatedAt = DateTime.UtcNow;

    //            await _context.SaveChangesAsync();

    //            return BadRequest(new
    //            {
    //                success = false,
    //                step = "PPP_AAA_CONFIGURATION",
    //                message = pppAaaResult.Message
    //            });
    //        }

    //        // =====================================================
    //        // 4. VERIFY RADIUS
    //        // =====================================================

    //        var radiusVerification =
    //            await _mikroTikService.VerifyRadiusConfigurationAsync(
    //                nas.NasIpAddress,
    //                nas.ApiPort,
    //                nas.ApiUsername,
    //                nas.ApiPassword,
    //                GetRadiusServerIp(),
    //                nas.SharedSecret);

    //        if (!radiusVerification.Success)
    //        {
    //            nas.RadiusStatus = "FAILED";
    //            nas.RadiusConfigError =
    //                radiusVerification.Message;
    //            nas.UpdatedAt = DateTime.UtcNow;

    //            await _context.SaveChangesAsync();

    //            return BadRequest(new
    //            {
    //                success = false,
    //                step = "RADIUS_VERIFICATION",
    //                message = radiusVerification.Message
    //            });
    //        }

    //        // =====================================================
    //        // 5. VERIFY PPP AAA
    //        // =====================================================

    //        var pppAaaVerification =
    //            await _mikroTikService.VerifyPppAaaConfigurationAsync(
    //                nas.NasIpAddress,
    //                nas.ApiPort,
    //                nas.ApiUsername,
    //                nas.ApiPassword);

    //        if (!pppAaaVerification.Success)
    //        {
    //            nas.RadiusStatus = "FAILED";
    //            nas.RadiusConfigError =
    //                pppAaaVerification.Message;
    //            nas.UpdatedAt = DateTime.UtcNow;

    //            await _context.SaveChangesAsync();

    //            return BadRequest(new
    //            {
    //                success = false,
    //                step = "PPP_AAA_VERIFICATION",
    //                message = pppAaaVerification.Message
    //            });
    //        }

    //        // =====================================================
    //        // 6. EVERYTHING SUCCESSFUL
    //        // =====================================================

    //        nas.IsRadiusConfigured = true;
    //        nas.IsAccountingConfigured = true;

    //        nas.RadiusStatus = "CONFIGURED";

    //        nas.RadiusConfigError = null;

    //        nas.RadiusConfiguredAt =
    //            DateTime.UtcNow;

    //        nas.RadiusLastVerifiedAt =
    //            DateTime.UtcNow;

    //        nas.IsOnline = true;
    //        nas.LastSeen = DateTime.UtcNow;

    //        nas.UpdatedAt = DateTime.UtcNow;

    //        await _context.SaveChangesAsync();

    //        return Ok(new
    //        {
    //            success = true,
    //            configured = true,

    //            message =
    //                "MikroTik RADIUS and PPP AAA configuration completed successfully.",

    //            router = new
    //            {
    //                nas.Id,
    //                nas.NasName,
    //                nas.NasIpAddress,
    //                Identity = connectionResult.Identity,
    //                Version = connectionResult.Version
    //            },

    //            radius = new
    //            {
    //                configured = true,
    //                authenticationPort =
    //                    GetRadiusAuthenticationPort(),

    //                accountingPort =
    //                    GetRadiusAccountingPort(),

    //                server =
    //                    GetRadiusServerIp()
    //            },

    //            pppAaa = new
    //            {
    //                radiusAuthentication = true,
    //                accounting = true,
    //                interimTime = nas.InterimTime
    //            },

    //            status = nas.RadiusStatus
    //        });
    //    }
    //    catch (Exception ex)
    //    {
    //        _logger.LogError(
    //            ex,
    //            "NAS configuration failed for {NasId}",
    //            id);

    //        nas.RadiusStatus = "FAILED";
    //        nas.RadiusConfigError = ex.Message;
    //        nas.UpdatedAt = DateTime.UtcNow;

    //        await _context.SaveChangesAsync();

    //        return StatusCode(500, new
    //        {
    //            success = false,
    //            message =
    //                "NAS RADIUS configuration failed.",

    //            error = ex.Message
    //        });
    //    }
    //}

    private string GetRadiusServerIp()
    {
        return _configuration["RadiusServer:ServerAddress"]
            ?? throw new InvalidOperationException(
                "RadiusServer:ServerAddress is not configured.");
    }

    private int GetRadiusAuthenticationPort()
    {
        return int.TryParse(
            _configuration["RadiusServer:AuthenticationPort"],
            out var port)
            ? port
            : 1812;
    }

    private int GetRadiusAccountingPort()
    {
        return int.TryParse(
            _configuration["RadiusServer:AccountingPort"],
            out var port)
            ? port
            : 1813;
    }
}