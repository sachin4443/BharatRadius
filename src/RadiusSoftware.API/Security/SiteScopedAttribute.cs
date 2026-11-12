using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Security;

public enum ScopedResource
{
    Subscriber,
    Nas,
    Package,
    Site,
    CafDocument
}

/// <summary>
/// Blocks access to a record (subscriber, NAS, package...) that does not belong to
/// one of the sites the logged-in user may manage. The record id is read from the
/// given route values (default: "id"). Unknown ids are let through so the action
/// can return its normal 404.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public class SiteScopedAttribute : Attribute, IAsyncActionFilter
{
    private readonly ScopedResource _resource;
    private readonly string[] _routeKeys;

    public SiteScopedAttribute(ScopedResource resource, params string[] routeKeys)
    {
        _resource = resource;
        _routeKeys = routeKeys.Length == 0 ? new[] { "id" } : routeKeys;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var services = context.HttpContext.RequestServices;
        var access = services.GetRequiredService<ISiteAccessService>();

        if (!access.IsSuperAdmin)
        {
            var db = services.GetRequiredService<AppDbContext>();

            foreach (var key in _routeKeys)
            {
                if (!context.RouteData.Values.TryGetValue(key, out var raw) ||
                    !Guid.TryParse(raw?.ToString(), out var id))
                    continue;

                Guid? siteId = _resource switch
                {
                    ScopedResource.Subscriber => await db.Subscribers.AsNoTracking()
                        .Where(x => x.Id == id).Select(x => (Guid?)x.SiteId).FirstOrDefaultAsync(),
                    ScopedResource.Nas => await db.NasDevices.AsNoTracking()
                        .Where(x => x.Id == id).Select(x => (Guid?)x.SiteId).FirstOrDefaultAsync(),
                    ScopedResource.Package => await db.PackageProfiles.AsNoTracking()
                        .Where(x => x.Id == id).Select(x => (Guid?)x.SiteId).FirstOrDefaultAsync(),
                    ScopedResource.Site => id,
                    ScopedResource.CafDocument => await (
                        from d in db.CAFDocuments.AsNoTracking()
                        join s in db.Subscribers.AsNoTracking() on d.SubscriberId equals s.Id
                        where d.Id == id
                        select (Guid?)s.SiteId).FirstOrDefaultAsync(),
                    _ => null
                };

                if (siteId.HasValue && !await access.CanAccessSiteAsync(siteId.Value))
                {
                    context.Result = new ObjectResult(new
                    {
                        success = false,
                        message = "You do not have access to this record."
                    })
                    { StatusCode = StatusCodes.Status403Forbidden };
                    return;
                }
            }
        }

        await next();
    }
}
