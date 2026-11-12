using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;
using System.Security.Claims;

namespace RadiusSoftware.API.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class RoleManagementController : ControllerBase
{
    private readonly AppDbContext _context;

    public RoleManagementController(AppDbContext context)
    {
        _context = context;
    }

    // 1. Get Organization Roles, Menus & Users
    [HttpGet("company-setup/{organizationId}")]
    public async Task<IActionResult> GetCompanySetup(Guid organizationId)
    {
        var isSuperAdmin = User.FindFirst("IsSuperAdmin")?.Value == "True";
        var userOrgIdStr = User.FindFirst("OrganizationId")?.Value;
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!isSuperAdmin && userOrgIdStr != organizationId.ToString())
        {
            return Forbid();
        }

        Guid? currentLoggedInRoleId = null;
        List<Guid> myAllowedMenuIds = new List<Guid>();

        if (!string.IsNullOrEmpty(userIdStr) && Guid.TryParse(userIdStr, out var currentUserId))
        {
            var userRole = await _context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == currentUserId);
            if (userRole != null)
            {
                currentLoggedInRoleId = userRole.RoleId;
                myAllowedMenuIds = await _context.RoleMenuPermissions
                    .Where(rmp => rmp.RoleId == userRole.RoleId)
                    .Select(rmp => rmp.MenuId)
                    .ToListAsync();
            }
        }

        // Roles belonging strictly to this Organization
        var roles = await _context.Roles
            .Where(r => r.OrganizationId == organizationId)
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.Description,
                RoleMenuPermissions = r.RoleMenuPermissions.Select(rpm => new { rpm.MenuId }).ToList(),
                IsMyRole = currentLoggedInRoleId.HasValue && r.Id == currentLoggedInRoleId.Value
            })
            .ToListAsync();

        var menusQuery = _context.Menus.AsQueryable();

        if (!isSuperAdmin && myAllowedMenuIds.Any())
        {
            menusQuery = menusQuery.Where(m => myAllowedMenuIds.Contains(m.Id));
        }

        var menus = await menusQuery
            .OrderBy(m => m.DisplayOrder)
            .Select(m => new { m.Id, m.Title, m.Route, m.Icon, m.ParentMenuCode, Code = m.Route })
            .ToListAsync();

        // Users belonging strictly to this Organization
        var users = await _context.Users
            .Where(u => u.OrganizationId == organizationId)
            .Select(u => new { u.Id, u.FullName, u.Email, u.Username })
            .ToListAsync();

        return Ok(new { roles, menus, users });
    }

    // 2. Organization RBAC Overview (Clean flat view without ParentId)
    [HttpGet("rbac-tree")]
    public async Task<IActionResult> GetRbacTree()
    {
        var isSuperAdmin = User.FindFirst("IsSuperAdmin")?.Value == "True";
        var userOrgIdStr = User.FindFirst("OrganizationId")?.Value;
        Guid? userOrgId = !string.IsNullOrEmpty(userOrgIdStr) ? Guid.Parse(userOrgIdStr) : null;

        var query = _context.Organizations.Include(o => o.Users).AsQueryable();

        if (!isSuperAdmin && userOrgId.HasValue)
        {
            query = query.Where(o => o.Id == userOrgId.Value);
        }

        var organizations = await query.ToListAsync();

        var roles = await _context.Roles
            .Include(r => r.RoleMenuPermissions)
            .ThenInclude(rpm => rpm.Menu)
            .ToListAsync();

        var treeData = organizations.Select(org => new
        {
            org.Id,
            org.Name,
            org.Code,
            org.Type,
            org.Level,
            Users = org.Users.Select(u => new { u.Id, u.FullName, u.Email, u.Username }).ToList(),
            Roles = roles.Where(r => r.OrganizationId == org.Id).Select(r => new
            {
                r.Id,
                r.Name,
                r.Description,
                Menus = r.RoleMenuPermissions.Select(rpm => rpm.Menu?.Title).ToList()
            }).ToList()
        }).ToList();

        return Ok(treeData);
    }

    // 3. Create Role for Organization
    [HttpPost("save-role")]
    public async Task<IActionResult> SaveRole([FromBody] SaveRoleDto model)
    {
        var role = new Role
        {
            Id = Guid.NewGuid(),
            Name = model.RoleName ?? "New Role",
            OrganizationId = model.OrganizationId,
            Description = model.Description
        };

        _context.Roles.Add(role);
        await _context.SaveChangesAsync();

        if (model.MenuIds != null && model.MenuIds.Any())
        {
            var permissions = model.MenuIds.Select(menuId => new RoleMenuPermission
            {
                Id = Guid.NewGuid(),
                RoleId = role.Id,
                MenuId = menuId,
                CanView = true,
                CanCreate = true,
                CanEdit = true,
                CanDelete = true
            }).ToList();

            _context.RoleMenuPermissions.AddRange(permissions);
            await _context.SaveChangesAsync();
        }

        return Ok(new { message = "Role created successfully!" });
    }

    // 4. Update Role & Permissions
    [HttpPut("update-role/{id}")]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] SaveRoleDto model)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdStr) && Guid.TryParse(userIdStr, out var currentUserId))
        {
            var userRole = await _context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == currentUserId);
            if (userRole != null && userRole.RoleId == id)
            {
                return BadRequest(new { message = "You cannot edit your own primary role. Contact SuperAdmin." });
            }
        }

        var role = await _context.Roles.Include(r => r.RoleMenuPermissions).FirstOrDefaultAsync(r => r.Id == id);
        if (role == null) return NotFound(new { message = "Role not found" });

        role.Name = model.RoleName ?? role.Name;
        role.Description = model.Description;

        _context.RoleMenuPermissions.RemoveRange(role.RoleMenuPermissions);

        if (model.MenuIds != null && model.MenuIds.Any())
        {
            var newPermissions = model.MenuIds.Select(menuId => new RoleMenuPermission
            {
                Id = Guid.NewGuid(),
                RoleId = role.Id,
                MenuId = menuId,
                CanView = true,
                CanCreate = true,
                CanEdit = true,
                CanDelete = true
            }).ToList();

            _context.RoleMenuPermissions.AddRange(newPermissions);
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Role updated successfully!" });
    }

    // 5. Delete Role
    [HttpDelete("delete-role/{id}")]
    public async Task<IActionResult> DeleteRole(Guid id)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdStr) && Guid.TryParse(userIdStr, out var currentUserId))
        {
            var userRole = await _context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == currentUserId);
            if (userRole != null && userRole.RoleId == id)
            {
                return BadRequest(new { message = "You cannot delete the role currently assigned to you." });
            }
        }

        var role = await _context.Roles.FindAsync(id);
        if (role == null) return NotFound(new { message = "Role not found" });

        var permissions = await _context.RoleMenuPermissions.Where(p => p.RoleId == id).ToListAsync();
        _context.RoleMenuPermissions.RemoveRange(permissions);
        _context.Roles.Remove(role);

        await _context.SaveChangesAsync();
        return Ok(new { message = "Role deleted successfully!" });
    }

    // 6. Assign Role to User
    [HttpPost("assign-role")]
    public async Task<IActionResult> AssignRoleToUser([FromBody] AssignRoleDto model)
    {
        var user = await _context.Users.FindAsync(model.UserId);
        if (user == null) return NotFound(new { message = "User not found" });

        var existingMapping = await _context.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == model.UserId);

        if (existingMapping != null)
        {
            existingMapping.RoleId = model.RoleId;
        }
        else
        {
            _context.UserRoles.Add(new UserRole
            {
                Id = Guid.NewGuid(),
                UserId = model.UserId,
                RoleId = model.RoleId
            });
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Role assigned to user successfully!" });
    }
}

public class SaveRoleDto
{
    public Guid OrganizationId { get; set; }
    public string? RoleName { get; set; }
    public string? Description { get; set; }
    public List<Guid> MenuIds { get; set; } = new();
}

public class AssignRoleDto
{
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }
}