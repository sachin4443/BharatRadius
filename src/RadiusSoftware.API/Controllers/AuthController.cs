using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
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

    public AuthController(AppDbContext context, IConfiguration configuration, IWebHostEnvironment env)
    {
        _context = context;
        _configuration = configuration;
        _env = env;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto model)
    {
        var user = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => (u.Email == model.Email || u.Username == model.Email) && u.IsActive);

        if (user == null || user.PasswordHash != model.Password)
        {
            return Unauthorized(new { message = "Invalid email or password" });
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
            Expires = DateTime.UtcNow.AddMinutes(double.Parse(_configuration["JwtSettings:ExpiryMinutes"]!)),
            Issuer = _configuration["JwtSettings:Issuer"],
            Audience = _configuration["JwtSettings:Audience"],
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        var orgLogo = user.Organization?.LogoUrl;
        var fullLogoUrl = orgLogo != null && !orgLogo.StartsWith("http")
            ? $"{Request.Scheme}://{Request.Host}{orgLogo}"
            : orgLogo;

        return Ok(new
        {
            Token = tokenString,
            Username = user.Username,
            FullName = user.FullName,
            IsSuperAdmin = user.IsSuperAdmin,
            OrgType = levelStr,
            CompanyName = user.Organization?.Name ?? "ISP Portal",
            LogoUrl = fullLogoUrl
        });
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
            PasswordHash = "root@123",
            IsSuperAdmin = true
        };

        _context.Users.Add(superUser);
        await _context.SaveChangesAsync();

        return Ok(new { message = "SuperAdmin created successfully! Username: superadmin, Password: root@123" });
    }

    [HttpPost("impersonate")]
    public async Task<IActionResult> Impersonate([FromQuery] string companyName)
    {
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
            Expires = DateTime.UtcNow.AddMinutes(double.Parse(_configuration["JwtSettings:ExpiryMinutes"]!)),
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
    [HttpPost("impersonate-site")]
    public async Task<IActionResult> ImpersonateSite([FromQuery] Guid siteId)
    {
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
            Expires = DateTime.UtcNow.AddMinutes(double.Parse(_configuration["JwtSettings:ExpiryMinutes"]!)),
            Issuer = _configuration["JwtSettings:Issuer"],
            Audience = _configuration["JwtSettings:Audience"],
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        return Ok(new
        {
            Token = tokenString,
            Username = targetUser.Username,
            FullName = targetUser.FullName,
            IsSuperAdmin = targetUser.IsSuperAdmin,
            OrgType = levelStr
        });
    }

    [Authorize]
    [HttpPut("update-profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto model)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null) return Unauthorized();

        var user = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id.ToString() == userIdClaim);

        if (user == null) return NotFound(new { message = "User not found" });

        user.FullName = model.FullName;

        if (user.Organization != null && !string.IsNullOrEmpty(model.LogoUrl))
        {
            string? savedLogoUrl = model.LogoUrl;
            if (model.LogoUrl.StartsWith("data:image"))
            {
                var dataParts = model.LogoUrl.Split(',');
                var extension = dataParts[0].Contains("png") ? "png" : "jpg";
                var bytes = Convert.FromBase64String(dataParts[1]);

                var uploadsFolder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "logos");
                if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

                var fileName = $"{Guid.NewGuid()}.{extension}";
                var filePath = Path.Combine(uploadsFolder, fileName);
                System.IO.File.WriteAllBytes(filePath, bytes);

                savedLogoUrl = $"/uploads/logos/{fileName}";
            }

            user.Organization.LogoUrl = savedLogoUrl;
        }

        await _context.SaveChangesAsync();

        var orgLogo = user.Organization?.LogoUrl;
        var fullLogoUrl = orgLogo != null && !orgLogo.StartsWith("http")
            ? $"{Request.Scheme}://{Request.Host}{orgLogo}"
            : orgLogo;

        return Ok(new
        {
            token = Request.Headers["Authorization"].ToString().Replace("Bearer ", ""),
            username = user.Username,
            fullName = user.FullName,
            isSuperAdmin = user.IsSuperAdmin,
            orgType = user.Organization?.Type ?? "L1",
            logoUrl = fullLogoUrl
        });
    }

    public class UpdateProfileDto
    {
        public string FullName { get; set; } = string.Empty;
        public string? LogoUrl { get; set; }
    }
}