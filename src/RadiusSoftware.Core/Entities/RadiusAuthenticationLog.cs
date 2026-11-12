using System.ComponentModel.DataAnnotations;

namespace RadiusSoftware.Core.Entities;

public class RadiusAuthenticationLog
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? SubscriberId { get; set; }

    public Guid? NasId { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Result { get; set; } = string.Empty;
    // ACCEPT / REJECT

    public string? FailureReason { get; set; }

    public string? CallingStationId { get; set; }
    // PPPoE client MAC

    public string? FramedIpAddress { get; set; }

    public string? AcctSessionId { get; set; }

    public string? NasIpAddress { get; set; }

    public int? RadiusIdentifier { get; set; }

    public string? AuthenticationMethod { get; set; }
    // PAP / CHAP / MS-CHAP / MS-CHAPv2

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}