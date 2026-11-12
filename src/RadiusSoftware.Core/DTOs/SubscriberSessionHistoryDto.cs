namespace RadiusSoftware.Core.DTOs;

public class SubscriberSessionHistoryDto
{
    public Guid Id { get; set; }

    public string Username { get; set; } = string.Empty;

    public string SessionId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public string? IpAddress { get; set; }

    public string? MacAddress { get; set; }

    public string? NasIpAddress { get; set; }

    public string? NasName { get; set; }

    public string? ServiceType { get; set; }

    public DateTime? StartTime { get; set; }

    public DateTime? LastUpdateTime { get; set; }

    public DateTime? StopTime { get; set; }

    public long SessionTime { get; set; }

    public long InputOctets { get; set; }

    public long OutputOctets { get; set; }

    public long InputPackets { get; set; }

    public long OutputPackets { get; set; }

    public string? TerminateCause { get; set; }

    public long TotalBytes =>
        InputOctets + OutputOctets;
}