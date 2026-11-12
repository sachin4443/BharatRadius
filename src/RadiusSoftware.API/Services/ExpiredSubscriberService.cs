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

        var indiaTimeZone = TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata"
        );

        var nowIndia = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, indiaTimeZone);
        var todayLocalMidnight = nowIndia.Date;

        // Convert India local midnight to strict UTC DateTime with Utc kind for PostgreSQL compatibility
        var todayUtc = DateTime.SpecifyKind(
            TimeZoneInfo.ConvertTimeToUtc(todayLocalMidnight, indiaTimeZone),
            DateTimeKind.Utc
        );

        // Find all expired subscribers
        var expiredSubscribers =
            await context.Subscribers
                .Where(s =>
                    s.ExpireDate.HasValue &&
                    s.ExpireDate.Value < todayUtc &&
                    (s.ConnectionEnabled || s.IsActive)
                )
                .ToListAsync(stoppingToken);

        if (expiredSubscribers.Count > 0)
        {
            var utcNow = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);

            foreach (var subscriber in expiredSubscribers)
            {
                // 1. Disable Subscriber Account & Connection
                subscriber.ConnectionEnabled = false;
                subscriber.IsActive = false;
                subscriber.UpdatedAt = utcNow;

                // 2. Expire Current Package History
                var currentHistories = await context.SubscriberPackageHistories
                    .Where(h => h.SubscriberId == subscriber.Id && h.IsCurrent)
                    .ToListAsync(stoppingToken);

                foreach (var history in currentHistories)
                {
                    history.IsCurrent = false;
                    history.EndedAt = utcNow;
                    history.Action = "EXPIRED";
                    if (string.IsNullOrWhiteSpace(history.Comment))
                    {
                        history.Comment = "Package expired automatically.";
                    }
                }

                // 3. Stop Active Radius Accounting Sessions
                var activeSessions = await context.RadiusAccountingSessions
                    .Where(r => r.SubscriberId == subscriber.Id && r.IsActive)
                    .ToListAsync(stoppingToken);

                foreach (var session in activeSessions)
                {
                    session.IsActive = false;
                    session.StopTime = utcNow;
                    session.UpdatedAt = utcNow;
                    session.TerminateCause = "SubscriberExpired";
                }
            }

            await context.SaveChangesAsync(stoppingToken);

            string logMsg = $"{expiredSubscribers.Count} expired subscribers processed, deactivated, and sessions stopped.";
            _logger.LogInformation("{LogMsg}", logMsg);
            WriteLogToFile(logMsg);
        }
        else
        {
            string logMsg = "No expired subscribers found.";
            _logger.LogInformation("{LogMsg}", logMsg);
            WriteLogToFile(logMsg);
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Expired Subscriber Service started.");
        WriteLogToFile("Expired Subscriber Service started.");

        // Run immediately on startup
        try
        {
            WriteLogToFile("Executing immediate startup check for expired subscribers...");
            await ProcessExpiredSubscribersAsync(stoppingToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during startup expired subscriber check.");
            WriteLogToFile($"STARTUP ERROR: {ex.Message} | StackTrace: {ex.StackTrace}");
        }

        // Daily Recurring Loop at 00:01 AM
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var indiaTimeZone =
                    TimeZoneInfo.FindSystemTimeZoneById(
                        OperatingSystem.IsWindows()
                            ? "India Standard Time"
                            : "Asia/Kolkata"
                    );

                var nowIndia =
                    TimeZoneInfo.ConvertTimeFromUtc(
                        DateTime.UtcNow,
                        indiaTimeZone
                    );

                var nextRun = nowIndia.Date.AddDays(1).AddMinutes(1);
                var delay = nextRun - nowIndia;

                _logger.LogInformation(
                    "Expired Subscriber Service next run: {NextRun}",
                    nextRun);

                await Task.Delay(delay, stoppingToken);

                if (stoppingToken.IsCancellationRequested)
                    break;

                await ProcessExpiredSubscribersAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error while processing expired subscribers in loop.");

                WriteLogToFile($"ERROR: {ex.Message} | StackTrace: {ex.StackTrace}");

                await Task.Delay(
                    TimeSpan.FromMinutes(1),
                    stoppingToken
                );
            }
        }

        _logger.LogInformation("Expired Subscriber Service stopped.");
        WriteLogToFile("Expired Subscriber Service stopped.");
    }
}