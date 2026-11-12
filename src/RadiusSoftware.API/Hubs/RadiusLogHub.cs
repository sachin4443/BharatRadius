using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RadiusSoftware.API.Security;

namespace RadiusSoftware.API.Hubs;

/// <summary>
/// Live RADIUS log terminal. Only logged-in users can connect and every
/// connection only receives the logs of the sites it is allowed to see.
/// </summary>
[Authorize]
public class RadiusLogHub : Hub
{
    public const string SuperAdminGroup = "superadmin";
    public static string SiteGroup(Guid siteId) => $"site:{siteId}";

    private readonly ISiteAccessService _access;

    public RadiusLogHub(ISiteAccessService access)
    {
        _access = access;
    }

    public override async Task OnConnectedAsync()
    {
        if (_access.IsSuperAdmin)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, SuperAdminGroup);
        }
        else
        {
            var siteIds = await _access.GetAccessibleSiteIdsAsync() ?? new HashSet<Guid>();
            foreach (var siteId in siteIds)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, SiteGroup(siteId));
            }
        }

        await base.OnConnectedAsync();
    }
}
