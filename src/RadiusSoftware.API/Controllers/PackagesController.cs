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
[SiteScoped(ScopedResource.Package, "id")]
[Route("api/[controller]")]
[ApiController]
public class PackagesController : ControllerBase
{
    private readonly AppDbContext _context;

    public PackagesController(AppDbContext context)
    {
        _context = context;
    }

    // ============================================================
    // GET PACKAGE LIST
    // ============================================================

    [HttpGet("list")]
    public async Task<IActionResult> GetPackageList()
    {
        var isSuperAdmin =
            User.FindFirst("IsSuperAdmin")?.Value == "True";

        var userIdStr =
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;

        var query = _context.PackageProfiles
            .Include(p => p.Site)
            .AsQueryable();

        // SuperAdmin -> all packages
        if (!isSuperAdmin)
        {
            if (!Guid.TryParse(userIdStr, out var userId))
            {
                return Unauthorized(new
                {
                    message = "Invalid logged-in user."
                });
            }

            // Logged-in user ki site
            var userSite = await _context.Sites
                .FirstOrDefaultAsync(s =>
                    s.UserId == userId &&
                    !s.IsDeleted);

            if (userSite == null)
            {
                return Ok(new List<PackageProfile>());
            }

            // Sirf isi user's site ke packages
            query = query.Where(p =>
                p.SiteId == userSite.Id);
        }

        var list = await query
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return Ok(list);
    }

    // ============================================================
    // SAVE PACKAGE
    // POST: /api/Packages/save
    // ============================================================
    [HttpPost("save")]
    public async Task<IActionResult> SavePackage([FromBody] PackageProfileDto model)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var isSuperAdmin = User.FindFirst("IsSuperAdmin")?.Value == "True";
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                            ?? User.FindFirst("sub")?.Value;

            if (!Guid.TryParse(userIdStr, out var userId))
            {
                return Unauthorized(new { message = "Invalid logged-in user." });
            }

            // ====================================================
            // FIND SITE AUTOMATICALLY
            // ====================================================
            Guid siteId = Guid.Empty;

            var userSite = await _context.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == userId && !s.IsDeleted);

            // Agar user ki site mil gayi toh wo assign karo
            if (userSite != null)
            {
                siteId = userSite.Id;
            }
            else if (!isSuperAdmin)
            {
                // Agar normal user hai aur uski site nahi hai
                return BadRequest(new { message = "No site is assigned to the logged-in user." });
            }
            // SuperAdmin ke case me siteId Guid.Empty reh sakti hai agar globally save karna ho.

            // ====================================================
            // CREATE
            // ====================================================

            if (model.Id == Guid.Empty)
            {
                var pkg = new PackageProfile
                {
                    Id = Guid.NewGuid(),
                    SiteId = siteId, // Automatically assigned
                    PackageName = model.PackageName,
                    PlanCategory = model.PlanCategory,
                    DownloadMbps = model.DownloadMbps,
                    DownloadUnit = model.DownloadUnit,
                    UploadMbps = model.UploadMbps,
                    UploadUnit = model.UploadUnit,
                    Price = model.Price,
                    ExpiryDays = model.ExpiryDays,
                    ValidityType = model.ValidityType,
                    Description = model.Description,
                    IsActive = model.IsActive,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.PackageProfiles.Add(pkg);
            }
            else
            {
                // =================================================
                // EDIT
                // =================================================

                // Find package by ID
                var pkg = await _context.PackageProfiles.FindAsync(model.Id);

                if (pkg == null)
                {
                    return NotFound(new { message = "Package not found." });
                }

                // Normal user sirf apna package edit kar sakta hai
                if (!isSuperAdmin && pkg.SiteId != siteId)
                {
                    return Forbid();
                }

                pkg.PackageName = model.PackageName;
                pkg.PlanCategory = model.PlanCategory;
                pkg.DownloadMbps = model.DownloadMbps;
                pkg.DownloadUnit = model.DownloadUnit;
                pkg.UploadMbps = model.UploadMbps;
                pkg.UploadUnit = model.UploadUnit;
                pkg.Price = model.Price;
                pkg.ExpiryDays = model.ExpiryDays;
                pkg.ValidityType = model.ValidityType;
                pkg.Description = model.Description;
                pkg.IsActive = model.IsActive;
                pkg.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Package saved successfully!" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Internal server error: " + ex.Message });
        }
    }

    // ============================================================
    // DELETE
    // ============================================================

    [HttpDelete("delete/{id}")]
    public async Task<IActionResult> DeletePackage(Guid id)
    {
        var isSuperAdmin =
            User.FindFirst("IsSuperAdmin")?.Value == "True";

        var userIdStr =
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;

        var query = _context.PackageProfiles
            .AsQueryable();

        if (!isSuperAdmin)
        {
            if (!Guid.TryParse(userIdStr, out var userId))
            {
                return Unauthorized();
            }

            var userSite = await _context.Sites
                .FirstOrDefaultAsync(s =>
                    s.UserId == userId &&
                    !s.IsDeleted);

            if (userSite == null)
            {
                return NotFound();
            }

            query = query.Where(p =>
                p.SiteId == userSite.Id);
        }

        var pkg = await query
            .FirstOrDefaultAsync(p => p.Id == id);

        if (pkg == null)
        {
            return NotFound(new
            {
                message = "Package not found."
            });
        }

        _context.PackageProfiles.Remove(pkg);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message =
                "Package deleted successfully!"
        });
    }
}