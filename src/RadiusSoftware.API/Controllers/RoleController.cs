using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Controllers;

[Route("api/[controller]")]
[ApiController]
public class RoleController : ControllerBase
{
    private readonly AppDbContext _context;

    public RoleController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("list/{orgId}")]
    public async Task<IActionResult> GetRoles(Guid orgId)
    {
        var roles = await _context.Roles.Where(r => r.OrganizationId == orgId).ToListAsync();
        return Ok(roles);
    }

    [HttpPost("create-role")]
    public async Task<IActionResult> CreateRole([FromBody] Role model)
    {
        _context.Roles.Add(model);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Role created successfully!", roleId = model.Id });
    }

    [HttpPost("assign-permissions")]
    public async Task<IActionResult> AssignPermissions([FromBody] List<RoleMenuPermission> permissions)
    {
        foreach (var p in permissions)
        {
            var existing = await _context.RoleMenuPermissions
                .FirstOrDefaultAsync(x => x.RoleId == p.RoleId && x.MenuId == p.MenuId);

            if (existing != null)
            {
                existing.CanView = p.CanView;
                existing.CanCreate = p.CanCreate;
                existing.CanEdit = p.CanEdit;
                existing.CanDelete = p.CanDelete;
            }
            else
            {
                _context.RoleMenuPermissions.Add(p);
            }
        }
        await _context.SaveChangesAsync();
        return Ok(new { message = "Permissions updated successfully!" });
    }
}