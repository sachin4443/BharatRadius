using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Security;

/// <summary>
/// Works out which sites the logged-in user is allowed to see/manage.
///
///  - Super admin (L0)            : every site
///  - Organization admin (no site): every site of the organization
///  - Site admin (L1/L2/L3...)    : own site + all child sites below it (any depth)
///
/// The result is cached for the lifetime of the HTTP request.
/// </summary>
public interface ISiteAccessService
{
    bool IsSuperAdmin { get; }
    Guid? CurrentUserId { get; }

    /// <summary>null means "all sites" (super admin).</summary>
    Task<HashSet<Guid>?> GetAccessibleSiteIdsAsync();

    Task<bool> CanAccessSiteAsync(Guid siteId);

    Task<bool> CanAccessSubscriberAsync(Guid subscriberId);

    /// <summary>The site that belongs to the logged-in user (null for org admins / super admin).</summary>
    Task<RadiusSoftware.Core.Entities.Site?> GetOwnSiteAsync();
}

public class SiteAccessService : ISiteAccessService
{
    private readonly AppDbContext _db;
    private readonly IHttpContextAccessor _http;
    private HashSet<Guid>? _cached;
    private bool _loaded;

    public SiteAccessService(AppDbContext db, IHttpContextAccessor http)
    {
        _db = db;
        _http = http;
    }

    private ClaimsPrincipal? User => _http.HttpContext?.User;

    public bool IsSuperAdmin =>
        string.Equals(User?.FindFirst("IsSuperAdmin")?.Value, "True", StringComparison.OrdinalIgnoreCase);

    public Guid? CurrentUserId
    {
        get
        {
            var raw = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User?.FindFirst("sub")?.Value;
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    public async Task<RadiusSoftware.Core.Entities.Site?> GetOwnSiteAsync()
    {
        var userId = CurrentUserId;
        if (userId == null) return null;
        return await _db.Sites.FirstOrDefaultAsync(s => s.UserId == userId && !s.IsDeleted);
    }

    public async Task<HashSet<Guid>?> GetAccessibleSiteIdsAsync()
    {
        if (IsSuperAdmin) return null;
        if (_loaded) return _cached!;

        var result = new HashSet<Guid>();
        var userId = CurrentUserId;

        if (userId != null)
        {
            var user = await _db.Users.AsNoTracking()
                .Where(u => u.Id == userId && u.IsActive)
                .Select(u => new { u.OrganizationId })
                .FirstOrDefaultAsync();

            if (user != null)
            {
                var orgSites = await _db.Sites.AsNoTracking()
                    .Where(s => s.ParentOrganisationID == user.OrganizationId && !s.IsDeleted)
                    .Select(s => new { s.Id, s.ParentSiteId, s.UserId, s.SiteLevel })
                    .ToListAsync();

                var ownSite = orgSites.FirstOrDefault(s => s.UserId == userId);

                if (ownSite == null || ownSite.SiteLevel == 0)
                {
                    // Organization admin -> whole organization
                    foreach (var s in orgSites) result.Add(s.Id);
                }
                else
                {
                    // Own site + every descendant
                    var children = orgSites
                        .Where(s => s.ParentSiteId.HasValue)
                        .ToLookup(s => s.ParentSiteId!.Value, s => s.Id);

                    var queue = new Queue<Guid>();
                    queue.Enqueue(ownSite.Id);
                    while (queue.Count > 0)
                    {
                        var id = queue.Dequeue();
                        if (!result.Add(id)) continue;
                        foreach (var child in children[id]) queue.Enqueue(child);
                    }
                }
            }
        }

        _cached = result;
        _loaded = true;
        return _cached;
    }

    public async Task<bool> CanAccessSiteAsync(Guid siteId)
    {
        var ids = await GetAccessibleSiteIdsAsync();
        return ids == null || ids.Contains(siteId);
    }

    public async Task<bool> CanAccessSubscriberAsync(Guid subscriberId)
    {
        var siteId = await _db.Subscribers.AsNoTracking()
            .Where(s => s.Id == subscriberId)
            .Select(s => (Guid?)s.SiteId)
            .FirstOrDefaultAsync();

        if (siteId == null) return true; // let the caller return 404
        return await CanAccessSiteAsync(siteId.Value);
    }
}
