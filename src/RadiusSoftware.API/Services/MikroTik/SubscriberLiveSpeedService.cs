using Microsoft.EntityFrameworkCore;
using RadiusSoftware.API.Services.MikroTik;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Services.SubscriberLiveSpeed;

/// <summary>
/// Live speed of one PPPoE subscriber, read from the router's dynamic
/// &lt;pppoe-username&gt; interface (RouterApi: fast, no python process).
/// RX on that interface = subscriber upload, TX = subscriber download.
/// </summary>
public sealed class SubscriberLiveSpeedService : ISubscriberLiveSpeedService
{
    private readonly AppDbContext _context;
    private readonly ILogger<SubscriberLiveSpeedService> _logger;

    public SubscriberLiveSpeedService(AppDbContext context, ILogger<SubscriberLiveSpeedService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<SubscriberLiveSpeedResult?> GetLiveSpeedAsync(Guid subscriberId)
    {
        var data = await (
            from s in _context.Subscribers.AsNoTracking()
            join n in _context.NasDevices.AsNoTracking() on s.NasId equals n.Id
            where s.Id == subscriberId && n.IsEnabled
            select new { Sub = s, Nas = n }
        ).FirstOrDefaultAsync();

        if (data == null)
            return null;

        var interfaceName = $"<pppoe-{data.Sub.PPPoEUsername}>";

        var result = new SubscriberLiveSpeedResult
        {
            SubscriberId = data.Sub.Id,
            SubscriberName = data.Sub.FullName ?? "",
            Username = data.Sub.PPPoEUsername ?? "",
            NasName = data.Nas.NasName,
            NasIpAddress = data.Nas.NasIpAddress,
            InterfaceName = interfaceName,
            Timestamp = DateTime.UtcNow
        };

        try
        {
            var traffic = await RouterApi.RunAsync(data.Nas, connection =>
                RouterApi.InterfaceTraffic(connection, new[] { interfaceName }));

            if (!traffic.TryGetValue(interfaceName, out var t))
            {
                result.Message = "Subscriber is not connected on the router.";
                return result;
            }

            result.Success = true;
            result.Online = true;
            result.RxBitsPerSecond = t.rx;
            result.TxBitsPerSecond = t.tx;
            result.UploadMbps = t.rx / 1_000_000d;
            result.DownloadMbps = t.tx / 1_000_000d;
            result.UploadKbps = t.rx / 1_000d;
            result.DownloadKbps = t.tx / 1_000d;
            result.Timestamp = DateTime.UtcNow;
            result.Message = "Live traffic fetched from MikroTik.";
            return result;
        }
        catch (Exception ex)
        {
            if (ex is not RouterUnreachableException)
                _logger.LogWarning(ex, "LIVE TRAFFIC ERROR | Subscriber={SubscriberId}", subscriberId);
            result.Success = false;
            result.Online = false;
            result.Message = ex.Message;
            return result;
        }
    }
}
