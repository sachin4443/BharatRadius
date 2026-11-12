using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RadiusSoftware.API.Security;
using RadiusSoftware.Core.DTOs;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace RadiusSoftware.API.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _env;
    private readonly ISiteAccessService _access;

    public AuthController(AppDbContext context, IConfiguration configuration, IWebHostEnvironment env, ISiteAccessService access)
    {
        _context = context;
        _configuration = configuration;
        _env = env;
        _access = access;
    }

    private DateTime TokenExpiry(bool rememberMe = false)
    {
        if (rememberMe)
        {
            var days = double.TryParse(_configuration["JwtSettings:RememberMeDays"], out var d) ? d : 7;
            return DateTime.UtcNow.AddDays(days);
        }
        return DateTime.UtcNow.AddMinutes(double.Parse(_configuration["JwtSettings:ExpiryMinutes"]!));
    }


    /// <summary>
    /// What the browser keeps about the logged-in user. Every user has their OWN
    /// logo; a site user sees the site's name, an organization admin the company name.
    /// </summary>
    private object UserInfo(User user, Site? site, string token, string level)
    {
        // Site users: only their own logo. Organization admins: own logo, else the company logo.
        var logo = !string.IsNullOrWhiteSpace(user.LogoUrl)
            ? user.LogoUrl
            : site == null ? user.Organization?.LogoUrl : null;

        var fullLogoUrl = logo != null && !logo.StartsWith("http")
            ? $"{Request.Scheme}://{Request.Host}{logo}"
            : logo;

        var displayName = site != null
            ? (!string.IsNullOrWhiteSpace(site.CompanyName) ? site.CompanyName : site.SiteName)
            : user.Organization?.Name ?? "ISP Portal";

        return new
        {
            Token = token,
            Username = user.Username,
            FullName = user.FullName,
            IsSuperAdmin = user.IsSuperAdmin,
            OrgType = level,
            CompanyName = displayName,
            SiteName = site?.SiteName,
            LogoUrl = fullLogoUrl
        };
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto model)
    {
        var user = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => (u.Email == model.Email || u.Username == model.Email) && u.IsActive);

        if (user == null || !PasswordUtil.Verify(user.PasswordHash, model.Password, out var needsUpgrade))
        {
            return Unauthorized(new { message = "Invalid email or password" });
        }

        if (needsUpgrade)
        {
            // Old plain-text password -> store as secure hash from now on
            user.PasswordHash = PasswordUtil.Hash(model.Password);
            await _context.SaveChangesAsync();
        }

        var userSite = await _context.Sites.FirstOrDefaultAsync(s => s.UserId == user.Id && !s.IsDeleted);

        int determinedLevel = userSite?.SiteLevel ?? user.Organization?.Level ?? 1;
        string levelStr = $"L{determinedLevel}";

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_configuration["JwtSettings:Secret"]!);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim("OrganizationId", user.OrganizationId.ToString()),
                new Claim("IsSuperAdmin", user.IsSuperAdmin.ToString()),
                new Claim("Level", levelStr)
            }),
            Expires = TokenExpiry(model.RememberMe),
            Issuer = _configuration["JwtSettings:Issuer"],
            Audience = _configuration["JwtSettings:Audience"],
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        return Ok(UserInfo(user, userSite, tokenString, levelStr));
    }

    [HttpPost("seed-superadmin")]
    public async Task<IActionResult> SeedSuperAdmin()
    {
        if (await _context.Users.AnyAsync(u => u.IsSuperAdmin))
        {
            return BadRequest(new { message = "SuperAdmin already exists!" });
        }

        var org = new Organization
        {
            Name = "System Root",
            Code = "ROOT",
            Level = 0,
            Type = "SuperAdmin"
        };

        _context.Organizations.Add(org);

        var superUser = new User
        {
            OrganizationId = org.Id,
            FullName = "System Administrator",
            Username = "superadmin",
            Email = "admin@radius.com",
            Mobile = "9999999999",
            PasswordHash = PasswordUtil.Hash("root@123"),
            IsSuperAdmin = true
        };

        _context.Users.Add(superUser);
        await _context.SaveChangesAsync();

        return Ok(new { message = "SuperAdmin created successfully! Username: superadmin, Password: root@123" });
    }

    [Authorize]
    [HttpPost("impersonate")]
    public async Task<IActionResult> Impersonate([FromQuery] string companyName)
    {
        // Only the super admin may log in as a company
        if (!_access.IsSuperAdmin)
        {
            return Forbid();
        }

        var targetOrg = await _context.Organizations
            .FirstOrDefaultAsync(o => o.Name == companyName && o.IsActive);

        if (targetOrg == null)
        {
            return NotFound(new { message = "Company not found" });
        }

        var targetUser = await _context.Users
            .FirstOrDefaultAsync(u => u.OrganizationId == targetOrg.Id && u.IsActive);

        if (targetUser == null)
        {
            return BadRequest(new { message = "No active user found for this company." });
        }

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_configuration["JwtSettings:Secret"]!);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, targetUser.Id.ToString()),
                new Claim(ClaimTypes.Name, targetUser.Username),
                new Claim("OrganizationId", targetUser.OrganizationId.ToString()),
                new Claim("IsSuperAdmin", targetUser.IsSuperAdmin.ToString())
            }),
            Expires = TokenExpiry(),
            Issuer = _configuration["JwtSettings:Issuer"],
            Audience = _configuration["JwtSettings:Audience"],
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        return Ok(new AuthResponseDto
        {
            Token = tokenString,
            Username = targetUser.Username,
            FullName = targetUser.FullName,
            IsSuperAdmin = targetUser.IsSuperAdmin,
            OrgType = targetOrg.Type
        });
    }

    // 🚀 NEW: Specific Endpoint for Site Impersonation
    [Authorize]
    [HttpPost("impersonate-site")]
    public async Task<IActionResult> ImpersonateSite([FromQuery] Guid siteId)
    {
        // Only allowed for the super admin or a parent site / organization admin of this site
        if (!await _access.CanAccessSiteAsync(siteId))
        {
            return Forbid();
        }

        var targetSite = await _context.Sites
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.Id == siteId && !s.IsDeleted);

        if (targetSite == null)
        {
            return NotFound(new { message = "Site not found" });
        }

        var targetUser = targetSite.User;

        if (targetUser == null || !targetUser.IsActive)
        {
            return BadRequest(new { message = "No active admin user found for this site." });
        }

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_configuration["JwtSettings:Secret"]!);

        // Determine correct Level String (L2, L3, L4 etc.)
        int determinedLevel = targetSite.SiteLevel > 0 ? targetSite.SiteLevel : 2;
        string levelStr = $"L{determinedLevel}";

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, targetUser.Id.ToString()),
                new Claim(ClaimTypes.Name, targetUser.Username),
                new Claim("OrganizationId", targetUser.OrganizationId.ToString()),
                new Claim("IsSuperAdmin", targetUser.IsSuperAdmin.ToString()),
                new Claim("Level", levelStr)
            }),
            Expires = TokenExpiry(),
            Issuer = _configuration["JwtSettings:Issuer"],
            Audience = _configuration["JwtSettings:Audience"],
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        await _context.Entry(targetUser).Reference(u => u.Organization).LoadAsync();
        return Ok(UserInfo(targetUser, targetSite, tokenString, levelStr));
    }

    [Authorize]
    [HttpPut("update-profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto model)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId)) return Unauthorized();

        var user = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null) return NotFound(new { message = "User not found" });

        if (!string.IsNullOrWhiteSpace(model.FullName))
            user.FullName = model.FullName.Trim();

        var site = await _context.Sites.FirstOrDefaultAsync(s => s.UserId == user.Id && !s.IsDeleted);

        if (model.RemoveLogo)
        {
            user.LogoUrl = null;
        }
        else if (!string.IsNullOrEmpty(model.LogoUrl) && model.LogoUrl.StartsWith("data:image"))
        {
            // data:image/png;base64,....
            var dataParts = model.LogoUrl.Split(',', 2);
            var header = dataParts[0].ToLowerInvariant();
            var extension = header.Contains("png") ? "png"
                : header.Contains("webp") ? "webp"
                : header.Contains("jpeg") || header.Contains("jpg") ? "jpg"
                : null;
            if (extension == null || dataParts.Length < 2)
                return BadRequest(new { message = "Only PNG, JPG or WEBP images are allowed." });

            byte[] bytes;
            try { bytes = Convert.FromBase64String(dataParts[1]); }
            catch { return BadRequest(new { message = "Invalid image." }); }
            if (bytes.Length > 2 * 1024 * 1024)
                return BadRequest(new { message = "Logo must be smaller than 2 MB." });

            var uploadsFolder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "logos");
            Directory.CreateDirectory(uploadsFolder);

            var fileName = $"{user.Id:N}_{Guid.NewGuid():N}.{extension}";
            await System.IO.File.WriteAllBytesAsync(Path.Combine(uploadsFolder, fileName), bytes);

            // Remove the user's previous logo file
            if (!string.IsNullOrEmpty(user.LogoUrl) && user.LogoUrl.StartsWith("/uploads/logos/"))
            {
                var old = Path.Combine(uploadsFolder, Path.GetFileName(user.LogoUrl));
                try { if (System.IO.File.Exists(old)) System.IO.File.Delete(old); } catch { }
            }

            user.LogoUrl = $"/uploads/logos/{fileName}";

            // The organization admin's logo is also the company logo
            if (site == null && user.Organization != null && !user.IsSuperAdmin)
                user.Organization.LogoUrl = user.LogoUrl;
        }

        await _context.SaveChangesAsync();

        var level = User.FindFirst("Level")?.Value
            ?? (user.IsSuperAdmin ? "L0" : site != null ? $"L{site.SiteLevel}" : $"L{user.Organization?.Level ?? 1}");
        var token = Request.Headers["Authorization"].ToString().Replace("Bearer ", "");
        return Ok(UserInfo(user, site, token, level));
    }

    public class UpdateProfileDto
    {
        public string FullName { get; set; } = string.Empty;
        public string? LogoUrl { get; set; }
        public bool RemoveLogo { get; set; }
    }
}