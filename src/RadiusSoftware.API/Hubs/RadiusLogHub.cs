using Microsoft.AspNetCore.SignalR;

namespace RadiusSoftware.API.Hubs;

public class RadiusLogHub : Hub
{
    // Frontend clients is hub se connect honge.
    // Backend se hum iske zariye live messages push karenge.
}