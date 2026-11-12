namespace RadiusSoftware.Core.Entities;

public class RoleMenuPermission
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RoleId { get; set; }
    public Role? Role { get; set; }
    public Guid MenuId { get; set; }
    public Menu? Menu { get; set; }
    public bool CanView { get; set; } = true;
    public bool CanCreate { get; set; } = false;
    public bool CanEdit { get; set; } = false;
    public bool CanDelete { get; set; } = false;


}