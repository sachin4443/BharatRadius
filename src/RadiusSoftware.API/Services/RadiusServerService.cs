using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.API.Hubs;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Services;

public class RadiusServerService : BackgroundService
{
    private const int AuthenticationPort = 1812;
    private const int AccountingPort = 1813;

    private const byte AccessRequest = 1;
    private const byte AccessAccept = 2;
    private const byte AccessReject = 3;

    private const byte AccountingRequest = 4;
    private const byte AccountingResponse = 5;

    // Standard RADIUS attributes
    private const byte UserName = 1;
    private const byte UserPassword = 2;
    private const byte ChapPassword = 3;
    private const byte NasIpAddress = 4;
    private const byte NasPort = 5;
    private const byte ServiceType = 6;
    private const byte FramedProtocol = 7;
    private const byte FramedIpAddress = 8;
    private const byte ReplyMessage = 18;
    private const byte SessionTimeout = 27;
    private const byte ProxyState = 33;

    // Accounting
    private const byte AcctInputOctets = 42;
    private const byte AcctOutputOctets = 43;
    private const byte AcctSessionId = 44;
    private const byte AcctAuthentic = 45;
    private const byte AcctSessionTime = 46;
    private const byte AcctInputPackets = 47;
    private const byte AcctOutputPackets = 48;
    private const byte AcctTerminateCause = 49;
    private const byte AcctInputGigawords = 52;
    private const byte AcctOutputGigawords = 53;
    private const byte AcctStatusType = 40;
    private const byte AcctInterimInterval = 85;

    // CHAP
    private const byte ChapChallenge = 60;

    // Message Authenticator
    private const byte MessageAuthenticator = 80;

    // RADIUS Vendor Specific
    private const byte VendorSpecific = 26;

    // MikroTik Vendor ID
    private const uint MikroTikVendorId = 14988;

    // MikroTik-Rate-Limit
    private const byte MikroTikRateLimitType = 8;

    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger _logger;
    private readonly IHubContext<RadiusLogHub> _hubContext;

