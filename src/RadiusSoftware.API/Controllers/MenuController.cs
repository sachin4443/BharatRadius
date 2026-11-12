using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Infrastructure.Data;
using System.Security.Claims;

namespace RadiusSoftware.API.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class MenuController : ControllerBase
{
    private readonly AppDbContext _context;

    public MenuController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("user-menus")]
    public async Task<IActionResult> GetUserMenus()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var isSuperAdminClaim = User.FindFirst("IsSuperAdmin")?.Value;

        if (string.IsNullOrEmpty(userIdClaim))
        {
            return Unauthorized(new { message = "Invalid token claims" });
        }

        // 1. Agar SuperAdmin hai, toh saare menus de do
        if (bool.TryParse(isSuperAdminClaim, out bool isSuperAdmin) && isSuperAdmin)
        {
            var allMenus = await _context.Menus.OrderBy(m => m.DisplayOrder).ToListAsync();
            return Ok(allMenus);
        }

        // 2. Normal Admin (L1/L2) ke liye "UserRoles" table se RoleId nikalo
        var userId = Guid.Parse(userIdClaim);

        var userRoleMapping = await _context.UserRoles
            .FirstOrDefaultAsync(ur => ur.UserId == userId);

        if (userRoleMapping == null)
        {
            // Agar UserRoles table me entry nahi hai, toh khali menu do
            return Ok(new List<object>());
        }

        // 3. User ke Role ke hisaab se permissions table se Menus nikal lo
        var permittedMenuIds = await _context.RoleMenuPermissions
            .Where(rmp => rmp.RoleId == userRoleMapping.RoleId)
            .Select(rmp => rmp.MenuId)
            .ToListAsync();

        var menus = await _context.Menus
            .Where(m => permittedMenuIds.Contains(m.Id))
            .OrderBy(m => m.DisplayOrder)
            .ToListAsync();

        return Ok(menus);
    }
}