    namespace RadiusSoftware.API.Services.MikroTik;

    public interface IMikroTikService
    {
        // ==========================================
        // MIKROTIK CONNECTION
        // ==========================================

        Task<MikroTikConnectionResult> TestConnectionAsync(
            string ip,
            int port,
            string username,
            string password);


        // ==========================================
        // RADIUS CONFIGURATION
        // ==========================================

        Task<MikroTikCommandResult> ConfigureRadiusAsync(
            string ip,
            int port,
            string username,
            string password,
            string radiusServerIp,
            int radiusAuthPort,
            int radiusAccountingPort,
            string sharedSecret);


        // ==========================================
        // PPP AAA CONFIGURATION
        // ==========================================

        Task<MikroTikCommandResult> ConfigurePppAaaAsync(
            string ip,
            int port,
            string username,
            string password,
            int interimTime);


        // ==========================================
        // VERIFY RADIUS
        // ==========================================

        Task<MikroTikCommandResult> VerifyRadiusConfigurationAsync(
            string ip,
            int port,
            string username,
            string password,
            string radiusServerIp,
            string sharedSecret);


        // ==========================================
        // VERIFY PPP AAA
        // ==========================================

        Task<MikroTikCommandResult> VerifyPppAaaConfigurationAsync(
            string ip,
            int port,
            string username,
            string password);


        // ==========================================
        // SUBSCRIBER DISCONNECT
        // ==========================================

        Task<MikroTikCommandResult> DisconnectPppSessionAsync(
            string ip,
            int port,
            string username,
            string password,
            string pppoeUsername);
    // ==========================================
    // SYSLOG / FIREWALL LOGGING CONFIGURATION
    // ==========================================
    Task<MikroTikCommandResult> ConfigureSyslogAsync(
        string ip,
        int port,
        string username,
        string password,
        string radiusServerIp,
        int syslogPort);
    Task<MikroTikCommandResult> ChangePppRateLimitAsync(
           string ip,
           int port,
           string username,
           string password,
           string acctSessionId,
           string rateLimit,
           string sharedSecret);

    }


    // ==========================================
    // MIKROTIK CONNECTION RESULT
    // ==========================================

    public class MikroTikConnectionResult
    {
        public bool Success { get; set; }

        public string Message { get; set; } = string.Empty;

        public string? Identity { get; set; }

        public string? Version { get; set; }
    }


    // ==========================================
    // MIKROTIK COMMAND RESULT
    // ==========================================

    public class MikroTikCommandResult
    {
        public bool Success { get; set; }

        public string Message { get; set; } = string.Empty;
    }

    // =========================================================
    // LIVE TRAFFIC RESULT
    // =========================================================

    public class MikroTikLiveTrafficResult
    {
        public bool Success { get; set; }

        public string Message { get; set; } = string.Empty;

        public string? InterfaceName { get; set; }

        public string? PppoeUsername { get; set; }

        public double DownloadMbps { get; set; }

        public double UploadMbps { get; set; }

        public long RxBitsPerSecond { get; set; }

        public long TxBitsPerSecond { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }