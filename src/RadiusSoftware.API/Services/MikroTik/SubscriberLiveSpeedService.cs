using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Services.SubscriberLiveSpeed;

public sealed class SubscriberLiveSpeedService : ISubscriberLiveSpeedService
{
    private readonly AppDbContext _context;
    private readonly ILogger<SubscriberLiveSpeedService> _logger;

    public SubscriberLiveSpeedService(
        AppDbContext context,
        ILogger<SubscriberLiveSpeedService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<SubscriberLiveSpeedResult?> GetLiveSpeedAsync(Guid subscriberId)
    {
        var data = await (
            from s in _context.Subscribers
            join n in _context.NasDevices
                on s.NasId equals n.Id
            where s.Id == subscriberId && n.IsEnabled
            select new
            {
                s.Id,
                s.FullName,
                s.PPPoEUsername,
                n.NasName,
                n.NasIpAddress,
                n.ApiPort,
                n.ApiUsername,
                n.ApiPassword
            }
        )
        .AsNoTracking()
        .FirstOrDefaultAsync();

        if (data == null)
            return null;

        var interfaceName = $"<pppoe-{data.PPPoEUsername}>";

        var result = new SubscriberLiveSpeedResult
        {
            SubscriberId = data.Id,
            SubscriberName = data.FullName ?? "",
            Username = data.PPPoEUsername ?? "",
            NasName = data.NasName,
            NasIpAddress = data.NasIpAddress,
            InterfaceName = interfaceName,
            Timestamp = DateTime.UtcNow
        };

        try
        {
            var pythonFile = Path.Combine(
                Directory.GetCurrentDirectory(),
                "Pythonfiles",
                "get_subscriber_traffic.py");

            if (!File.Exists(pythonFile))
            {
                result.Message = "get_subscriber_traffic.py not found.";
                return result;
            }

            var psi = new ProcessStartInfo
            {
                FileName = "python",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            psi.ArgumentList.Add(pythonFile);
            psi.ArgumentList.Add(data.NasIpAddress);
            psi.ArgumentList.Add(data.ApiUsername);
            psi.ArgumentList.Add(data.ApiPassword);
            psi.ArgumentList.Add(data.ApiPort.ToString());
            psi.ArgumentList.Add(interfaceName);

            using var process = new Process { StartInfo = psi };

            process.Start();

            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();

            // Timeout increased to 15 seconds to prevent network lag timeouts
            var finished = await Task.WhenAny(
                process.WaitForExitAsync(),
                Task.Delay(15000));

            if (!finished.IsCompletedSuccessfully)
            {
                try
                {
                    if (!process.HasExited)
                        process.Kill(true);
                }
                catch { }

                result.Message = "Live traffic request timed out.";
                return result;
            }

            var output = await outputTask;
            var error = await errorTask;

            if (!string.IsNullOrWhiteSpace(error))
            {
                _logger.LogWarning("LIVE TRAFFIC PYTHON ERROR | {Error}", error);
            }

            var traffic = JsonSerializer.Deserialize<PythonTrafficResult>(
                output,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

            if (traffic == null || !traffic.Success)
            {
                result.Message = traffic?.Message ?? "Invalid Python traffic response.";
                return result;
            }

            result.Success = true;
            result.Online = true;
            result.RxBytes = traffic.RxBytes;
            result.TxBytes = traffic.TxBytes;
            result.RxBitsPerSecond = traffic.Rx;
            result.TxBitsPerSecond = traffic.Tx;
            result.DownloadMbps = traffic.DownloadMbps;
            result.UploadMbps = traffic.UploadMbps;
            result.DownloadKbps = traffic.DownloadKbps;
            result.UploadKbps = traffic.UploadKbps;
            result.Timestamp = DateTime.UtcNow;
            result.Message = "Live traffic fetched from MikroTik.";

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "LIVE TRAFFIC ERROR | Subscriber={SubscriberId}", subscriberId);
            result.Success = false;
            result.Online = false;
            result.Message = ex.Message;
            return result;
        }
    }
}

public sealed class PythonTrafficResult
{
    public bool Success { get; set; }
    public string? Interface { get; set; }
    public long RxBytes { get; set; }
    public long TxBytes { get; set; }
    public long Rx { get; set; }
    public long Tx { get; set; }
    public long DownloadBps { get; set; }
    public long UploadBps { get; set; }
    public double DownloadMbps { get; set; }
    public double UploadMbps { get; set; }
    public double DownloadKbps { get; set; }
    public double UploadKbps { get; set; }
    public int SampleSeconds { get; set; }
    public string? Message { get; set; }
}

