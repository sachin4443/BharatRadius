namespace RadiusSoftware.Core.Entities;

public class Role
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; } // Multitenant support
    public string Name { get; set; } = string.Empty; // e.g., "CompanyAdmin"
    public string Description { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<RoleMenuPermission> RoleMenuPermissions { get; set; } = new List<RoleMenuPermission>();
}