    public RadiusServerService(
        IServiceProvider serviceProvider,
        ILogger<RadiusServerService> logger,
        IHubContext<RadiusLogHub> hubContext)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _hubContext = hubContext;
    }

    // =========================================================
    // LOGGING
    // =========================================================

    // Site of the NAS currently being processed. AsyncLocal keeps it
    // separate for every packet that is processed in parallel.
    private static readonly AsyncLocal<Guid?> CurrentNasSite = new();

    private async Task LogAndBroadcast(
        string message,
        string type = "INFO")
    {
        string time = DateTime.Now.ToString("HH:mm:ss");

        string fullMessage =
            $"[{time}] [{type}] {message}";

        if (type == "ERROR")
            _logger.LogError(fullMessage);
        else if (type == "WARNING")
            _logger.LogWarning(fullMessage);
        else
            _logger.LogInformation(fullMessage);

        try
        {
            // Super admin sees everything, a site only sees logs of its own NAS
            var groups = new List<string> { RadiusLogHub.SuperAdminGroup };
            var siteId = CurrentNasSite.Value;
            if (siteId.HasValue)
                groups.Add(RadiusLogHub.SiteGroup(siteId.Value));

            await _hubContext.Clients.Groups(groups).SendAsync(
                "ReceiveLog",
                fullMessage,
                type);
        }
        catch
        {
            // SignalR failure should never stop RADIUS server.
        }
    }

    // =========================================================
    // START RADIUS SERVERS
    // =========================================================

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        using var authenticationListener =
            new UdpClient(
                new IPEndPoint(
                    IPAddress.Any,
                    AuthenticationPort));

        using var accountingListener =
            new UdpClient(
                new IPEndPoint(
                    IPAddress.Any,
                    AccountingPort));

        await LogAndBroadcast(
            "🚀 .NET RADIUS Authentication Server started on UDP 1812",
            "SYSTEM");

        await LogAndBroadcast(
            "📊 .NET RADIUS Accounting Server started on UDP 1813",
            "SYSTEM");

        var authenticationTask =
            ReceiveLoopAsync(
                authenticationListener,
                false,
                stoppingToken);

        var accountingTask =
            ReceiveLoopAsync(
                accountingListener,
                true,
                stoppingToken);

        await Task.WhenAll(
            authenticationTask,
            accountingTask);
    }

    // =========================================================
    // UDP RECEIVE LOOP
    // =========================================================

    private async Task ReceiveLoopAsync(
        UdpClient listener,
        bool accounting,
        CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var result =
                    await listener.ReceiveAsync(
                        cancellationToken);

                _ = ProcessPacketAsync(
                    result.Buffer,
                    result.RemoteEndPoint,
                    listener,
                    accounting);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (ObjectDisposedException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "RADIUS UDP receive error. Accounting={Accounting}",
                    accounting);
            }
        }
    }

    // =========================================================
    // MAIN PACKET PROCESSOR
    // =========================================================

    private async Task ProcessPacketAsync(
        byte[] packet,
        IPEndPoint remoteEndpoint,
        UdpClient listener,
        bool accounting)
    {
        try
        {
            if (!TryParseRadiusPacket(
                    packet,
                    out byte code,
                    out byte identifier,
                    out byte[] requestAuthenticator,
                    out List<RadiusAttribute> attributes))
            {
                await LogAndBroadcast(
                    $"Invalid RADIUS packet received from {remoteEndpoint.Address}",
                    "ERROR");

                return;
            }

            if (accounting)
            {
                if (code != AccountingRequest)
                    return;

                await ProcessAccountingRequestAsync(
                    packet,
                    identifier,
                    requestAuthenticator,
                    attributes,
                    remoteEndpoint,
                    listener);

                return;
            }

            if (code != AccessRequest)
                return;

            await ProcessAccessRequestAsync(
                packet,
                identifier,
                requestAuthenticator,
                attributes,
                remoteEndpoint,
                listener);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Unhandled RADIUS packet processing error.");
        }
    }

    // =========================================================
    // ACCESS-REQUEST
    // =========================================================

    private async Task ProcessAccessRequestAsync(
        byte[] requestPacket,
        byte identifier,
        byte[] requestAuthenticator,
        List<RadiusAttribute> attributes,
        IPEndPoint remoteEndpoint,
        UdpClient listener)
    {
        string routerIp =
            remoteEndpoint.Address.ToString();

        using var scope =
            _serviceProvider.CreateScope();

        var db =
            scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

        // -----------------------------------------------------
        // 1. NAS LOOKUP
        // -----------------------------------------------------

        var nas =
            await db.NasDevices
                .FirstOrDefaultAsync(
                    x =>
                        x.NasIpAddress == routerIp &&
                        x.IsEnabled);

        if (nas == null)
        {
            await LogAndBroadcast(
                $"Unauthorized RADIUS Access-Request from {routerIp}",
                "ERROR");

            return;
        }

        CurrentNasSite.Value = nas.SiteId;

        if (!nas.IsRadiusConfigured)
        {
            await LogAndBroadcast(
                $"RADIUS request received from {nas.NasName}, but NAS is not configured.",
                "ERROR");

            return;
        }

        if (string.IsNullOrWhiteSpace(
                nas.SharedSecret))
        {
            await LogAndBroadcast(
                $"NAS {nas.NasName} has empty RADIUS shared secret.",
                "ERROR");

            return;
        }

        await LogAndBroadcast(
            $"Access-Request received from {nas.NasName} ({routerIp})",
            "INFO");

        // -----------------------------------------------------
        // 2. MESSAGE AUTHENTICATOR
        // -----------------------------------------------------

        bool hasMessageAuthenticator =
            attributes.Any(
                x => x.Type == MessageAuthenticator);

        if (hasMessageAuthenticator)
        {
            if (!ValidateMessageAuthenticator(
                    requestPacket,
                    attributes,
                    nas.SharedSecret))
            {
                await LogAndBroadcast(
                    $"Invalid Message-Authenticator from NAS {nas.NasName}",
                    "ERROR");

                return;
            }
        }

        // -----------------------------------------------------
        // 3. USERNAME
        // -----------------------------------------------------

        string? username =
            GetStringAttribute(
                attributes,
                UserName);

        if (string.IsNullOrWhiteSpace(username))
        {
            await LogAndBroadcast(
                $"Access-Reject from {nas.NasName}: User-Name missing.",
                "ERROR");

            await SendAccessRejectAsync(
                requestPacket,
                identifier,
                requestAuthenticator,
                attributes,
                nas.SharedSecret,
                "User-Name is missing.",
                hasMessageAuthenticator,
                remoteEndpoint,
                listener);

            return;
        }

        // -----------------------------------------------------
        // 4. CLIENT INFORMATION
        // -----------------------------------------------------

        string? callingStationId =
            GetStringAttribute(
                attributes,
                31);

        string? acctSessionId =
            GetStringAttribute(
                attributes,
                AcctSessionId);

        string? framedIp =
            GetIpAttribute(
                attributes,
                FramedIpAddress);

        string? nasIpFromPacket =
            GetIpAttribute(
                attributes,
                NasIpAddress);

        // -----------------------------------------------------
        // 5. FIND SUBSCRIBER
        // -----------------------------------------------------

        var subscriber =
            await db.Subscribers
                .FirstOrDefaultAsync(
                    x =>
                        x.PPPoEUsername == username &&
                        x.Service == "PPPoE");

        if (subscriber == null)
        {
            await RecordAuthenticationLogAsync(
                db,
                null,
                nas,
                username,
                "REJECT",
                "Subscriber not found.",
                callingStationId,
                framedIp,
                acctSessionId,
                requestAuthenticator,
                "UNKNOWN");

            await db.SaveChangesAsync();

            await LogAndBroadcast(
                $"Access-Reject: subscriber {username} not found.",
                "ERROR");

            await SendAccessRejectAsync(
                requestPacket,
                identifier,
                requestAuthenticator,
                attributes,
                nas.SharedSecret,
                "Invalid username or password.",
                hasMessageAuthenticator,
                remoteEndpoint,
                listener);

            return;
        }

        // -----------------------------------------------------
        // 6. SITE CHECK
        // -----------------------------------------------------

        if (subscriber.SiteId != nas.SiteId)
        {
            await RecordAuthenticationLogAsync(
                db,
                subscriber,
                nas,
                username,
                "REJECT",
                "Subscriber and NAS belong to different sites.",
                callingStationId,
                framedIp,
                acctSessionId,
                requestAuthenticator,
                "SITE_MISMATCH");

            await db.SaveChangesAsync();

            await LogAndBroadcast(
                $"Access-Reject: {username} belongs to another site.",
                "ERROR");

            await SendAccessRejectAsync(
                requestPacket,
                identifier,
                requestAuthenticator,
                attributes,
                nas.SharedSecret,
                "Subscriber is not assigned to this NAS.",
                hasMessageAuthenticator,
                remoteEndpoint,
                listener);

            return;
        }

        // -----------------------------------------------------
        // 7. NAS ASSIGNMENT CHECK
        // -----------------------------------------------------

        if (subscriber.NasId.HasValue &&
            subscriber.NasId.Value != nas.Id)
        {
            await RecordAuthenticationLogAsync(
                db,
                subscriber,
                nas,
                username,
                "REJECT",
                "Subscriber is assigned to another NAS.",
                callingStationId,
                framedIp,
                acctSessionId,
                requestAuthenticator,
                "NAS_MISMATCH");

            await db.SaveChangesAsync();

            await LogAndBroadcast(
                $"Access-Reject: {username} is assigned to another NAS.",
                "ERROR");

            await SendAccessRejectAsync(
                requestPacket,
                identifier,
                requestAuthenticator,
                attributes,
                nas.SharedSecret,
                "Subscriber is assigned to another router.",
                hasMessageAuthenticator,
                remoteEndpoint,
                listener);

            return;
        }

        // -----------------------------------------------------
        // 8. ACCOUNT STATUS
        // -----------------------------------------------------

        if (!subscriber.IsActive)
        {
            await RecordAuthenticationLogAsync(
                db,
                subscriber,
                nas,
                username,
                "REJECT",
                "Subscriber is Suspended.",
                callingStationId,
                framedIp,
                acctSessionId,
                requestAuthenticator,
                "ACCOUNT_INACTIVE");

            await db.SaveChangesAsync();

            await LogAndBroadcast(
                $"Access-Reject: {username} is suspended.",
                "ERROR");

            await SendAccessRejectAsync(
                requestPacket,
                identifier,
                requestAuthenticator,
                attributes,
                nas.SharedSecret,
                "Subscriber is Suspended.",
                hasMessageAuthenticator,
                remoteEndpoint,
                listener);

            return;
        }

        // -----------------------------------------------------
        // 9. CONNECTION ENABLED
        // -----------------------------------------------------

        if (!subscriber.ConnectionEnabled)
        {
            await RecordAuthenticationLogAsync(
                db,
                subscriber,
                nas,
                username,
                "REJECT",
                "Subscriber is Disabled.",
                callingStationId,
                framedIp,
                acctSessionId,
                requestAuthenticator,
                "CONNECTION_DISABLED");

            await db.SaveChangesAsync();

            await LogAndBroadcast(
                $"Access-Reject: {username} connection disabled.",
                "ERROR");

            await SendAccessRejectAsync(
                requestPacket,
                identifier,
                requestAuthenticator,
                attributes,
                nas.SharedSecret,
                "Subscriber is Disabled.",
                hasMessageAuthenticator,
                remoteEndpoint,
                listener);

            return;
        }

        // -----------------------------------------------------
        // 9b. EXPIRY DATE
        // -----------------------------------------------------

        if (subscriber.ExpireDate.HasValue &&
            subscriber.ExpireDate.Value <= DateTime.UtcNow)
        {
            await RecordAuthenticationLogAsync(
                db,
                subscriber,
                nas,
                username,
                "REJECT",
                "Subscriber Account is Expired.",
                callingStationId,
                framedIp,
                acctSessionId,
                requestAuthenticator,
                "ACCOUNT_EXPIRED");

            await db.SaveChangesAsync();

            await LogAndBroadcast(
                $"Access-Reject: {username} account expired on {subscriber.ExpireDate.Value:yyyy-MM-dd HH:mm}.",
                "ERROR");

            await SendAccessRejectAsync(
                requestPacket,
                identifier,
                requestAuthenticator,
                attributes,
                nas.SharedSecret,
                "Your account has expired. Please recharge.",
                hasMessageAuthenticator,
                remoteEndpoint,
                listener);

            return;
        }

        // -----------------------------------------------------
        // 10. PACKAGE
        // -----------------------------------------------------

        if (!subscriber.PackageId.HasValue)
        {
            await RecordAuthenticationLogAsync(
                db,
                subscriber,
                nas,
                username,
                "REJECT",
                "Subscriber has no package assigned.",
                callingStationId,
                framedIp,
                acctSessionId,
                requestAuthenticator,
                "PACKAGE_MISSING");

            await db.SaveChangesAsync();

            await LogAndBroadcast(
                $"Access-Reject: {username} has no package.",
                "ERROR");

            await SendAccessRejectAsync(
                requestPacket,
                identifier,
                requestAuthenticator,
                attributes,
                nas.SharedSecret,
                "No active package assigned.",
                hasMessageAuthenticator,
                remoteEndpoint,
                listener);

            return;
        }

        var package =
            await db.PackageProfiles
                .FirstOrDefaultAsync(
                    x =>
                        x.Id == subscriber.PackageId.Value &&
                        x.SiteId == subscriber.SiteId &&
                        x.IsActive);

        if (package == null)
        {
            await RecordAuthenticationLogAsync(
                db,
                subscriber,
                nas,
                username,
                "REJECT",
                "Subscriber package not found or inactive.",
                callingStationId,
                framedIp,
                acctSessionId,
                requestAuthenticator,
                "PACKAGE_INVALID");

            await db.SaveChangesAsync();

            await LogAndBroadcast(
                $"Access-Reject: invalid package for {username}.",
                "ERROR");

            await SendAccessRejectAsync(
                requestPacket,
                identifier,
                requestAuthenticator,
                attributes,
                nas.SharedSecret,
                "Subscriber package is not available.",
                hasMessageAuthenticator,
                remoteEndpoint,
                listener);

            return;
        }

        // -----------------------------------------------------
        // 11. AUTHENTICATION METHOD
        // -----------------------------------------------------

        string authenticationMethod;

        bool passwordValid;

        var userPasswordAttribute =
            GetAttribute(
                attributes,
                UserPassword);

        var chapPasswordAttribute =
            GetAttribute(
                attributes,
                ChapPassword);

        if (userPasswordAttribute != null)
        {
            authenticationMethod = "PAP";

            string password =
                DecryptUserPassword(
                    userPasswordAttribute.Value,
                    requestAuthenticator,
                    nas.SharedSecret);

            passwordValid =
                FixedTimeStringEquals(
                    password,
                    subscriber.PPPoEPassword);
        }
        else if (chapPasswordAttribute != null)
        {
            authenticationMethod = "CHAP";

            passwordValid =
                VerifyChapPassword(
                    chapPasswordAttribute.Value,
                    attributes,
                    requestAuthenticator,
                    subscriber.PPPoEPassword);
        }
        else
        {
            authenticationMethod =
                DetectUnsupportedAuthenticationMethod(
                    attributes);

            await RecordAuthenticationLogAsync(
                db,
                subscriber,
                nas,
                username,
                "REJECT",
                $"Unsupported RADIUS authentication method: {authenticationMethod}",
                callingStationId,
                framedIp,
                acctSessionId,
                requestAuthenticator,
                authenticationMethod);

            await db.SaveChangesAsync();

            await LogAndBroadcast(
                $"Access-Reject: {username}. Unsupported authentication method: {authenticationMethod}",
                "ERROR");

            await SendAccessRejectAsync(
                requestPacket,
                identifier,
                requestAuthenticator,
                attributes,
                nas.SharedSecret,
                $"Authentication method {authenticationMethod} is not supported by this RADIUS server.",
                hasMessageAuthenticator,
                remoteEndpoint,
                listener);

            return;
        }

        // -----------------------------------------------------
        // 12. PASSWORD RESULT
        // -----------------------------------------------------

        if (!passwordValid)
        {
            await RecordAuthenticationLogAsync(
                db,
                subscriber,
                nas,
                username,
                "REJECT",
                "Wrong Password.",
                callingStationId,
                framedIp,
                acctSessionId,
                requestAuthenticator,
                authenticationMethod);

            await db.SaveChangesAsync();

            await LogAndBroadcast(
                $"Access-Reject: invalid credentials for {username}.",
                "ERROR");

            await SendAccessRejectAsync(
                requestPacket,
                identifier,
                requestAuthenticator,
                attributes,
                nas.SharedSecret,
                "Invalid username or password.",
                hasMessageAuthenticator,
                remoteEndpoint,
                listener);

            return;
        }

        // -----------------------------------------------------
        // 13. STATIC IP VALIDATION
        // -----------------------------------------------------

        string? staticIp =
            string.IsNullOrWhiteSpace(subscriber.StaticIp)
                ? null
                : subscriber.StaticIp.Trim();

        IPAddress? staticIpAddress = null;

        if (staticIp != null)
        {
            if (!IPAddress.TryParse(
                    staticIp,
                    out staticIpAddress))
            {
                await RecordAuthenticationLogAsync(
                    db,
                    subscriber,
                    nas,
                    username,
                    "REJECT",
                    $"Invalid StaticIp configured: {staticIp}",
                    callingStationId,
                    framedIp,
                    acctSessionId,
                    requestAuthenticator,
                    authenticationMethod);

                await db.SaveChangesAsync();

                await LogAndBroadcast(
                    $"Access-Reject: invalid StaticIp for {username}: {staticIp}",
                    "ERROR");

                await SendAccessRejectAsync(
                    requestPacket,
                    identifier,
                    requestAuthenticator,
                    attributes,
                    nas.SharedSecret,
                    "Subscriber has an invalid static IP configuration.",
                    hasMessageAuthenticator,
                    remoteEndpoint,
                    listener);

                return;
            }
        }

        // -----------------------------------------------------
        // 14. BUILD DYNAMIC RATE LIMIT
        // -----------------------------------------------------

        string? rateLimit = null;

        if (package.DownloadMbps > 0 ||
            package.UploadMbps > 0)
        {
            decimal upload =
                package.UploadMbps;

            decimal download =
                package.DownloadMbps;

            // MikroTik perspective:
            // rx = client upload
            // tx = client download
            rateLimit =
                $"{upload:0.##}M/{download:0.##}M";
        }

        // -----------------------------------------------------
        // 15. RECORD ACCEPT LOG
        // -----------------------------------------------------

        await RecordAuthenticationLogAsync(
            db,
            subscriber,
            nas,
            username,
            "ACCEPT",
            null,
            callingStationId,
            staticIp ?? framedIp,
            acctSessionId,
            requestAuthenticator,
            authenticationMethod);

        await db.SaveChangesAsync();

        // -----------------------------------------------------
        // 16. ACCESS-ACCEPT ATTRIBUTES
        // -----------------------------------------------------

        var responseAttributes =
            new List<RadiusAttribute>();

        // User-Name
        responseAttributes.Add(
            CreateStringAttribute(
                UserName,
                username));

        // Framed User
        responseAttributes.Add(
            CreateUInt32Attribute(
                ServiceType,
                2));

        // PPP
        responseAttributes.Add(
            CreateUInt32Attribute(
                FramedProtocol,
                1));

        // Dynamic MikroTik Rate Limit
        if (!string.IsNullOrWhiteSpace(rateLimit))
        {
            responseAttributes.Add(
                CreateMikroTikRateLimitAttribute(
                    rateLimit));
        }

        // Session-Timeout: router disconnects the user exactly when the
        // package expires (the user then gets "expired" on reconnect).
        if (subscriber.ExpireDate.HasValue)
        {
            var secondsLeft = (subscriber.ExpireDate.Value - DateTime.UtcNow).TotalSeconds;
            if (secondsLeft > 0 && secondsLeft < uint.MaxValue)
            {
                responseAttributes.Add(
                    CreateUInt32Attribute(
                        SessionTimeout,
                        (uint)Math.Ceiling(secondsLeft)));
            }
        }

        // Interim Accounting
        if (nas.InterimTime > 0)
        {
            responseAttributes.Add(
                CreateUInt32Attribute(
                    AcctInterimInterval,
                    (uint)nas.InterimTime));
        }

        // Static IP
        if (staticIpAddress != null &&
            staticIpAddress.AddressFamily ==
                AddressFamily.InterNetwork)
        {
            responseAttributes.Add(
                new RadiusAttribute(
                    FramedIpAddress,
                    staticIpAddress.GetAddressBytes()));
        }

        // Preserve Proxy-State
        foreach (
            var proxyState in attributes
                .Where(x => x.Type == ProxyState))
        {
            responseAttributes.Add(
                new RadiusAttribute(
                    ProxyState,
                    proxyState.Value));
        }

        // -----------------------------------------------------
        // 17. SEND ACCESS ACCEPT
        // -----------------------------------------------------

        byte[] response =
            BuildResponsePacket(
                AccessAccept,
                identifier,
                requestAuthenticator,
                responseAttributes,
                nas.SharedSecret,
                hasMessageAuthenticator);

        await listener.SendAsync(
            response,
            response.Length,
            remoteEndpoint);

        await LogAndBroadcast(
            $"Access-Accept: {username} | NAS={nas.NasName} | " +
            $"Auth={authenticationMethod} | " +
            $"Package={package.PackageName} | " +
            $"Rate={rateLimit ?? "UNLIMITED"} | " +
            $"MAC={callingStationId ?? "N/A"} | " +
            $"IP={staticIp ?? "Dynamic"}",
            "SUCCESS");
    }

    // =========================================================
    // ACCOUNTING REQUEST
    // =========================================================

    private async Task ProcessAccountingRequestAsync(
        byte[] requestPacket,
        byte identifier,
        byte[] requestAuthenticator,
        List<RadiusAttribute> attributes,
        IPEndPoint remoteEndpoint,
        UdpClient listener)
    {
        string routerIp =
            remoteEndpoint.Address.ToString();

        using var scope =
            _serviceProvider.CreateScope();

        var db =
            scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

        // -----------------------------------------------------
        // NAS
        // -----------------------------------------------------

        var nas =
            await db.NasDevices
                .FirstOrDefaultAsync(
                    x =>
                        x.NasIpAddress == routerIp &&
                        x.IsEnabled);

        if (nas == null)
        {
            await LogAndBroadcast(
                $"Accounting request from unknown NAS {routerIp}",
                "ERROR");

            return;
        }

        CurrentNasSite.Value = nas.SiteId;

        if (string.IsNullOrWhiteSpace(
                nas.SharedSecret))
        {
            await LogAndBroadcast(
                $"Accounting request from {nas.NasName}, but shared secret is empty.",
                "ERROR");

            return;
        }

        // -----------------------------------------------------
        // VERIFY ACCOUNTING REQUEST AUTHENTICATOR
        // -----------------------------------------------------

        if (!VerifyAccountingRequestAuthenticator(
                requestPacket,
                nas.SharedSecret))
        {
            await LogAndBroadcast(
                $"Invalid Accounting-Request authenticator from {nas.NasName}",
                "ERROR");

            return;
        }

        // -----------------------------------------------------
        // ATTRIBUTES
        // -----------------------------------------------------

        string? username =
            GetStringAttribute(
                attributes,
                UserName);

        string? sessionId =
            GetStringAttribute(
                attributes,
                AcctSessionId);

        uint? status =
            GetUInt32Attribute(
                attributes,
                AcctStatusType);

        if (string.IsNullOrWhiteSpace(sessionId))
        {
            await LogAndBroadcast(
                $"Accounting request from {nas.NasName} has no Acct-Session-Id.",
                "ERROR");

            await SendAccountingResponseAsync(
                requestPacket,
                identifier,
                requestAuthenticator,
                nas.SharedSecret,
                remoteEndpoint,
                listener);

            return;
        }

        if (!status.HasValue)
        {
            await LogAndBroadcast(
                $"Accounting request {sessionId} has no Acct-Status-Type.",
                "ERROR");

            await SendAccountingResponseAsync(
                requestPacket,
                identifier,
                requestAuthenticator,
                nas.SharedSecret,
                remoteEndpoint,
                listener);

            return;
        }

        string statusName =
            status.Value switch
            {
                1 => "Start",
                2 => "Stop",
                3 => "Interim-Update",
                7 => "Accounting-On",
                8 => "Accounting-Off",
                _ => $"Unknown-{status.Value}"
            };

        // -----------------------------------------------------
        // SUBSCRIBER
        // -----------------------------------------------------

        Subscriber? subscriber = null;

        if (!string.IsNullOrWhiteSpace(username))
        {
            subscriber =
                await db.Subscribers
                    .FirstOrDefaultAsync(
                        x =>
                            x.PPPoEUsername == username &&
                            x.Service == "PPPoE");
        }

        string? callingStationId =
            GetStringAttribute(
                attributes,
                31);

        string? calledStationId =
            GetStringAttribute(
                attributes,
                30);

        string? clientIp =
            GetIpAttribute(
                attributes,
                FramedIpAddress);

        string? nasPort =
            GetStringOrNumberAttribute(
                attributes,
                NasPort);

        string? nasPortType =
            GetStringOrNumberAttribute(
                attributes,
                61);

        string? serviceType =
            GetStringOrNumberAttribute(
                attributes,
                ServiceType);

        string? acctAuthentic =
            GetStringOrNumberAttribute(
                attributes,
                AcctAuthentic);

        uint sessionTime =
            GetUInt32Attribute(
                attributes,
                AcctSessionTime) ?? 0;

        ulong inputOctets =
            GetCounter64(
                attributes,
                AcctInputOctets,
                AcctInputGigawords);

        ulong outputOctets =
            GetCounter64(
                attributes,
                AcctOutputOctets,
                AcctOutputGigawords);

        ulong inputPackets =
            GetCounter64(
                attributes,
                AcctInputPackets,
                null);

        ulong outputPackets =
            GetCounter64(
                attributes,
                AcctOutputPackets,
                null);

        string? terminateCause =
            GetStringOrNumberAttribute(
                attributes,
                AcctTerminateCause);

        DateTime now =
            DateTime.UtcNow;

        // -----------------------------------------------------
        // FIND EXISTING SESSION
        // -----------------------------------------------------

        var session =
            await db.RadiusAccountingSessions
                .FirstOrDefaultAsync(
                    x =>
                        x.NasId == nas.Id &&
                        x.AcctSessionId == sessionId);

        // -----------------------------------------------------
        // START
        // -----------------------------------------------------

        if (status.Value == 1)
        {
            if (session == null)
            {
                session =
                    new RadiusAccountingSession
                    {
                        SubscriberId =
                            subscriber?.Id,

                        NasId =
                            nas.Id,

                        Username =
                            username ?? string.Empty,

                        AcctSessionId =
                            sessionId,

                        AcctStatusType =
                            "Start",

                        AcctAuthentic =
                            acctAuthentic,

                        CallingStationId =
                            callingStationId,

                        CalledStationId =
                            calledStationId,

                        FramedIpAddress =
                            clientIp,

                        NasIpAddress =
                            routerIp,

                        NasPort =
                            nasPort,

                        NasPortType =
                            nasPortType,

                        ServiceType =
                            serviceType,

                        StartTime =
                            now.AddSeconds(
                                -(long)sessionTime),

                        LastUpdateTime =
                            now,

                        SessionTime =
                            sessionTime,

                        InputOctets =
                            ToLong(inputOctets),

                        OutputOctets =
                            ToLong(outputOctets),

                        InputPackets =
                            ToLong(inputPackets),

                        OutputPackets =
                            ToLong(outputPackets),

                        IsActive =
                            true,

                        CreatedAt =
                            now,

                        UpdatedAt =
                            now
                    };

                db.RadiusAccountingSessions.Add(
                    session);
            }
            else
            {
                // Duplicate Start / reconnect
                session.SubscriberId =
                    subscriber?.Id;

                session.Username =
                    username ?? session.Username;

                session.AcctStatusType =
                    "Start";

                session.CallingStationId =
                    callingStationId ??
                    session.CallingStationId;

                session.FramedIpAddress =
                    clientIp ??
                    session.FramedIpAddress;

                session.StartTime ??= now;

                session.LastUpdateTime =
                    now;

                session.IsActive =
                    true;

                session.UpdatedAt =
                    now;
            }

            await LogAndBroadcast(
                $"📡 Accounting START | User={username} | " +
                $"Session={sessionId} | IP={clientIp} | MAC={callingStationId}",
                "SUCCESS");
        }

        // -----------------------------------------------------
        // INTERIM UPDATE
        // -----------------------------------------------------

        else if (status.Value == 3)
        {
            if (session == null)
            {
                session =
                    new RadiusAccountingSession
                    {
                        SubscriberId =
                            subscriber?.Id,

                        NasId =
                            nas.Id,

                        Username =
                            username ?? string.Empty,

                        AcctSessionId =
                            sessionId,

                        AcctStatusType =
                            "Interim-Update",

                        StartTime =
                            now.AddSeconds(
                                -(long)sessionTime),

                        IsActive =
                            true,

                        CreatedAt =
                            now
                    };

                db.RadiusAccountingSessions.Add(
                    session);
            }

            session.SubscriberId =
                subscriber?.Id ??
                session.SubscriberId;

            session.Username =
                username ??
                session.Username;

            session.AcctStatusType =
                "Interim-Update";

            session.CallingStationId =
                callingStationId ??
                session.CallingStationId;

            session.CalledStationId =
                calledStationId ??
                session.CalledStationId;

            session.FramedIpAddress =
                clientIp ??
                session.FramedIpAddress;

            session.NasIpAddress =
                routerIp;

            session.NasPort =
                nasPort ??
                session.NasPort;

            session.NasPortType =
                nasPortType ??
                session.NasPortType;

            session.ServiceType =
                serviceType ??
                session.ServiceType;

            session.AcctAuthentic =
                acctAuthentic ??
                session.AcctAuthentic;

            session.SessionTime =
                sessionTime;

            session.InputOctets =
                ToLong(inputOctets);

            session.OutputOctets =
                ToLong(outputOctets);

            session.InputPackets =
                ToLong(inputPackets);

            session.OutputPackets =
                ToLong(outputPackets);

            session.LastUpdateTime =
                now;

            session.IsActive =
                true;

            session.UpdatedAt =
                now;

            await LogAndBroadcast(
                $"📊 Accounting INTERIM | User={username} | " +
                $"Session={sessionId} | IP={clientIp} | " +
                $"Input={inputOctets} | Output={outputOctets}",
                "INFO");
        }

        // -----------------------------------------------------
        // STOP
        // -----------------------------------------------------

        else if (status.Value == 2)
        {
            if (session == null)
            {
                session =
                    new RadiusAccountingSession
                    {
                        SubscriberId =
                            subscriber?.Id,

                        NasId =
                            nas.Id,

                        Username =
                            username ?? string.Empty,

                        AcctSessionId =
                            sessionId,

                        StartTime =
                            now.AddSeconds(
                                -(long)sessionTime),

                        CreatedAt =
                            now
                    };

                db.RadiusAccountingSessions.Add(
                    session);
            }

            session.SubscriberId =
                subscriber?.Id ??
                session.SubscriberId;

            session.Username =
                username ??
                session.Username;

            session.AcctStatusType =
                "Stop";

            session.AcctAuthentic =
                acctAuthentic ??
                session.AcctAuthentic;

            session.CallingStationId =
                callingStationId ??
                session.CallingStationId;

            session.CalledStationId =
                calledStationId ??
                session.CalledStationId;

            session.FramedIpAddress =
                clientIp ??
                session.FramedIpAddress;

            session.NasIpAddress =
                routerIp;

            session.NasPort =
                nasPort ??
                session.NasPort;

            session.NasPortType =
                nasPortType ??
                session.NasPortType;

            session.ServiceType =
                serviceType ??
                session.ServiceType;

            session.SessionTime =
                sessionTime;

            session.InputOctets =
                ToLong(inputOctets);

            session.OutputOctets =
                ToLong(outputOctets);

            session.InputPackets =
                ToLong(inputPackets);

            session.OutputPackets =
                ToLong(outputPackets);

            session.TerminateCause =
                terminateCause;

            session.StopTime =
                now;

            session.LastUpdateTime =
                now;

            session.IsActive =
                false;

            session.UpdatedAt =
                now;

            await LogAndBroadcast(
                $"🛑 Accounting STOP | User={username} | " +
                $"Session={sessionId} | " +
                $"Uptime={sessionTime}s | " +
                $"Input={inputOctets} | Output={outputOctets}",
                "SUCCESS");
        }

        // -----------------------------------------------------
        // OTHER ACCOUNTING EVENTS
        // -----------------------------------------------------

        else
        {
            await LogAndBroadcast(
                $"Accounting {statusName} received from {nas.NasName}.",
                "INFO");
        }

        await db.SaveChangesAsync();

        // -----------------------------------------------------
        // ACCOUNTING RESPONSE
        // -----------------------------------------------------

        await SendAccountingResponseAsync(
            requestPacket,
            identifier,
            requestAuthenticator,
            nas.SharedSecret,
            remoteEndpoint,
            listener);
    }

    // =========================================================
    // AUTHENTICATION LOG
    // =========================================================

    private static async Task RecordAuthenticationLogAsync(
        AppDbContext db,
        Subscriber? subscriber,
        NasDevice nas,
        string username,
        string result,
        string? failureReason,
        string? callingStationId,
        string? framedIp,
        string? acctSessionId,
        byte[] requestAuthenticator,
        string authenticationMethod)
    {
        var log =
            new RadiusAuthenticationLog
            {
                SubscriberId =
                    subscriber?.Id,

                NasId =
                    nas.Id,

                Username =
                    username,

                Result =
                    result,

                FailureReason =
                    failureReason,

                CallingStationId =
                    callingStationId,

                FramedIpAddress =
                    framedIp,

                AcctSessionId =
                    acctSessionId,

                NasIpAddress =
                    nas.NasIpAddress,

                RadiusIdentifier =
                    null,

                AuthenticationMethod =
                    authenticationMethod,

                CreatedAt =
                    DateTime.UtcNow
            };

        db.RadiusAuthenticationLogs.Add(log);

        // Keep the latest result on the subscriber so the subscriber list can
        // show "Wrong Password", "Expired" etc. without scanning the log table.
        if (subscriber != null)
        {
            subscriber.LastAuthResult = result;
            subscriber.LastAuthReason = failureReason;
            subscriber.LastAuthAt = DateTime.UtcNow;
        }

        await Task.CompletedTask;
    }

    // =========================================================
    // ACCESS REJECT
    // =========================================================

    private async Task SendAccessRejectAsync(
        byte[] requestPacket,
        byte identifier,
        byte[] requestAuthenticator,
        List<RadiusAttribute> requestAttributes,
        string sharedSecret,
        string message,
        bool includeMessageAuthenticator,
        IPEndPoint remoteEndpoint,
        UdpClient listener)
    {
        var attributes =
            new List<RadiusAttribute>
            {
                CreateStringAttribute(
                    ReplyMessage,
                    message)
            };

        // Preserve Proxy-State
        foreach (
            var proxyState in requestAttributes
                .Where(x => x.Type == ProxyState))
        {
            attributes.Add(
                new RadiusAttribute(
                    ProxyState,
                    proxyState.Value));
        }

        byte[] response =
            BuildResponsePacket(
                AccessReject,
                identifier,
                requestAuthenticator,
                attributes,
                sharedSecret,
                includeMessageAuthenticator);

        await listener.SendAsync(
            response,
            response.Length,
            remoteEndpoint);
    }

    // =========================================================
    // ACCOUNTING RESPONSE
    // =========================================================

    private async Task SendAccountingResponseAsync(
        byte[] requestPacket,
        byte identifier,
        byte[] requestAuthenticator,
        string sharedSecret,
        IPEndPoint remoteEndpoint,
        UdpClient listener)
    {
        byte[] response =
            new byte[20];

        response[0] =
            AccountingResponse;

        response[1] =
            identifier;

        response[2] =
            0;

        response[3] =
            20;

        Array.Copy(
            requestAuthenticator,
            0,
            response,
            4,
            16);

        using var md5 =
            MD5.Create();

        byte[] secretBytes =
            Encoding.UTF8.GetBytes(
                sharedSecret);

        byte[] hashInput =
            new byte[
                response.Length +
                secretBytes.Length];

        Array.Copy(
            response,
            hashInput,
            response.Length);

        Array.Copy(
            secretBytes,
            0,
            hashInput,
            response.Length,
            secretBytes.Length);

        byte[] hash =
            md5.ComputeHash(
                hashInput);

        Array.Copy(
            hash,
            0,
            response,
            4,
            16);

        await listener.SendAsync(
            response,
            response.Length,
            remoteEndpoint);
    }

    // =========================================================
    // BUILD ACCESS RESPONSE
    // =========================================================

    private static byte[] BuildResponsePacket(
        byte responseCode,
        byte identifier,
        byte[] requestAuthenticator,
        List<RadiusAttribute> attributes,
        string sharedSecret,
        bool includeMessageAuthenticator)
    {
        var finalAttributes =
            new List<RadiusAttribute>(
                attributes);

        if (includeMessageAuthenticator)
        {
            finalAttributes.Add(
                new RadiusAttribute(
                    MessageAuthenticator,
                    new byte[16]));
        }

        byte[] attributeBytes =
            SerializeAttributes(
                finalAttributes);

        ushort length =
            checked(
                (ushort)(
                    20 +
                    attributeBytes.Length));

        byte[] packet =
            new byte[length];

        packet[0] =
            responseCode;

        packet[1] =
            identifier;

        packet[2] =
            (byte)(length >> 8);

        packet[3] =
            (byte)(length & 0xFF);

        Array.Copy(
            requestAuthenticator,
            0,
            packet,
            4,
            16);

        Array.Copy(
            attributeBytes,
            0,
            packet,
            20,
            attributeBytes.Length);

        // -----------------------------------------------------
        // Message-Authenticator
        // -----------------------------------------------------

        if (includeMessageAuthenticator)
        {
            int maOffset =
                FindMessageAuthenticatorValueOffset(
                    packet);

            if (maOffset >= 0)
            {
                using var hmac =
                    new HMACMD5(
                        Encoding.UTF8.GetBytes(
                            sharedSecret));

                byte[] messageAuth =
                    hmac.ComputeHash(packet);

                Array.Copy(
                    messageAuth,
                    0,
                    packet,
                    maOffset,
                    16);
            }
        }

        // -----------------------------------------------------
        // Response Authenticator
        // -----------------------------------------------------

        using var md5 =
            MD5.Create();

        byte[] secret =
            Encoding.UTF8.GetBytes(
                sharedSecret);

        byte[] responseInput =
            new byte[
                packet.Length +
                secret.Length];

        Array.Copy(
            packet,
            0,
            responseInput,
            0,
            packet.Length);

        Array.Copy(
            secret,
            0,
            responseInput,
            packet.Length,
            secret.Length);

        byte[] responseAuthenticator =
            md5.ComputeHash(
                responseInput);

        Array.Copy(
            responseAuthenticator,
            0,
            packet,
            4,
            16);

        return packet;
    }

    // =========================================================
    // PARSE RADIUS PACKET
    // =========================================================

    private static bool TryParseRadiusPacket(
        byte[] packet,
        out byte code,
        out byte identifier,
        out byte[] requestAuthenticator,
        out List<RadiusAttribute> attributes)
    {
        code = 0;
        identifier = 0;
        requestAuthenticator = Array.Empty<byte>();
        attributes = new List<RadiusAttribute>();

        if (packet.Length < 20)
            return false;

        ushort length =
            ReadUInt16(
                packet,
                2);

        if (length < 20 ||
            length > 4096 ||
            length > packet.Length)
        {
            return false;
        }

        code =
            packet[0];

        identifier =
            packet[1];

        requestAuthenticator =
            new byte[16];

        Array.Copy(
            packet,
            4,
            requestAuthenticator,
            0,
            16);

        int offset = 20;

        while (offset < length)
        {
            if (offset + 2 > length)
                return false;

            byte type =
                packet[offset];

            byte attributeLength =
                packet[offset + 1];

            if (attributeLength < 2)
                return false;

            if (offset + attributeLength > length)
                return false;

            byte[] value =
                new byte[
                    attributeLength - 2];

            Array.Copy(
                packet,
                offset + 2,
                value,
                0,
                value.Length);

            attributes.Add(
                new RadiusAttribute(
                    type,
                    value,
                    offset));

            offset +=
                attributeLength;
        }

        return offset == length;
    }

    // =========================================================
    // RADIUS ATTRIBUTE HELPERS
    // =========================================================

    private static RadiusAttribute? GetAttribute(
        List<RadiusAttribute> attributes,
        byte type)
    {
        return attributes.FirstOrDefault(
            x => x.Type == type);
    }

    private static string? GetStringAttribute(
        List<RadiusAttribute> attributes,
        byte type)
    {
        var attribute =
            GetAttribute(
                attributes,
                type);

        if (attribute == null)
            return null;

        return Encoding.UTF8
            .GetString(attribute.Value)
            .TrimEnd('\0');
    }

    private static string? GetStringOrNumberAttribute(
        List<RadiusAttribute> attributes,
        byte type)
    {
        var attribute =
            GetAttribute(
                attributes,
                type);

        if (attribute == null)
            return null;

        if (attribute.Value.Length == 4)
        {
            return ReadUInt32(
                attribute.Value,
                0).ToString();
        }

        return Encoding.UTF8
            .GetString(attribute.Value)
            .TrimEnd('\0');
    }

    private static uint? GetUInt32Attribute(
        List<RadiusAttribute> attributes,
        byte type)
    {
        var attribute =
            GetAttribute(
                attributes,
                type);

        if (attribute == null ||
            attribute.Value.Length != 4)
        {
            return null;
        }

        return ReadUInt32(
            attribute.Value,
            0);
    }

    private static string? GetIpAttribute(
        List<RadiusAttribute> attributes,
        byte type)
    {
        var attribute =
            GetAttribute(
                attributes,
                type);

        if (attribute == null ||
            attribute.Value.Length != 4)
        {
            return null;
        }

        return new IPAddress(
            attribute.Value).ToString();
    }

    // =========================================================
    // 64 BIT ACCOUNTING COUNTER
    // =========================================================

    private static ulong GetCounter64(
        List<RadiusAttribute> attributes,
        byte lowType,
        byte? gigaWordsType)
    {
        ulong low =
            GetUInt32Attribute(
                attributes,
                lowType) ?? 0;

        if (!gigaWordsType.HasValue)
            return low;

        ulong high =
            GetUInt32Attribute(
                attributes,
                gigaWordsType.Value) ?? 0;

        return
            (high << 32) |
            low;
    }

    private static long ToLong(
        ulong value)
    {
        return value >
               long.MaxValue
            ? long.MaxValue
            : (long)value;
    }

    // =========================================================
    // PAP PASSWORD DECRYPTION
    // =========================================================

    private static string DecryptUserPassword(
        byte[] encryptedPassword,
        byte[] requestAuthenticator,
        string sharedSecret)
    {
        if (encryptedPassword.Length == 0 ||
            encryptedPassword.Length % 16 != 0)
        {
            return string.Empty;
        }

        if (encryptedPassword.Length > 128)
        {
            return string.Empty;
        }

        byte[] secret =
            Encoding.UTF8.GetBytes(
                sharedSecret);

        byte[] decrypted =
            new byte[
                encryptedPassword.Length];

        byte[] previous =
            requestAuthenticator;

        for (
            int offset = 0;
            offset < encryptedPassword.Length;
            offset += 16)
        {
            using var md5 =
                MD5.Create();

            byte[] hashInput =
                new byte[
                    secret.Length +
                    previous.Length];

            Array.Copy(
                secret,
                0,
                hashInput,
                0,
                secret.Length);

            Array.Copy(
                previous,
                0,
                hashInput,
                secret.Length,
                previous.Length);

            byte[] hash =
                md5.ComputeHash(
                    hashInput);

            for (int i = 0; i < 16; i++)
            {
                decrypted[offset + i] =
                    (byte)(
                        encryptedPassword[offset + i] ^
                        hash[i]);
            }

            previous =
                encryptedPassword
                    .Skip(offset)
                    .Take(16)
                    .ToArray();
        }

        int zeroIndex =
            Array.IndexOf(
                decrypted,
                (byte)0);

        if (zeroIndex >= 0)
        {
            return Encoding.UTF8.GetString(
                decrypted,
                0,
                zeroIndex);
        }

        return Encoding.UTF8.GetString(
            decrypted);
    }

    // =========================================================
    // CHAP
    // =========================================================

    private static bool VerifyChapPassword(
        byte[] chapPassword,
        List<RadiusAttribute> attributes,
        byte[] requestAuthenticator,
        string expectedPassword)
    {
        if (chapPassword.Length != 17)
            return false;

        byte chapId =
            chapPassword[0];

        byte[] receivedResponse =
            chapPassword
                .Skip(1)
                .Take(16)
                .ToArray();

        var challengeAttribute =
            GetAttribute(
                attributes,
                ChapChallenge);

        byte[] challenge;

        if (challengeAttribute != null &&
            challengeAttribute.Value.Length > 0)
        {
            challenge =
                challengeAttribute.Value;
        }
        else
        {
            challenge =
                requestAuthenticator;
        }

        using var md5 =
            MD5.Create();

        byte[] passwordBytes =
            Encoding.UTF8.GetBytes(
                expectedPassword);

        byte[] input =
            new byte[
                1 +
                passwordBytes.Length +
                challenge.Length];

        input[0] =
            chapId;

        Array.Copy(
            passwordBytes,
            0,
            input,
            1,
            passwordBytes.Length);

        Array.Copy(
            challenge,
            0,
            input,
            1 + passwordBytes.Length,
            challenge.Length);

        byte[] expectedResponse =
            md5.ComputeHash(input);

        return CryptographicOperations
            .FixedTimeEquals(
                receivedResponse,
                expectedResponse);
    }

    // =========================================================
    // AUTH METHOD DETECTION
    // =========================================================

    private static string DetectUnsupportedAuthenticationMethod(
        List<RadiusAttribute> attributes)
    {
        if (ContainsMschap2Response(attributes))
            return "MS-CHAPv2";

        if (ContainsMschapResponse(attributes))
            return "MS-CHAPv1";

        return "UNKNOWN";
    }

    private static bool ContainsMschap2Response(
        List<RadiusAttribute> attributes)
    {
        return attributes
            .Where(x =>
                x.Type == VendorSpecific)
            .Any(IsMicrosoftMschap2Response);
    }

    private static bool ContainsMschapResponse(
        List<RadiusAttribute> attributes)
    {
        return attributes
            .Where(x =>
                x.Type == VendorSpecific)
            .Any(IsMicrosoftMschapResponse);
    }

    private static bool IsMicrosoftMschap2Response(
        RadiusAttribute attribute)
    {
        if (attribute.Value.Length < 6)
            return false;

        uint vendorId =
            ReadUInt32(
                attribute.Value,
                0);

        byte vendorType =
            attribute.Value[4];

        return
            vendorId == 311 &&
            vendorType == 25;
    }

    private static bool IsMicrosoftMschapResponse(
        RadiusAttribute attribute)
    {
        if (attribute.Value.Length < 6)
            return false;

        uint vendorId =
            ReadUInt32(
                attribute.Value,
                0);

        byte vendorType =
            attribute.Value[4];

        return
            vendorId == 311 &&
            vendorType == 1;
    }

    // =========================================================
    // MESSAGE AUTHENTICATOR VALIDATION
    // =========================================================

    private static bool ValidateMessageAuthenticator(
        byte[] packet,
        List<RadiusAttribute> attributes,
        string sharedSecret)
    {
        var attribute =
            GetAttribute(
                attributes,
                MessageAuthenticator);

        if (attribute == null ||
            attribute.Value.Length != 16)
        {
            return false;
        }

        byte[] copy =
            packet.ToArray();

        int valueOffset =
            attribute.Offset + 2;

        Array.Clear(
            copy,
            valueOffset,
            16);

        using var hmac =
            new HMACMD5(
                Encoding.UTF8.GetBytes(
                    sharedSecret));

        byte[] expected =
            hmac.ComputeHash(
                copy);

        return CryptographicOperations
            .FixedTimeEquals(
                expected,
                attribute.Value);
    }

    // =========================================================
    // ACCOUNTING REQUEST AUTHENTICATOR
    // =========================================================

    private static bool VerifyAccountingRequestAuthenticator(
        byte[] packet,
        string sharedSecret)
    {
        if (packet.Length < 20)
            return false;

        ushort length =
            ReadUInt16(
                packet,
                2);

        if (length < 20 ||
            length > packet.Length)
        {
            return false;
        }

        byte[] received =
            new byte[16];

        Array.Copy(
            packet,
            4,
            received,
            0,
            16);

        byte[] copy =
            packet
                .Take(length)
                .ToArray();

        // RFC 2866:
        // Code + ID + Length + 16 zero octets +
        // Attributes + Shared Secret

        Array.Clear(
            copy,
            4,
            16);

        byte[] secret =
            Encoding.UTF8.GetBytes(
                sharedSecret);

        byte[] input =
            new byte[
                copy.Length +
                secret.Length];

        Array.Copy(
            copy,
            input,
            copy.Length);

        Array.Copy(
            secret,
            0,
            input,
            copy.Length,
            secret.Length);

        using var md5 =
            MD5.Create();

        byte[] expected =
            md5.ComputeHash(
                input);

        return CryptographicOperations
            .FixedTimeEquals(
                received,
                expected);
    }

    // =========================================================
    // RADIUS ATTRIBUTE CREATION
    // =========================================================

    private static RadiusAttribute CreateStringAttribute(
        byte type,
        string value)
    {
        return new RadiusAttribute(
            type,
            Encoding.UTF8.GetBytes(
                value));
    }

    private static RadiusAttribute CreateUInt32Attribute(
        byte type,
        uint value)
    {
        byte[] bytes =
            new byte[4];

        bytes[0] =
            (byte)(value >> 24);

        bytes[1] =
            (byte)(value >> 16);

        bytes[2] =
            (byte)(value >> 8);

        bytes[3] =
            (byte)value;

        return new RadiusAttribute(
            type,
            bytes);
    }

    // =========================================================
    // MIKROTIK RATE LIMIT
    // =========================================================

    private static RadiusAttribute
        CreateMikroTikRateLimitAttribute(
            string rateLimit)
    {
        byte[] rateBytes =
            Encoding.UTF8.GetBytes(
                rateLimit);

        byte vendorType =
            MikroTikRateLimitType;

        byte vendorLength =
            checked(
                (byte)(
                    2 +
                    rateBytes.Length));

        byte[] value =
            new byte[
                4 +
                1 +
                1 +
                rateBytes.Length];

        // Vendor ID 14988
        value[0] =
            (byte)(MikroTikVendorId >> 24);

        value[1] =
            (byte)(MikroTikVendorId >> 16);

        value[2] =
            (byte)(MikroTikVendorId >> 8);

        value[3] =
            (byte)(MikroTikVendorId & 0xFF);

        // Vendor type
        value[4] =
            vendorType;

        // Vendor length
        value[5] =
            vendorLength;

        Array.Copy(
            rateBytes,
            0,
            value,
            6,
            rateBytes.Length);

        return new RadiusAttribute(
            VendorSpecific,
            value);
    }

    // =========================================================
    // SERIALIZE ATTRIBUTES
    // =========================================================

    private static byte[] SerializeAttributes(
        List<RadiusAttribute> attributes)
    {
        using var stream =
            new MemoryStream();

        foreach (var attribute in attributes)
        {
            if (attribute.Value.Length > 253)
                throw new InvalidOperationException(
                    $"RADIUS attribute {attribute.Type} is too large.");

            stream.WriteByte(
                attribute.Type);

            stream.WriteByte(
                (byte)(
                    attribute.Value.Length +
                    2));

            stream.Write(
                attribute.Value,
                0,
                attribute.Value.Length);
        }

        return stream.ToArray();
    }

    // =========================================================
    // MESSAGE AUTHENTICATOR OFFSET
    // =========================================================

    private static int
        FindMessageAuthenticatorValueOffset(
            byte[] packet)
    {
        int offset = 20;

        while (offset + 2 <= packet.Length)
        {
            byte type =
                packet[offset];

            byte length =
                packet[offset + 1];

            if (length < 2 ||
                offset + length > packet.Length)
            {
                return -1;
            }

            if (type ==
                    MessageAuthenticator &&
                length == 18)
            {
                return offset + 2;
            }

            offset +=
                length;
        }

        return -1;
    }

    // =========================================================
    // FIXED TIME STRING COMPARISON
    // =========================================================

    private static bool FixedTimeStringEquals(
        string actual,
        string expected)
    {
        byte[] actualBytes =
            Encoding.UTF8.GetBytes(
                actual);

        byte[] expectedBytes =
            Encoding.UTF8.GetBytes(
                expected);

        return CryptographicOperations
            .FixedTimeEquals(
                actualBytes,
                expectedBytes);
    }

    // =========================================================
    // BINARY HELPERS
    // =========================================================

    private static ushort ReadUInt16(
        byte[] data,
        int offset)
    {
        return (ushort)(
            (data[offset] << 8) |
            data[offset + 1]);
    }

    private static uint ReadUInt32(
        byte[] data,
        int offset)
    {
        return
            ((uint)data[offset] << 24) |
            ((uint)data[offset + 1] << 16) |
            ((uint)data[offset + 2] << 8) |
            data[offset + 3];
    }

    // =========================================================
    // RADIUS ATTRIBUTE MODEL
    // =========================================================

    private sealed record RadiusAttribute(
        byte Type,
        byte[] Value,
        int Offset = -1);
}