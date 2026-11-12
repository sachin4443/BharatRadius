using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Core.Entities;

namespace RadiusSoftware.Infrastructure.Data;

public static class DbInitializer
{
    public static async Task SeedAsync(AppDbContext context)
    {
        // 1. Seed Menus if not exists
        if (!await context.Menus.AnyAsync())
        {
            var menus = new List<Menu>
            {
                new Menu { Title = "Company & Sites", Route = "/companies", Icon = "🏢", DisplayOrder = 1 },
                new Menu { Title = "User Management", Route = "/users", Icon = "👤", DisplayOrder = 2 },
                new Menu { Title = "Roles & Permissions", Route = "/roles", Icon = "🔐", DisplayOrder = 3 },
                new Menu { Title = "System Settings", Route = "/settings", Icon = "⚙️", DisplayOrder = 4 }
            };
            context.Menus.AddRange(menus);
            await context.SaveChangesAsync();
        }

        // 2. Ensure SuperAdmin Role & Full Permissions
        var superAdminUser = await context.Users.FirstOrDefaultAsync(u => u.IsSuperAdmin);
        if (superAdminUser != null)
        {
            var superRole = await context.Roles.FirstOrDefaultAsync(r => r.Name == "SuperAdmin" && r.OrganizationId == superAdminUser.OrganizationId);
            if (superRole == null)
            {
                superRole = new Role
                {
                    OrganizationId = superAdminUser.OrganizationId,
                    Name = "SuperAdmin",
                    Description = "Full system access with all permissions",
                    IsActive = true
                };
                context.Roles.Add(superRole);
                await context.SaveChangesAsync();
            }

            // Assign UserRole if not exists
            if (!await context.UserRoles.AnyAsync(ur => ur.UserId == superAdminUser.Id && ur.RoleId == superRole.Id))
            {
                context.UserRoles.Add(new UserRole { UserId = superAdminUser.Id, RoleId = superRole.Id });
            }

            // Grant all menus to SuperAdmin Role
            var allMenus = await context.Menus.ToListAsync();
            foreach (var menu in allMenus)
            {
                bool exists = await context.RoleMenuPermissions.AnyAsync(rmp => rmp.RoleId == superRole.Id && rmp.MenuId == menu.Id);
                if (!exists)
                {
                    context.RoleMenuPermissions.Add(new RoleMenuPermission
                    {
                        RoleId = superRole.Id,
                        MenuId = menu.Id,
                        CanView = true,
                        CanCreate = true,
                        CanEdit = true,
                        CanDelete = true
                    });
                }
            }
            await context.SaveChangesAsync();
        }
    }
}