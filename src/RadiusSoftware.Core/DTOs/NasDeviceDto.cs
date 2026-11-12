namespace RadiusSoftware.Core.DTOs;

public class NasDeviceDto
{
    public Guid Id { get; set; }
    public Guid SiteId { get; set; }
    public string NasName { get; set; } = string.Empty;
    public string NasType { get; set; } = "MikroTik";
    public string NasIpAddress { get; set; } = string.Empty;
    public string SharedSecret { get; set; } = string.Empty;
    public int CoaPort { get; set; } = 3799;
    public int InterimTime { get; set; } = 300;
    public bool IsEnabled { get; set; } = true;
    public string ApiUsername { get; set; } = string.Empty;
    public string ApiPassword { get; set; } = string.Empty;
    public int ApiPort { get; set; } = 8728;
    public int WinboxPort { get; set; } = 8291;
    public bool IsOnline { get; set; }
}