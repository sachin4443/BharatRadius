using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Infrastructure.Data;
using tik4net;
using RadiusSoftware.API.Services.MikroTik;

namespace RadiusSoftware.API.Services;

public interface ISubscriberConnectionService
{
    Task<SubscriberConnectionResult> EnableAsync(Guid subscriberId);

    Task<SubscriberConnectionResult> DisableAsync(Guid subscriberId);

    Task<SubscriberLiveResult?> GetLiveAsync(Guid subscriberId);
}

public sealed class SubscriberConnectionService
    : ISubscriberConnectionService
{
    private readonly AppDbContext _context;
    private readonly ILogger<SubscriberConnectionService> _logger;
    private readonly IMikroTikService _mikroTikService;

    public SubscriberConnectionService(
      AppDbContext context,
      ILogger<SubscriberConnectionService> logger,
      IMikroTikService mikroTikService)
    {
        _context = context;
        _logger = logger;
        _mikroTikService = mikroTikService;
    }

    // =========================================================
    // ENABLE SUBSCRIBER
    // =========================================================

    public async Task<SubscriberConnectionResult> EnableAsync(
        Guid subscriberId)
    {
        var subscriber = await _context.Subscribers
            .FirstOrDefaultAsync(x => x.Id == subscriberId);

        if (subscriber == null)
            return Fail("Subscriber not found.");

        if (!subscriber.IsActive)
            return Fail("Subscriber is disabled.");

        if (subscriber.NasId == null)
            return Fail(
                "No MikroTik NAS is assigned to this subscriber.");

        if (string.IsNullOrWhiteSpace(
                subscriber.PPPoEUsername))
        {
            return Fail(
                "PPPoE username is missing.");
        }

        if (string.IsNullOrWhiteSpace(
                subscriber.PPPoEPassword))
        {
            return Fail(
                "PPPoE password is missing.");
        }

        var nas = await _context.NasDevices
            .FirstOrDefaultAsync(x =>
                x.Id == subscriber.NasId);

        if (nas == null)
            return Fail(
                "Assigned NAS was not found.");

        if (!nas.IsEnabled)
            return Fail(
                "Assigned NAS is disabled.");

        try
        {
            // =================================================
            // MIKROTIK API CONNECTION
            // =================================================

            using var connection =
                ConnectionFactory.CreateConnection(
                    TikConnectionType.Api);

            connection.Open(
                nas.NasIpAddress,
                nas.ApiPort,
                nas.ApiUsername,
                nas.ApiPassword);

            // =================================================
            // LOCAL PPP SECRET
            //
            // RADIUS should be the authentication source.
            //
            // If same username exists as an enabled local
            // PPP secret, RouterOS can authenticate locally.
            //
            // Therefore disable duplicate local secret.
            // =================================================

            var secretPrint =
                connection.CreateCommand(
                    "/ppp/secret/print");

            var secrets =
                secretPrint.ExecuteList();

            foreach (var secret in secrets)
            {
                var name =
                    secret.GetResponseField("name")
                        ?.ToString() ?? "";

                if (!string.Equals(
                        name,
                        subscriber.PPPoEUsername,
                        StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var secretId =
                    secret.GetResponseField(".id")
                        ?.ToString() ?? "";

                if (string.IsNullOrWhiteSpace(secretId))
                    continue;

                var disableCommand =
                    connection.CreateCommand(
                        "/ppp/secret/set");

                disableCommand.AddParameter(
                    ".id",
                    secretId);

                disableCommand.AddParameter(
                    "disabled",
                    "yes");

                disableCommand.ExecuteNonQuery();

                _logger.LogInformation(
                    "Disabled local PPP secret {Username} on NAS {Nas}",
                    subscriber.PPPoEUsername,
                    nas.NasName);
            }

            // =================================================
            // ENABLE CONNECTION IN OUR DATABASE
            // =================================================

            subscriber.ConnectionEnabled = true;
            subscriber.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // =================================================
            // CHECK EXISTING PPP ACTIVE SESSION
            // =================================================

            var activeCommand =
                connection.CreateCommand(
                    "/ppp/active/print");

            activeCommand.AddParameter(
                "name",
                subscriber.PPPoEUsername);

            var active =
                activeCommand
                    .ExecuteList()
                    .FirstOrDefault();

            // =================================================
            // IF ALREADY CONNECTED
            // DISCONNECT SO IT RECONNECTS THROUGH RADIUS
            // =================================================

            if (active != null)
            {
                var activeId =
                    active.GetResponseField(".id")
                        ?.ToString();

                if (!string.IsNullOrWhiteSpace(activeId))
                {
                    var removeCommand =
                        connection.CreateCommand(
                            "/ppp/active/remove");

                    removeCommand.AddParameter(
                        ".id",
                        activeId);

                    removeCommand.ExecuteNonQuery();

                    _logger.LogInformation(
                        "Disconnected existing PPP session for {Username} on {Nas}",
                        subscriber.PPPoEUsername,
                        nas.NasName);
                }
            }

            return new SubscriberConnectionResult
            {
                Success = true,
                Enabled = true,

                Message =
                    "Subscriber connection enabled. " +
                    "Existing session was disconnected and " +
                    "the subscriber is ready for RADIUS authentication.",

                SubscriberId =
                    subscriber.Id,

                Username =
                    subscriber.PPPoEUsername,

                NasName =
                    nas.NasName,

                NasIpAddress =
                    nas.NasIpAddress
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to enable subscriber {SubscriberId}",
                subscriberId);

            return Fail(
                "Unable to configure subscriber on MikroTik: " +
                ex.Message);
        }
    }

    // =========================================================
    // DISABLE SUBSCRIBER
    // =========================================================

    public async Task<SubscriberConnectionResult> DisableAsync(
        Guid subscriberId)
    {
        var subscriber =
            await _context.Subscribers
                .FirstOrDefaultAsync(
                    x => x.Id == subscriberId);

        if (subscriber == null)
            return Fail(
                "Subscriber not found.");

        // =================================================
        // FIRST DISABLE IN DATABASE
        // =================================================

        subscriber.ConnectionEnabled = false;
        subscriber.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // =================================================
        // NO NAS
        // =================================================

        if (subscriber.NasId == null)
        {
            return new SubscriberConnectionResult
            {
                Success = true,
                Enabled = false,
                Message =
                    "Subscriber connection disabled."
            };
        }

        var nas =
            await _context.NasDevices
                .FirstOrDefaultAsync(
                    x => x.Id == subscriber.NasId);

        if (nas == null)
        {
            return new SubscriberConnectionResult
            {
                Success = true,
                Enabled = false,
                Message =
                    "Subscriber disabled, but assigned NAS was not found."
            };
        }

        // =================================================
        // TRY DISCONNECT CURRENT SESSION
        // =================================================

        try
        {
            using var connection =
                ConnectionFactory.CreateConnection(
                    TikConnectionType.Api);

            connection.Open(
                nas.NasIpAddress,
                nas.ApiPort,
                nas.ApiUsername,
                nas.ApiPassword);

            var activeCommand =
                connection.CreateCommand(
                    "/ppp/active/print");

            activeCommand.AddParameter(
                "name",
                subscriber.PPPoEUsername);

            var active =
                activeCommand
                    .ExecuteList()
                    .FirstOrDefault();

            if (active != null)
            {
                var activeId =
                    active.GetResponseField(".id")
                        ?.ToString();

                if (!string.IsNullOrWhiteSpace(activeId))
                {
                    var removeCommand =
                        connection.CreateCommand(
                            "/ppp/active/remove");

                    removeCommand.AddParameter(
                        ".id",
                        activeId);

                    removeCommand.ExecuteNonQuery();

                    _logger.LogInformation(
                        "Disconnected PPP session for {Username} from {Nas}",
                        subscriber.PPPoEUsername,
                        nas.NasName);
                }
            }

            return new SubscriberConnectionResult
            {
                Success = true,
                Enabled = false,

                Message =
                    "Subscriber disabled and active PPPoE session disconnected.",

                SubscriberId =
                    subscriber.Id,

                Username =
                    subscriber.PPPoEUsername,

                NasName =
                    nas.NasName,

                NasIpAddress =
                    nas.NasIpAddress
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to disconnect subscriber {SubscriberId}",
                subscriberId);

            // DB flag is already OFF.
            // So future RADIUS authentication will be rejected.

            return new SubscriberConnectionResult
            {
                Success = true,
                Enabled = false,

                SubscriberId =
                    subscriber.Id,

                Username =
                    subscriber.PPPoEUsername,

                NasName =
                    nas.NasName,

                NasIpAddress =
                    nas.NasIpAddress,

                Message =
                    "Subscriber disabled in database, " +
                    "but current router session could not be disconnected: " +
                    ex.Message
            };
        }
    }

    // GET LIVE SUBSCRIBER
    // =========================================================
    public async Task<SubscriberLiveResult?> GetLiveAsync(Guid subscriberId)
    {
        var subscriber =
        await _context.Subscribers
        .FirstOrDefaultAsync(
        x => x.Id == subscriberId);

        if (subscriber == null)
            return null;

        var result = new SubscriberLiveResult
        {
            SubscriberId = subscriber.Id,

            FullName = subscriber.FullName,

            Username = subscriber.PPPoEUsername,

            ConnectionEnabled =
                subscriber.ConnectionEnabled,

            IsActive =
                subscriber.IsActive,

            IsOnline = false
        };

        // =========================================================
        // NAS
        // =========================================================

        if (subscriber.NasId == null)
            return result;

        var nas =
            await _context.NasDevices
                .FirstOrDefaultAsync(
                    x => x.Id == subscriber.NasId);

        if (nas == null)
            return result;

        result.NasName =
            nas.NasName;

        result.NasIpAddress =
            nas.NasIpAddress;

        result.NasOnline =
            nas.IsOnline;

        result.RouterOnline =
            nas.IsOnline;


        // =========================================================
        // DATABASE ACCOUNTING SESSION
        // =========================================================

        var dbSession =
            await _context.RadiusAccountingSessions
                .Where(x =>
                    x.SubscriberId == subscriber.Id &&
                    x.IsActive)
                .OrderByDescending(
                    x => x.StartTime)
                .FirstOrDefaultAsync();


        if (dbSession != null)
        {
            result.IsOnline = true;

            // -----------------------------------------------------
            // NETWORK
            // -----------------------------------------------------

            result.IpAddress =
                dbSession.FramedIpAddress;

            result.MacAddress =
                dbSession.CallingStationId;

            result.AcctSessionId =
                dbSession.AcctSessionId;

            result.Service =
                dbSession.ServiceType;


            // -----------------------------------------------------
            // TIME
            // -----------------------------------------------------

            result.LoginTime =
                dbSession.StartTime;

            result.LastUpdate =
                dbSession.LastUpdateTime;

            result.StopTime =
                dbSession.StopTime;

            result.SessionTime =
                dbSession.SessionTime;


            // -----------------------------------------------------
            // TRAFFIC
            //
            // InputOctets:
            // Traffic received by NAS
            //
            // OutputOctets:
            // Traffic sent by NAS
            // -----------------------------------------------------

            result.UploadBytes =
                dbSession.InputOctets;

            result.DownloadBytes =
                dbSession.OutputOctets;

            result.TotalBytes =
                dbSession.InputOctets +
                dbSession.OutputOctets;


            // -----------------------------------------------------
            // PACKETS
            // -----------------------------------------------------

            result.InputPackets =
                dbSession.InputPackets;

            result.OutputPackets =
                dbSession.OutputPackets;

            result.TotalPackets =
                dbSession.InputPackets +
                dbSession.OutputPackets;


            // -----------------------------------------------------
            // TERMINATION
            // -----------------------------------------------------

            result.TerminateCause =
                dbSession.TerminateCause;


            // -----------------------------------------------------
            // UPTIME FROM DATABASE
            // -----------------------------------------------------

            if (dbSession.SessionTime > 0)
            {
                result.Uptime =
                    FormatDuration(
                        dbSession.SessionTime);
            }
        }


        // =========================================================
        // MIKROTIK LIVE CHECK
        // =========================================================

        try
        {
            using var connection =
                ConnectionFactory.CreateConnection(
                    TikConnectionType.Api);

            connection.Open(
                nas.NasIpAddress,
                nas.ApiPort,
                nas.ApiUsername,
                nas.ApiPassword);


            // =====================================================
            // PPP ACTIVE
            // =====================================================

            var activeCommand =
                connection.CreateCommand(
                    "/ppp/active/print");

            activeCommand.AddParameter(
                "name",
                subscriber.PPPoEUsername);

            var active =
                activeCommand
                    .ExecuteList()
                    .FirstOrDefault();


            // =====================================================
            // ONLINE
            // =====================================================

            if (active != null)
            {
                result.IsOnline = true;

                result.RouterOnline = true;


                // -------------------------------------------------
                // SESSION ID
                // -------------------------------------------------

                result.RouterSessionId =
                    active
                        .GetResponseField(
                            "session-id")
                        ?.ToString();


                // -------------------------------------------------
                // IP
                // -------------------------------------------------

                result.IpAddress =
                    active
                        .GetResponseField(
                            "address")
                        ?.ToString();


                // -------------------------------------------------
                // MAC
                // -------------------------------------------------

                result.MacAddress =
                    active
                        .GetResponseField(
                            "caller-id")
                        ?.ToString();


                // -------------------------------------------------
                // SERVICE
                // -------------------------------------------------

                result.Service =
                    active
                        .GetResponseField(
                            "service")
                        ?.ToString();


                // -------------------------------------------------
                // UPTIME
                // -------------------------------------------------

                var routerUptime =
                    active
                        .GetResponseField(
                            "uptime")
                        ?.ToString();

                if (!string.IsNullOrWhiteSpace(
                        routerUptime))
                {
                    result.Uptime =
                        routerUptime;
                }
            }
            else
            {
                // Router reachable but
                // subscriber is not active.

                result.RouterOnline = true;

                result.IsOnline = false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Unable to read live subscriber state from NAS {Nas}",
                nas.NasName);

            result.RouterOnline = false;
        }


        // =========================================================
        // RETURN
        // =========================================================

        return result;
    }
    private static string FormatDuration(long seconds)
    {
        if (seconds <= 0)
            return "00:00:00";

        var time =
            TimeSpan.FromSeconds(seconds);

        if (time.TotalDays >= 1)
        {
            return
                $"{(int)time.TotalDays}d " +
                $"{time.Hours:00}:" +
                $"{time.Minutes:00}:" +
                $"{time.Seconds:00}";
        }

        return
            $"{time.Hours:00}:" +
            $"{time.Minutes:00}:" +
            $"{time.Seconds:00}";
    }

    // =========================================================
    // COMMON FAILURE RESULT
    // =========================================================

    private static SubscriberConnectionResult Fail(
        string message)
    {
        return new SubscriberConnectionResult
        {
            Success = false,
            Enabled = false,
            Message = message
        };
    }
}

// =============================================================
// CONNECTION RESULT
// =============================================================

public sealed class SubscriberConnectionResult
{
    public bool Success { get; set; }

    public bool Enabled { get; set; }

    public string Message { get; set; } = "";

    public Guid? SubscriberId { get; set; }

    public string? Username { get; set; }

    public string? NasName { get; set; }

    public string? NasIpAddress { get; set; }
}

// =============================================================
// LIVE RESULT
// =============================================================

public sealed class SubscriberLiveResult
{
    public Guid SubscriberId { get; set; }

    public string FullName { get; set; } = "";

    public string Username { get; set; } = "";

    public bool IsActive { get; set; }

    public bool ConnectionEnabled { get; set; }

    public bool IsOnline { get; set; }

    // =========================================================
    // NAS / ROUTER
    // =========================================================

    public string? NasName { get; set; }

    public string? NasIpAddress { get; set; }

    public bool NasOnline { get; set; }

    public bool RouterOnline { get; set; }

    // =========================================================
    // LIVE CONNECTION
    // =========================================================

    public string? IpAddress { get; set; }

    public string? MacAddress { get; set; }

    public string? AcctSessionId { get; set; }

    public string? RouterSessionId { get; set; }

    public string? Service { get; set; }

    public string? Uptime { get; set; }

    // =========================================================
    // SESSION TIME
    // =========================================================

    public DateTime? LoginTime { get; set; }

    public DateTime? LastUpdate { get; set; }

    public DateTime? StopTime { get; set; }

    public long SessionTime { get; set; }

    // =========================================================
    // TRAFFIC
    // =========================================================

    public long UploadBytes { get; set; }

    public long DownloadBytes { get; set; }

    public long TotalBytes { get; set; }

    // =========================================================
    // PACKETS
    // =========================================================

    public long InputPackets { get; set; }

    public long OutputPackets { get; set; }

    public long TotalPackets { get; set; }

    // =========================================================
    // SPEED
    //
    // These are calculated from accounting deltas.
    // =========================================================

    public double UploadMbps { get; set; }

    public double DownloadMbps { get; set; }

    public double UploadKbps { get; set; }

    public double DownloadKbps { get; set; }

    // =========================================================
    // TERMINATION
    // =========================================================

    public string? TerminateCause { get; set; }
}