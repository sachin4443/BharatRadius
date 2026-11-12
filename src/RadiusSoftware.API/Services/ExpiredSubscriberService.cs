using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Infrastructure.Data;

public class ExpiredSubscriberService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ExpiredSubscriberService> _logger;
    private readonly string _logDirectory;

    public ExpiredSubscriberService(
        IServiceScopeFactory scopeFactory,
        ILogger<ExpiredSubscriberService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _logDirectory = Path.Combine(Directory.GetCurrentDirectory(), "ExpireUserLogs");
    }

    private void WriteLogToFile(string message)
    {
        try
        {
            if (!Directory.Exists(_logDirectory))
            {
                Directory.CreateDirectory(_logDirectory);
            }

            var fileName = $"ExpireUserLogs_{DateTime.Now:yyyy-MM-dd}.txt";
            var filePath = Path.Combine(_logDirectory, fileName);

            var logEntry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}";
            File.AppendAllText(filePath, logEntry);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write logs to custom file.");
        }
    }

    private async Task ProcessExpiredSubscribersAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var mikroTik = scope.ServiceProvider.GetRequiredService<RadiusSoftware.API.Services.MikroTik.IMikroTikService>();

        var utcNow = DateTime.UtcNow;

        // Subscribers whose expiry time has passed and that still have a
        // "current" package or a live session. The account itself is NOT
        // switched off any more: the RADIUS server rejects expired users by
        // date, so a recharge immediately brings them back online and
        // "Suspended"/"Disabled" keep meaning a manual action only.
        var expiredSubscribers = await context.Subscribers
            .Where(s =>
                s.ExpireDate.HasValue &&
                s.ExpireDate.Value <= utcNow &&
                (context.SubscriberPackageHistories.Any(h => h.SubscriberId == s.Id && h.IsCurrent) ||
                 context.RadiusAccountingSessions.Any(r => r.SubscriberId == s.Id && r.IsActive)))
            .ToListAsync(stoppingToken);

        if (expiredSubscribers.Count == 0)
        {
            _logger.LogDebug("No newly expired subscribers found.");
            return;
        }

        var nasIds = expiredSubscribers.Where(s => s.NasId.HasValue).Select(s => s.NasId!.Value).Distinct().ToList();
        var nasById = await context.NasDevices.AsNoTracking()
            .Where(n => nasIds.Contains(n.Id))
            .ToDictionaryAsync(n => n.Id, stoppingToken);

        int disconnected = 0;

        foreach (var subscriber in expiredSubscribers)
        {
            // 1. Close current package history
            var currentHistories = await context.SubscriberPackageHistories
                .Where(h => h.SubscriberId == subscriber.Id && h.IsCurrent)
                .ToListAsync(stoppingToken);

            foreach (var history in currentHistories)
            {
                history.IsCurrent = false;
                history.EndedAt = subscriber.ExpireDate;
                // Action is kept as it was (ASSIGNED / RENEWED / CHANGED) so that
                // recharge reports stay correct; only the period is closed.
            }

            // 2. Kick the live PPPoE session off the router. The accounting
            //    STOP sent by the router then closes the session in the DB.
            var hasLiveSession = await context.RadiusAccountingSessions
                .AnyAsync(r => r.SubscriberId == subscriber.Id && r.IsActive, stoppingToken);

            if (hasLiveSession &&
                subscriber.NasId.HasValue &&
                nasById.TryGetValue(subscriber.NasId.Value, out var nas) &&
                !string.IsNullOrWhiteSpace(subscriber.PPPoEUsername))
            {
                try
                {
                    var result = await mikroTik.DisconnectPppSessionAsync(
                        nas.NasIpAddress, nas.ApiPort, nas.ApiUsername, nas.ApiPassword, subscriber.PPPoEUsername);
                    if (result.Success) disconnected++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not disconnect expired subscriber {Username}", subscriber.PPPoEUsername);
                }
            }

            subscriber.UpdatedAt = utcNow;
        }

        await context.SaveChangesAsync(stoppingToken);

        string logMsg = $"{expiredSubscribers.Count} expired subscribers processed, {disconnected} live sessions disconnected.";
        _logger.LogInformation("{LogMsg}", logMsg);
        WriteLogToFile(logMsg);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Expired Subscriber Service started.");
        WriteLogToFile("Expired Subscriber Service started.");

        // Wait a little so the app and DB are ready, then check every 5 minutes
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessExpiredSubscribersAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while processing expired subscribers.");
                WriteLogToFile($"ERROR: {ex.Message}");
            }

            try
            {
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("Expired Subscriber Service stopped.");
        WriteLogToFile("Expired Subscriber Service stopped.");
    }
}
