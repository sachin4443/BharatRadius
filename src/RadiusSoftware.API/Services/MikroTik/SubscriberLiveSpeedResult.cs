namespace RadiusSoftware.API.Services.SubscriberLiveSpeed;

public sealed class SubscriberLiveSpeedResult
{
    public bool Success { get; set; }

    public bool Online { get; set; }

    public Guid SubscriberId { get; set; }

    public string SubscriberName { get; set; } = "";

    public string Username { get; set; } = "";

    public string? NasName { get; set; }

    public string? NasIpAddress { get; set; }

    public string? InterfaceName { get; set; }

    public double DownloadMbps { get; set; }

    public double UploadMbps { get; set; }

    public double DownloadKbps { get; set; }

    public double UploadKbps { get; set; }

    public long RxBitsPerSecond { get; set; }

    public long TxBitsPerSecond { get; set; }

    public long RxBytes { get; set; }

    public long TxBytes { get; set; }

    public DateTime Timestamp { get; set; }

    public string Message { get; set; } = "";
}