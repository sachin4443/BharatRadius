using Microsoft.EntityFrameworkCore;
using RadiusSoftware.API.Services.MikroTik;
using RadiusSoftware.Infrastructure.Data;

public class AutoConfigureNasService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AutoConfigureNasService> _logger;
    private readonly IConfiguration _configuration;

    public AutoConfigureNasService(
        IServiceScopeFactory scopeFactory,
        ILogger<AutoConfigureNasService> logger,
        IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Thoda wait karein taaki app completely start ho jaye aur DB ready rahe
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var mikroTikService = scope.ServiceProvider.GetRequiredService<IMikroTikService>();

            string radiusServerIp = _configuration["RadiusServer:ServerAddress"] ?? "127.0.0.1";
            int radiusAuthPort = int.TryParse(_configuration["RadiusServer:AuthenticationPort"], out var auth) ? auth : 1812;
            int radiusAcctPort = int.TryParse(_configuration["RadiusServer:AccountingPort"], out var acct) ? acct : 1813;

            // Database se saare enabled NAS devices uthayein
            var nasDevices = await context.NasDevices
                .Where(n => n.IsEnabled)
                .ToListAsync(stoppingToken);

            _logger.LogInformation("Auto-configuring {Count} NAS devices on startup...", nasDevices.Count);

            foreach (var nas in nasDevices)
            {
                try
                {
                    // 1. Test Connection
                    var connResult = await mikroTikService.TestConnectionAsync(
                        nas.NasIpAddress, nas.ApiPort, nas.ApiUsername, nas.ApiPassword);

                    if (!connResult.Success)
                    {
                        nas.IsOnline = false;
                        nas.RadiusStatus = "FAILED";
                        nas.RadiusConfigError = connResult.Message;
                        continue;
                    }

                    nas.IsOnline = true;
                    nas.LastSeen = DateTime.UtcNow;

                    // 2. Configure Radius
                    await mikroTikService.ConfigureRadiusAsync(
                        nas.NasIpAddress, nas.ApiPort, nas.ApiUsername, nas.ApiPassword,
                        radiusServerIp, radiusAuthPort, radiusAcctPort, nas.SharedSecret);

                    // 3. Configure PPP AAA
                    await mikroTikService.ConfigurePppAaaAsync(
                        nas.NasIpAddress, nas.ApiPort, nas.ApiUsername, nas.ApiPassword, nas.InterimTime);

                    // 4. Configure Syslog / Firewall Logging
                    await mikroTikService.ConfigureSyslogAsync(
                        nas.NasIpAddress, nas.ApiPort, nas.ApiUsername, nas.ApiPassword, radiusServerIp, 514);

                    nas.IsRadiusConfigured = true;
                    nas.IsAccountingConfigured = true;
                    nas.RadiusStatus = "CONFIGURED";
                    nas.RadiusConfigError = null;
                    nas.RadiusConfiguredAt = DateTime.UtcNow;

                    _logger.LogInformation("Successfully auto-configured NAS: {NasName} ({Ip})", nas.NasName, nas.NasIpAddress);
                }
                catch (Exception ex)
                {
                    nas.RadiusStatus = "FAILED";
                    nas.RadiusConfigError = ex.Message;
                    _logger.LogError(ex, "Failed to auto-configure NAS {NasName}", nas.NasName);
                }
            }

            await context.SaveChangesAsync(stoppingToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in AutoConfigureNasService startup.");
        }
    }
}