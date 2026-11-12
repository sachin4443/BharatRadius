namespace RadiusSoftware.Core.Entities;

public class Menu
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;      // Menu Display Name (e.g., "Companies")
    public string Route { get; set; } = string.Empty;      // Frontend route (e.g., "/companies")
    public string Icon { get; set; } = string.Empty;       // Bootstrap or Emoji Icon
    public int DisplayOrder { get; set; }                  // Sorting order
    public string? ParentMenuCode { get; set; }            // For sub-menus if any
}