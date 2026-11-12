using System.ComponentModel.DataAnnotations;

namespace RadiusSoftware.Core.Entities;

public class RadiusAccountingSession
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? SubscriberId { get; set; }

    public Guid? NasId { get; set; }

    public string Username { get; set; } = string.Empty;

    // RADIUS Acct-Session-Id
    public string AcctSessionId { get; set; } = string.Empty;

    // Start / Interim-Update / Stop
    public string AcctStatusType { get; set; } = string.Empty;

    public string? AcctAuthentic { get; set; }

    // Network information
    public string? FramedIpAddress { get; set; }

    public string? CallingStationId { get; set; }

    public string? CalledStationId { get; set; }

    public string? NasIpAddress { get; set; }

    public string? NasPort { get; set; }

    public string? NasPortType { get; set; }

    public string? ServiceType { get; set; }

    // Time
    public DateTime? StartTime { get; set; }

    public DateTime? LastUpdateTime { get; set; }

    public DateTime? StopTime { get; set; }

    public long SessionTime { get; set; }

    // Traffic
    public long InputOctets { get; set; }

    public long OutputOctets { get; set; }

    public long InputPackets { get; set; }

    public long OutputPackets { get; set; }

    // Termination
    public string? TerminateCause { get; set; }

    // Current state
    public bool IsActive { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}