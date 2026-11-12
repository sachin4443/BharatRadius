using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Core.DTOs;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class OrganizationsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    public OrganizationsController(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    [HttpPost("create-company")]
    public async Task<IActionResult> CreateCompany([FromBody] OrganizationCreateDto model)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        // Auto-increment code logic (1001 onwards)
        var lastOrg = await _context.Organizations
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();

        int nextCodeNumber = 1001;
        if (lastOrg != null && int.TryParse(lastOrg.Code, out int lastCode))
        {
            nextCodeNumber = Math.Max(1001, lastCode + 1);
        }

        string? savedLogoUrl = model.LogoUrl;
        if (!string.IsNullOrEmpty(model.LogoUrl) && model.LogoUrl.StartsWith("data:image"))
        {
            savedLogoUrl = SaveBase64Image(model.LogoUrl);
        }

        var org = new Organization
        {
            Id = Guid.NewGuid(),
            Name = model.Name,
            Code = nextCodeNumber.ToString(),
            Email = model.Email,
            Phone = model.Phone,
            Domain = model.Domain,
            Address = model.Address,
            Currency = model.Currency,
            Type = "ClientPortal",
            Level = 0,
            LogoUrl = savedLogoUrl,
            PrimaryColor = model.PrimaryColor ?? "#0d6efd",
            SecondaryColor = model.SecondaryColor ?? "#6c757d",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Organizations.Add(org);

        var user = new User
        {
            Id = Guid.NewGuid(),
            OrganizationId = org.Id,
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

        return Ok(new { message = "Company & Admin created successfully!", code = org.Code });
    }

    [HttpGet("list")]
    public async Task<IActionResult> GetOrganizations()
    {
        var isSuperAdmin = User.FindFirst("IsSuperAdmin")?.Value == "True";
        var userOrgIdStr = User.FindFirst("OrganizationId")?.Value;
        Guid? userOrgId = !string.IsNullOrEmpty(userOrgIdStr) ? Guid.Parse(userOrgIdStr) : null;

        var query = _context.Organizations.AsQueryable();

        if (!isSuperAdmin && userOrgId.HasValue)
        {
            query = query.Where(o => o.Id == userOrgId.Value);
        }

        var list = await query
            .OrderByDescending(o => o.CreatedAt)
            .GroupJoin(
                _context.Users,
                org => org.Id,
                user => user.OrganizationId,
                (org, users) => new { org, admin = users.FirstOrDefault() }
            )
            .Select(x => new
            {
                x.org.Id,
                x.org.Name,
                x.org.Code,
                x.org.Type,
                x.org.Level,
                x.org.Email,
                x.org.Phone,
                x.org.Domain,
                x.org.Address,
                x.org.Currency,
                x.org.PrimaryColor,
                x.org.SecondaryColor,
                LogoUrl = x.org.LogoUrl != null && !x.org.LogoUrl.StartsWith("http")
                    ? $"{Request.Scheme}://{Request.Host}{x.org.LogoUrl}"
                    : x.org.LogoUrl,
                AdminUsername = x.admin != null ? x.admin.Username : "N/A",
                AdminFullName = x.admin != null ? x.admin.FullName : "N/A",
                AdminEmail = x.admin != null ? x.admin.Email : "N/A",
                AdminMobile = x.admin != null ? x.admin.Mobile : "N/A",
                AdminPassword = x.admin == null ? "N/A" : (RadiusSoftware.API.Security.PasswordUtil.IsHashed(x.admin.PasswordHash) ? "(encrypted)" : x.admin.PasswordHash),
                x.org.IsActive,
                x.org.CreatedAt
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateCompany(Guid id, [FromBody] OrganizationUpdateDto model)
    {
        var org = await _context.Organizations.FindAsync(id);
        if (org == null) return NotFound(new { message = "Company not found" });

        string? savedLogoUrl = model.LogoUrl;
        if (!string.IsNullOrEmpty(model.LogoUrl) && model.LogoUrl.StartsWith("data:image"))
        {
            savedLogoUrl = SaveBase64Image(model.LogoUrl);
        }

        org.Name = model.Name;
        org.Email = model.Email;
        org.Phone = model.Phone;
        org.Domain = model.Domain;
        org.Address = model.Address;
        org.Currency = model.Currency;
        org.PrimaryColor = model.PrimaryColor ?? org.PrimaryColor;
        org.SecondaryColor = model.SecondaryColor ?? org.SecondaryColor;
        if (!string.IsNullOrEmpty(savedLogoUrl)) org.LogoUrl = savedLogoUrl;

        if (!string.IsNullOrEmpty(model.NewPassword) && model.NewPassword != "(encrypted)")
        {
            var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.OrganizationId == org.Id);
            if (adminUser != null)
            {
                adminUser.PasswordHash = RadiusSoftware.API.Security.PasswordUtil.Hash(model.NewPassword);
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Company updated successfully!" });
    }

    [HttpGet("{id}/summary")]
    public async Task<IActionResult> GetOrgSummary(Guid id)
    {
        var users = await _context.Users.Where(u => u.OrganizationId == id).Select(u => new { u.FullName, u.Email }).ToListAsync();
        var roles = await _context.Roles.Where(r => r.OrganizationId == id).Select(r => new { r.Name }).ToListAsync();

        return Ok(new
        {
            userCount = users.Count,
            roleCount = roles.Count,
            users = users,
            roles = roles
        });
    }

    [HttpDelete("delete/{id}")]
    public async Task<IActionResult> DeleteOrganization(Guid id)
    {
        var org = await _context.Organizations.FindAsync(id);
        if (org == null) return NotFound(new { message = "Organization not found" });

        var users = await _context.Users.Where(u => u.OrganizationId == id).ToListAsync();
        var userIds = users.Select(u => u.Id).ToList();

        var sites = await _context.Sites
            .Where(s => s.UserId.HasValue && userIds.Contains(s.UserId.Value))
            .ToListAsync();
        _context.Sites.RemoveRange(sites);

        var roles = await _context.Roles.Where(r => r.OrganizationId == id).ToListAsync();
        var roleIds = roles.Select(r => r.Id).ToList();
        var permissions = await _context.RoleMenuPermissions.Where(p => roleIds.Contains(p.RoleId)).ToListAsync();

        _context.RoleMenuPermissions.RemoveRange(permissions);
        _context.Roles.RemoveRange(roles);
        _context.Users.RemoveRange(users);
        _context.Organizations.Remove(org);

        await _context.SaveChangesAsync();
        return Ok(new { message = "Organization and all associated records deleted permanently!" });
    }

    [HttpPut("toggle-status/{id}")]
    public async Task<IActionResult> ToggleStatus(Guid id)
    {
        var org = await _context.Organizations.FindAsync(id);
        if (org == null) return NotFound();

        org.IsActive = !org.IsActive;

        var users = await _context.Users.Where(u => u.OrganizationId == id).ToListAsync();
        foreach (var user in users)
        {
            user.IsActive = org.IsActive;
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = org.IsActive ? "Company activated" : "Company deactivated" });
    }

    private string SaveBase64Image(string base64String)
    {
        try
        {
            var dataParts = base64String.Split(',');
            var extension = dataParts[0].Contains("png") ? "png" : "jpg";
            var bytes = Convert.FromBase64String(dataParts[1]);

            var uploadsFolder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "logos");
            if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

            var fileName = $"{Guid.NewGuid()}.{extension}";
            var filePath = Path.Combine(uploadsFolder, fileName);
            System.IO.File.WriteAllBytes(filePath, bytes);

            return $"/uploads/logos/{fileName}";
        }
        catch
        {
            return base64String;
        }
    }
}