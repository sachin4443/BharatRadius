using RadiusSoftware.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Core.DTOs;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;
using System.Security.Claims;

namespace RadiusSoftware.API.Controllers;

[Authorize]
[SiteScoped(ScopedResource.Site, "id", "siteId")]
[Route("api/[controller]")]
[ApiController]
public class SitesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IEmailService _emailService; // 🚀 Yeh field add karein

    public SitesController(AppDbContext context, IEmailService emailService) // 🚀 Parameter add karein
    {
        _context = context;
        _emailService = emailService; // 🚀 Assign karein
    }
    [HttpGet("list")]
    public async Task<IActionResult> GetSites()
    {
        var orgIdStr = User.FindFirst("OrganizationId")?.Value;
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        var isSuperAdmin = User.FindFirst("IsSuperAdmin")?.Value == "True";

        var query = _context.Sites.Include(s => s.User).AsQueryable();

        if (!isSuperAdmin)
        {
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var currentUserId))
            {
                return Unauthorized();
            }

            Guid? orgId = !string.IsNullOrEmpty(orgIdStr) ? Guid.Parse(orgIdStr) : (Guid?)null;

            var loggedInSite = await _context.Sites.FirstOrDefaultAsync(s => s.UserId == currentUserId);

            if (loggedInSite != null)
            {
                // Agar site user ka level 0 hai toh use saare records dikhenge
                if (loggedInSite.SiteLevel == 0)
                {
                    query = query.Where(s => s.ParentOrganisationID == loggedInSite.ParentOrganisationID);
                }
                else
                {
                    // Level > 0 wale user ko sirf uske under create huye child sites dikhenge
                    query = query.Where(s => s.ParentSiteId == loggedInSite.Id);
                }
            }
            else if (orgId.HasValue)
            {
                // Organization root admin (level 0 / ClientPortal) ko apni organization ke saare sites dikhenge
                query = query.Where(s => s.ParentOrganisationID == orgId.Value);
            }
            else
            {
                query = query.Where(s => false);
            }
        }

        var sites = await query
            .Where(s => !s.IsDeleted)
            .OrderByDescending(s => s.AddDate)
            .ToListAsync();

        return Ok(sites);
    }

    [HttpPost("create-site")]
    public async Task<IActionResult> CreateSite([FromBody] CreateSiteDto model)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        Guid parentOrgId;
        Guid? parentSiteId = null;
        int? parentSiteMsrNumber = null;
        int siteLevel = 1; // Default level 1 when created under an Organization

        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var currentUserId))
        {
            var orgIdStr = User.FindFirst("OrganizationId")?.Value;
            if (string.IsNullOrEmpty(orgIdStr)) return Unauthorized();
            parentOrgId = Guid.Parse(orgIdStr);
        }
        else
        {
            var currentUser = await _context.Users.FindAsync(currentUserId);
            if (currentUser == null || currentUser.OrganizationId == Guid.Empty)
            {
                return Unauthorized(new { message = "Logged-in user organization not found." });
            }
            parentOrgId = currentUser.OrganizationId;

            // Check if logged-in user is a Site owner
            var loggedInSite = await _context.Sites.FirstOrDefaultAsync(s => s.UserId == currentUserId);
            if (loggedInSite != null)
            {
                parentSiteId = loggedInSite.Id;
                parentSiteMsrNumber = loggedInSite.SiteMsrNumber;
                siteLevel = loggedInSite.SiteLevel + 1; // Child gets Level 2, 3 etc.
            }
            else
            {
                siteLevel = 1; // Created directly by Organization Admin
            }
        }

        // Global SiteMsrNumber increment
        int nextMsrNumber = 1;
        var maxMsr = await _context.Sites.MaxAsync(s => (int?)s.SiteMsrNumber);
        if (maxMsr.HasValue)
        {
            nextMsrNumber = maxMsr.Value + 1;
        }

        // 1. Create User
        var user = new User
        {
            Id = Guid.NewGuid(),
            OrganizationId = parentOrgId,
            FullName = model.AdminFullName,
            Username = model.AdminUsername,
            Email = model.AdminEmail,
            Mobile = model.AdminMobile,
            PasswordHash = RadiusSoftware.API.Security.PasswordUtil.Hash(model.AdminPassword),
            IsSuperAdmin = false,
            IsActive = true
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // 2. Default Role for Site
        var siteRole = new Role
        {
            Id = Guid.NewGuid(),
            OrganizationId = parentOrgId,
            Name = $"{model.SiteName} - Admin",
            Description = $"Role for {model.SiteName} (Level {siteLevel})"
        };

        _context.Roles.Add(siteRole);
        await _context.SaveChangesAsync();

        // 3. Permissions
        if (model.MenuIds != null && model.MenuIds.Any())
        {
            var permissions = model.MenuIds.Select(menuId => new RoleMenuPermission
            {
                Id = Guid.NewGuid(),
                RoleId = siteRole.Id,
                MenuId = menuId,
                CanView = true,
                CanCreate = true,
                CanEdit = true,
                CanDelete = true
            }).ToList();

            _context.RoleMenuPermissions.AddRange(permissions);
            await _context.SaveChangesAsync();
        }

        // 4. Assign Role
        _context.UserRoles.Add(new UserRole
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            RoleId = siteRole.Id
        });
        await _context.SaveChangesAsync();

        // 5. Create Site
        var site = new Site
        {
            Id = Guid.NewGuid(),
            ParentOrganisationID = parentOrgId,
            ParentSiteId = parentSiteId,
            ParentSiteMsrNumber = parentSiteMsrNumber,
            SiteLevel = siteLevel,
            Level = siteLevel,
            SiteMsrNumber = nextMsrNumber,
            SiteName = model.SiteName,
            SiteEmail = model.SiteEmail,
            SiteDomain = model.SiteDomain,
            SiteMobileNo = model.SiteMobileNo,
            UseOwnDomain = model.UseOwnDomain,
            CompanyName = model.CompanyName,
            CompanyTagline = model.CompanyTagline,
            SiteAddress = model.SiteAddress,
            SiteDescription = model.SiteDescription,
            State = model.State,
            City = model.City,
            Zip = model.Zip,
            BusinessType = model.BusinessType,
            CurrencyId = model.CurrencyId,
            TimeZone = model.TimeZone,
            UserId = user.Id,
            IsActive = true,
            AddDate = DateTime.UtcNow,
            LastUpdate = DateTime.UtcNow
        };

        _context.Sites.Add(site);
        await _context.SaveChangesAsync();
        // 🚀 Send Welcome Email to the newly created site admin with credentials and log to DB
        // 🚀 Send Professional HTML Welcome Email to the newly created site admin
        if (!string.IsNullOrWhiteSpace(user.Email))
        {
            await _emailService.SendSiteWelcomeEmailAsync(
                site.Id,
                user.Email,
                user.FullName,
                user.Username,
                model.AdminPassword,
                site.SiteName,
                site.CompanyName,
                site.SiteDomain
            );
        }

        // Dubara repeat hone wale extra Ok() response ko yahan se hata diya gaya hai
        return Ok(new
        {
            message = "Site and Admin User created successfully and welcome email sent!",
            siteId = site.Id,
            siteMsr = site.SiteMsrNumber,
            parentMsr = site.ParentSiteMsrNumber,
            level = site.SiteLevel
        });
    }

    [HttpPut("update-site/{id}")]
    public async Task<IActionResult> UpdateSite(Guid id, [FromBody] CreateSiteDto model)
    {
        var site = await _context.Sites.Include(s => s.User).FirstOrDefaultAsync(s => s.Id == id);
        if (site == null) return NotFound(new { message = "Site not found." });

        site.SiteName = model.SiteName;
        site.SiteEmail = model.SiteEmail;
        site.SiteDomain = model.SiteDomain;
        site.SiteMobileNo = model.SiteMobileNo;
        site.UseOwnDomain = model.UseOwnDomain;
        site.CompanyName = model.CompanyName;
        site.CompanyTagline = model.CompanyTagline;
        site.SiteAddress = model.SiteAddress;
        site.SiteDescription = model.SiteDescription;
        site.State = model.State;
        site.City = model.City;
        site.Zip = model.Zip;
        site.BusinessType = model.BusinessType;
        site.CurrencyId = model.CurrencyId;
        site.TimeZone = model.TimeZone;
        site.LastUpdate = DateTime.UtcNow;

        if (site.UserId != null && site.UserId != Guid.Empty)
        {
            var user = await _context.Users.FindAsync(site.UserId);
            if (user != null)
            {
                user.FullName = model.AdminFullName;
                user.Username = model.AdminUsername;
                user.Email = model.AdminEmail;
                user.Mobile = model.AdminMobile;
                if (!string.IsNullOrEmpty(model.AdminPassword))
                {
                    user.PasswordHash = RadiusSoftware.API.Security.PasswordUtil.Hash(model.AdminPassword);
                }

                var userRole = await _context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == user.Id);
                if (userRole != null && model.MenuIds != null)
                {
                    var existingPermissions = await _context.RoleMenuPermissions
                        .Where(rmp => rmp.RoleId == userRole.RoleId)
                        .ToListAsync();

                    _context.RoleMenuPermissions.RemoveRange(existingPermissions);

                    var newPermissions = model.MenuIds.Select(menuId => new RoleMenuPermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = userRole.RoleId,
                        MenuId = menuId,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    }).ToList();

                    _context.RoleMenuPermissions.AddRange(newPermissions);
                }
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Site updated successfully!" });
    }

    [HttpPut("toggle-status/{id}")]
    public async Task<IActionResult> ToggleStatus(Guid id)
    {
        var site = await _context.Sites.FindAsync(id);
        if (site == null) return NotFound();

        site.IsActive = !site.IsActive;
        site.LastUpdate = DateTime.UtcNow;

        if (site.UserId.HasValue)
        {
            var user = await _context.Users.FindAsync(site.UserId.Value);
            if (user != null) user.IsActive = site.IsActive;
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = site.IsActive ? "Site activated" : "Site deactivated" });
    }

    [HttpGet("site-menus/{siteId}")]
    public async Task<IActionResult> GetSiteMenus(Guid siteId)
    {
        var site = await _context.Sites.FindAsync(siteId);
        if (site == null || !site.UserId.HasValue) return Ok(new List<string>());

        var userRole = await _context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == site.UserId.Value);
        if (userRole == null) return Ok(new List<string>());

        var menuIds = await _context.RoleMenuPermissions
            .Where(rmp => rmp.RoleId == userRole.RoleId)
            .Select(rmp => rmp.MenuId)
            .ToListAsync();

        return Ok(menuIds);
    }

    [HttpGet("allowed-menus")]
    public async Task<IActionResult> GetAllowedMenusForSiteCreation()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var isSuperAdmin = User.FindFirst("IsSuperAdmin")?.Value == "True";

        var menusQuery = _context.Menus.AsQueryable();

        if (!isSuperAdmin && !string.IsNullOrEmpty(userIdStr) && Guid.TryParse(userIdStr, out var currentUserId))
        {
            var userRole = await _context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == currentUserId);
            if (userRole != null)
            {
                var permittedMenuIds = await _context.RoleMenuPermissions
                    .Where(rmp => rmp.RoleId == userRole.RoleId)
                    .Select(rmp => rmp.MenuId)
                    .ToListAsync();

                menusQuery = menusQuery.Where(m => permittedMenuIds.Contains(m.Id));
            }
        }

        var menus = await menusQuery.OrderBy(m => m.DisplayOrder).ToListAsync();
        return Ok(menus);
    }

    [HttpDelete("delete/{id}")]
    public async Task<IActionResult> DeleteSite(Guid id)
    {
        var site = await _context.Sites.FindAsync(id);
        if (site == null) return NotFound(new { message = "Site not found." });

        if (site.UserId.HasValue)
        {
            var siteUser = await _context.Users.FindAsync(site.UserId.Value);
            if (siteUser != null)
            {
                var userRoles = await _context.UserRoles.Where(ur => ur.UserId == siteUser.Id).ToListAsync();
                foreach (var ur in userRoles)
                {
                    var permissions = await _context.RoleMenuPermissions.Where(rmp => rmp.RoleId == ur.RoleId).ToListAsync();
                    _context.RoleMenuPermissions.RemoveRange(permissions);

                    var role = await _context.Roles.FindAsync(ur.RoleId);
                    if (role != null) _context.Roles.Remove(role);
                }
                _context.UserRoles.RemoveRange(userRoles);
                _context.Users.Remove(siteUser);
            }
        }

        _context.Sites.Remove(site);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Site and associated admin credentials deleted permanently!" });
    }
}