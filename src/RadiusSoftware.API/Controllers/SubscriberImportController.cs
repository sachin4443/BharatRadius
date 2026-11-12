using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Core.DTOs;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;
using System.Security.Claims;

namespace RadiusSoftware.API.Controllers;

[Authorize]
[ApiController]
[Route("api/subscriber-import")]
public class SubscriberImportController : ControllerBase
{
    private readonly AppDbContext _context;

    public SubscriberImportController(AppDbContext context)
    {
        _context = context;
    }

    // ============================================================
    // POST: /api/subscriber-import/upload
    // ============================================================
    [HttpPost("upload")]
    public async Task<IActionResult> UploadExcel(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Please select an Excel file." });
        }

        if (!Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Only .xlsx Excel files are supported." });
        }

        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        var organizationIdStr = User.FindFirst("OrganizationId")?.Value;
        var isSuperAdmin = bool.TryParse(User.FindFirst("IsSuperAdmin")?.Value, out var superAdmin) && superAdmin;

        var siteIds = await GetAccessibleSiteIds(userIdStr, organizationIdStr, isSuperAdmin);
        if (siteIds.Count == 0)
        {
            return BadRequest(new { message = "No accessible site found for this user." });
        }

        var siteId = siteIds.First();

        using var stream = file.OpenReadStream();
        using var workbook = new XLWorkbook(stream);

        IXLWorksheet worksheet;
        if (workbook.Worksheets.Contains("Subscribers"))
        {
            worksheet = workbook.Worksheet("Subscribers");
        }
        else
        {
            worksheet = workbook.Worksheets.First();
        }

        int headerRowIndex = FindHeaderRow(worksheet);
        if (headerRowIndex == -1)
        {
            return BadRequest(new { message = "Excel header row not found. Please ensure valid column headers exist." });
        }

        var headerRow = worksheet.Row(headerRowIndex);
        var headers = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var cell in headerRow.CellsUsed())
        {
            var headerText = cell.GetString().Trim();
            if (!string.IsNullOrEmpty(headerText) && !headers.ContainsKey(headerText))
            {
                headers[headerText] = cell.Address.ColumnNumber;
            }
        }

        var rows = worksheet.RowsUsed().Skip(headerRowIndex).ToList();
        if (rows.Count == 0)
        {
            return BadRequest(new { message = "Excel file does not contain any subscriber records." });
        }

        var subscribers = new List<Subscriber>();
        var errors = new List<object>();
        int rowNumber = headerRowIndex;

        foreach (var row in rows)
        {
            rowNumber++;

            if (row.Cells().All(x => string.IsNullOrWhiteSpace(x.GetString())))
            {
                continue;
            }

            try
            {
                var dto = ReadExcelRowFlexible(row, headers);

                if (string.IsNullOrWhiteSpace(dto.FullName))
                {
                    errors.Add(new { row = rowNumber, message = "FullName / Customer Name is required." });
                    continue;
                }

                // ✨ SMART FALLBACK: Check Username / UserPassword from sheet if specific PPPoE fields are blank
                var primaryUsername = dto.PPPoEUsername ?? dto.PortalUsername ?? dto.Username;
                var primaryPassword = dto.PPPoEPassword ?? dto.PortalPassword ?? dto.UserPassword;

                if (string.IsNullOrWhiteSpace(primaryUsername))
                {
                    errors.Add(new { row = rowNumber, message = "Username / PPPoE Username is required." });
                    continue;
                }

                var nasResult = await FindNasAsync(dto, siteIds);
                if (!nasResult.Success)
                {
                    errors.Add(new { row = rowNumber, message = nasResult.Message });
                    continue;
                }

                var packageResult = await FindPackageAsync(dto, siteIds);
                if (!packageResult.Success)
                {
                    errors.Add(new { row = rowNumber, message = packageResult.Message });
                    continue;
                }

                var activeResult = ParseBoolean(dto.IsActive, true);

                DateTime? expireDateParsed = null;
                if (!string.IsNullOrWhiteSpace(dto.ExpireDateStr))
                {
                    if (DateTime.TryParse(dto.ExpireDateStr, out var parsedDate))
                    {
                        expireDateParsed = DateTime.SpecifyKind(parsedDate, DateTimeKind.Utc);
                    }
                }

                var subscriber = new Subscriber
                {
                    Id = Guid.NewGuid(),
                    SiteId = siteId,
                    NasId = nasResult.NasId,
                    PackageId = packageResult.PackageId,
                    SubscriberType = string.IsNullOrWhiteSpace(dto.SubscriberType) ? "Individual" : dto.SubscriberType.Trim(),
                    FullName = dto.FullName.Trim(),
                    CompanyName = dto.CompanyName?.Trim() ?? string.Empty,
                    Mobile = dto.Mobile?.Trim() ?? string.Empty,
                    Email = dto.Email?.Trim() ?? string.Empty,
                    PortalUsername = primaryUsername.Trim(),
                    PortalPassword = primaryPassword?.Trim() ?? string.Empty,
                    Address = dto.Address?.Trim() ?? string.Empty,
                    Zip = dto.Zip?.Trim() ?? string.Empty,
                    City = dto.City?.Trim() ?? string.Empty,
                    State = dto.State?.Trim() ?? string.Empty,
                    PhotoUrl = string.IsNullOrWhiteSpace(dto.PhotoUrl) ? null : dto.PhotoUrl.Trim(),
                    GstNo = dto.GstNo?.Trim() ?? string.Empty,
                    Comment = dto.Comment?.Trim() ?? string.Empty,
                    Service = string.IsNullOrWhiteSpace(dto.Service) ? "PPPoE" : dto.Service.Trim(),
                    PPPoEUsername = primaryUsername.Trim(),
                    PPPoEPassword = primaryPassword?.Trim() ?? string.Empty,
                    MacAddress = dto.MacAddress?.Trim() ?? string.Empty,
                    StaticIp = dto.StaticIp?.Trim() ?? string.Empty,
                    ConnectionEnabled = true,
                    IsActive = activeResult.Value,
                    ExpireDate = expireDateParsed,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                subscribers.Add(subscriber);
            }
            catch (Exception ex)
            {
                errors.Add(new { row = rowNumber, message = ex.Message });
            }
        }

        if (subscribers.Count > 0)
        {
            await _context.Subscribers.AddRangeAsync(subscribers);
            await _context.SaveChangesAsync();
        }

        return Ok(new
        {
            message = "Subscriber Excel import completed.",
            imported = subscribers.Count,
            failed = errors.Count,
            totalRows = rows.Count,
            errors
        });
    }

    private int FindHeaderRow(IXLWorksheet worksheet)
    {
        int rowIdx = 1;
        foreach (var row in worksheet.RowsUsed().Take(10))
        {
            var rowText = string.Join(" ", row.CellsUsed().Select(c => c.GetString()));
            if (rowText.Contains("FullName", StringComparison.OrdinalIgnoreCase) ||
                rowText.Contains("Customer Name", StringComparison.OrdinalIgnoreCase) ||
                rowText.Contains("Username", StringComparison.OrdinalIgnoreCase) ||
                rowText.Contains("NasId", StringComparison.OrdinalIgnoreCase))
            {
                return rowIdx;
            }
            rowIdx++;
        }
        return 1;
    }

    private SubscriberExcelImportExtendedDto ReadExcelRowFlexible(IXLRow row, Dictionary<string, int> headers)
    {
        string GetVal(params string[] columnNames)
        {
            foreach (var col in columnNames)
            {
                if (headers.TryGetValue(col, out int colIdx))
                {
                    var val = row.Cell(colIdx).GetString().Trim();
                    if (!string.IsNullOrWhiteSpace(val)) return val;
                }
            }
            return string.Empty;
        }

        return new SubscriberExcelImportExtendedDto
        {
            NasId = GetVal("NasId"),
            NasName = GetVal("NasName", "NAS"),
            PackageId = GetVal("PackageId"),
            PackageName = GetVal("PackageName", "Plan", "Package"),
            SubscriberType = GetVal("SubscriberType", "Category"),
            FullName = GetVal("FullName", "Customer Name", "Name"),
            CompanyName = GetVal("CompanyName"),
            Mobile = GetVal("Mobile", "Phone", "Contact"),
            Email = GetVal("Email"),
            // Map alternative column names directly into properties
            Username = GetVal("Username"),
            UserPassword = GetVal("UserPassword", "Password"),
            PortalUsername = GetVal("PortalUsername"),
            PortalPassword = GetVal("PortalPassword"),
            PPPoEUsername = GetVal("PPPoEUsername"),
            PPPoEPassword = GetVal("PPPoEPassword"),
            Address = GetVal("Address"),
            Zip = GetVal("Zip", "Pincode"),
            City = GetVal("City"),
            State = GetVal("State"),
            PhotoUrl = GetVal("PhotoUrl"),
            GstNo = GetVal("GstNo", "GSTIN"),
            Comment = GetVal("Comment", "Descriprion", "Description"),
            Service = GetVal("Service"),
            MacAddress = GetVal("MacAddress"),
            StaticIp = GetVal("StaticIp", "Ip"),
            ConnectionEnabled = GetVal("ConnectionEnabled"),
            IsActive = GetVal("Status", "IsActive"),
            ExpireDateStr = GetVal("ExpireDate", "Expiry date", "ExpiryDate")
        };
    }

    private async Task<NasLookupResult> FindNasAsync(SubscriberExcelImportExtendedDto dto, List<Guid> siteIds)
    {
        if (string.IsNullOrWhiteSpace(dto.NasId) && string.IsNullOrWhiteSpace(dto.NasName))
        {
            return NasLookupResult.Ok(null);
        }

        if (!string.IsNullOrWhiteSpace(dto.NasId))
        {
            if (!Guid.TryParse(dto.NasId.Trim(), out var nasGuid))
            {
                return NasLookupResult.Fail($"Invalid NasId: {dto.NasId}");
            }

            var nas = await _context.NasDevices.FirstOrDefaultAsync(x => x.Id == nasGuid && siteIds.Contains(x.SiteId));
            if (nas == null)
            {
                return NasLookupResult.Fail($"NAS ID '{dto.NasId}' not found in your accessible site.");
            }
            return NasLookupResult.Ok(nas.Id);
        }

        var nasName = dto.NasName!.Trim();
        var nasList = await _context.NasDevices
            .Where(x => siteIds.Contains(x.SiteId) && x.NasName != null && x.NasName.ToLower() == nasName.ToLower())
            .ToListAsync();

        if (nasList.Count == 0) return NasLookupResult.Fail($"NAS '{nasName}' not found.");
        return NasLookupResult.Ok(nasList[0].Id);
    }

    private async Task<PackageLookupResult> FindPackageAsync(SubscriberExcelImportExtendedDto dto, List<Guid> siteIds)
    {
        if (string.IsNullOrWhiteSpace(dto.PackageId) && string.IsNullOrWhiteSpace(dto.PackageName))
        {
            return PackageLookupResult.Ok(null);
        }

        if (!string.IsNullOrWhiteSpace(dto.PackageId))
        {
            if (!Guid.TryParse(dto.PackageId.Trim(), out var packageGuid))
            {
                return PackageLookupResult.Fail($"Invalid PackageId: {dto.PackageId}");
            }

            var package = await _context.PackageProfiles.FirstOrDefaultAsync(x => x.Id == packageGuid && siteIds.Contains(x.SiteId));
            if (package == null) return PackageLookupResult.Fail($"Package ID '{dto.PackageId}' not found.");
            return PackageLookupResult.Ok(package.Id);
        }

        var packageName = dto.PackageName!.Trim();
        var packageList = await _context.PackageProfiles
            .Where(x => siteIds.Contains(x.SiteId) && x.PackageName != null && x.PackageName.ToLower() == packageName.ToLower())
            .ToListAsync();

        if (packageList.Count == 0) return PackageLookupResult.Fail($"Package '{packageName}' not found.");
        return PackageLookupResult.Ok(packageList[0].Id);
    }

    private BooleanResult ParseBoolean(string? value, bool defaultValue)
    {
        if (string.IsNullOrWhiteSpace(value)) return new BooleanResult(true, defaultValue);

        var v = value.Trim().ToLowerInvariant();
        switch (v)
        {
            case "true":
            case "yes":
            case "1":
            case "active":
            case "enabled":
                return new BooleanResult(true, true);
            case "false":
            case "no":
            case "0":
            case "inactive":
            case "disabled":
                return new BooleanResult(true, false);
            default:
                return new BooleanResult(false, defaultValue);
        }
    }

    private async Task<List<Guid>> GetAccessibleSiteIds(string? userIdStr, string? organizationIdStr, bool isSuperAdmin)
    {
        if (isSuperAdmin)
        {
            return await _context.Sites.Where(x => !x.IsDeleted).Select(x => x.Id).ToListAsync();
        }

        if (!Guid.TryParse(userIdStr, out var currentUserId))
        {
            return new List<Guid>();
        }

        var loggedInSite = await _context.Sites.FirstOrDefaultAsync(x => x.UserId == currentUserId && !x.IsDeleted);
        if (loggedInSite != null)
        {
            return await _context.Sites
                .Where(x => !x.IsDeleted && (x.Id == loggedInSite.Id || x.ParentSiteId == loggedInSite.Id))
                .Select(x => x.Id)
                .ToListAsync();
        }

        return new List<Guid>();
    }

    private class NasLookupResult
    {
        public bool Success { get; set; }
        public Guid? NasId { get; set; }
        public string? Message { get; set; }
        public static NasLookupResult Ok(Guid? nasId) => new() { Success = true, NasId = nasId };
        public static NasLookupResult Fail(string message) => new() { Success = false, Message = message };
    }

    private class PackageLookupResult
    {
        public bool Success { get; set; }
        public Guid? PackageId { get; set; }
        public string? Message { get; set; }
        public static PackageLookupResult Ok(Guid? packageId) => new() { Success = true, PackageId = packageId };
        public static PackageLookupResult Fail(string message) => new() { Success = false, Message = message };
    }

    private class BooleanResult
    {
        public bool Success { get; }
        public bool Value { get; }
        public BooleanResult(bool success, bool value) { Success = success; Value = value; }
    }

    private class SubscriberExcelImportExtendedDto : SubscriberExcelImportDto
    {
        public string? Username { get; set; }
        public string? UserPassword { get; set; }
        public string? ExpireDateStr { get; set; }
    }
}
//using ClosedXML.Excel;
//using Microsoft.AspNetCore.Authorization;
//using Microsoft.AspNetCore.Mvc;
//using Microsoft.EntityFrameworkCore;
//using RadiusSoftware.Core.DTOs;
//using RadiusSoftware.Core.Entities;
//using RadiusSoftware.Infrastructure.Data;
//using System.Security.Claims;

//namespace RadiusSoftware.API.Controllers;

//[Authorize]
//[ApiController]
//[Route("api/subscriber-import")]
//public class SubscriberImportController : ControllerBase
//{
//    private readonly AppDbContext _context;

//    public SubscriberImportController(AppDbContext context)
//    {
//        _context = context;
//    }

//    // ============================================================
//    // POST: /api/subscriber-import/upload
//    // ============================================================

//    [HttpPost("upload")]
//    public async Task<IActionResult> UploadExcel(IFormFile file)
//    {
//        if (file == null || file.Length == 0)
//        {
//            return BadRequest(new
//            {
//                message = "Please select an Excel file."
//            });
//        }

//        if (!Path.GetExtension(file.FileName)
//            .Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
//        {
//            return BadRequest(new
//            {
//                message = "Only .xlsx Excel files are supported."
//            });
//        }

//        // ========================================================
//        // 1. LOGGED-IN USER
//        // ========================================================

//        var userIdStr =
//            User.FindFirst(ClaimTypes.NameIdentifier)?.Value
//            ?? User.FindFirst("sub")?.Value;

//        var organizationIdStr =
//            User.FindFirst("OrganizationId")?.Value;

//        var isSuperAdmin =
//            bool.TryParse(
//                User.FindFirst("IsSuperAdmin")?.Value,
//                out var superAdmin)
//            && superAdmin;

//        // ========================================================
//        // 2. ACCESSIBLE SITES
//        // ========================================================

//        var siteIds = await GetAccessibleSiteIds(
//            userIdStr,
//            organizationIdStr,
//            isSuperAdmin);

//        if (siteIds.Count == 0)
//        {
//            return BadRequest(new
//            {
//                message = "No accessible site found for this user."
//            });
//        }

//        // ========================================================
//        // 3. CURRENT SITE
//        // ========================================================

//        // First site is user's own site
//        var siteId = siteIds.First();

//        // ========================================================
//        // 4. OPEN EXCEL
//        // ========================================================

//        using var stream = file.OpenReadStream();

//        using var workbook = new XLWorkbook(stream);

//        if (!workbook.Worksheets.Contains("Subscribers"))
//        {
//            return BadRequest(new
//            {
//                message = "Excel sheet 'Subscribers' was not found."
//            });
//        }

//        var worksheet =
//            workbook.Worksheet("Subscribers");

//        var rows = worksheet
//            .RowsUsed()
//            .Skip(1)
//            .ToList();

//        if (rows.Count == 0)
//        {
//            return BadRequest(new
//            {
//                message =
//                    "Excel file does not contain any subscriber records."
//            });
//        }

//        // ========================================================
//        // 5. IMPORT
//        // ========================================================

//        var subscribers = new List<Subscriber>();

//        var errors = new List<object>();

//        int rowNumber = 1;

//        foreach (var row in rows)
//        {
//            rowNumber++;

//            // ----------------------------------------------------
//            // Empty row
//            // ----------------------------------------------------

//            if (row.Cells()
//                .All(x => string.IsNullOrWhiteSpace(x.GetString())))
//            {
//                continue;
//            }

//            try
//            {
//                // ====================================================
//                // READ EXCEL ROW
//                // ====================================================

//                var dto = ReadExcelRow(row);

//                // ====================================================
//                // VALIDATE
//                // ====================================================

//                var validationError =
//                    ValidateRow(dto);

//                if (validationError != null)
//                {
//                    errors.Add(new
//                    {
//                        row = rowNumber,
//                        message = validationError
//                    });

//                    continue;
//                }

//                // ====================================================
//                // FIND NAS
//                // ====================================================

//                var nasResult =
//                    await FindNasAsync(
//                        dto,
//                        siteIds);

//                if (!nasResult.Success)
//                {
//                    errors.Add(new
//                    {
//                        row = rowNumber,
//                        message = nasResult.Message
//                    });

//                    continue;
//                }

//                // ====================================================
//                // FIND PACKAGE
//                // ====================================================

//                var packageResult =
//                    await FindPackageAsync(
//                        dto,
//                        siteIds);

//                if (!packageResult.Success)
//                {
//                    errors.Add(new
//                    {
//                        row = rowNumber,
//                        message = packageResult.Message
//                    });

//                    continue;
//                }

//                // ====================================================
//                // BOOLEAN
//                // ====================================================

//                var connectionResult =
//                    ParseBoolean(
//                        dto.ConnectionEnabled,
//                        true);

//                if (!connectionResult.Success)
//                {
//                    errors.Add(new
//                    {
//                        row = rowNumber,
//                        message =
//                            "ConnectionEnabled must be true/false, Active/Inactive, Yes/No or 1/0."
//                    });

//                    continue;
//                }

//                var activeResult =
//                    ParseBoolean(
//                        dto.IsActive,
//                        true);

//                if (!activeResult.Success)
//                {
//                    errors.Add(new
//                    {
//                        row = rowNumber,
//                        message =
//                            "IsActive must be true/false, Active/Inactive, Yes/No or 1/0."
//                    });

//                    continue;
//                }

//                // ====================================================
//                // CREATE SUBSCRIBER
//                // ====================================================

//                var subscriber = new Subscriber
//                {
//                    Id = Guid.NewGuid(),

//                    // IMPORTANT
//                    // Site Excel se nahi liya ja raha
//                    // Logged-in user's site automatically
//                    SiteId = siteId,

//                    NasId = nasResult.NasId,

//                    PackageId = packageResult.PackageId,

//                    SubscriberType =
//                        string.IsNullOrWhiteSpace(dto.SubscriberType)
//                            ? "Individual"
//                            : dto.SubscriberType.Trim(),

//                    FullName =
//                        dto.FullName!.Trim(),

//                    CompanyName =
//                        dto.CompanyName?.Trim()
//                        ?? string.Empty,

//                    Mobile =
//                        dto.Mobile?.Trim()
//                        ?? string.Empty,

//                    Email =
//                        dto.Email?.Trim()
//                        ?? string.Empty,

//                    PortalUsername =
//                        dto.PortalUsername?.Trim()
//                        ?? string.Empty,

//                    PortalPassword =
//                        dto.PortalPassword?.Trim()
//                        ?? string.Empty,

//                    Address =
//                        dto.Address?.Trim()
//                        ?? string.Empty,

//                    Zip =
//                        dto.Zip?.Trim()
//                        ?? string.Empty,

//                    City =
//                        dto.City?.Trim()
//                        ?? string.Empty,

//                    State =
//                        dto.State?.Trim()
//                        ?? string.Empty,

//                    PhotoUrl =
//                        string.IsNullOrWhiteSpace(dto.PhotoUrl)
//                            ? null
//                            : dto.PhotoUrl.Trim(),

//                    GstNo =
//                        dto.GstNo?.Trim()
//                        ?? string.Empty,

//                    Comment =
//                        dto.Comment?.Trim()
//                        ?? string.Empty,

//                    Service =
//                        string.IsNullOrWhiteSpace(dto.Service)
//                            ? "PPPoE"
//                            : dto.Service.Trim(),

//                    PPPoEUsername =
//                        dto.PPPoEUsername?.Trim()
//                        ?? string.Empty,

//                    PPPoEPassword =
//                        dto.PPPoEPassword?.Trim()
//                        ?? string.Empty,

//                    MacAddress =
//                        dto.MacAddress?.Trim()
//                        ?? string.Empty,

//                    StaticIp =
//                        dto.StaticIp?.Trim()
//                        ?? string.Empty,

//                    ConnectionEnabled =
//                        connectionResult.Value,

//                    IsActive =
//                        activeResult.Value,

//                    CreatedAt =
//                        DateTime.UtcNow,

//                    UpdatedAt =
//                        DateTime.UtcNow
//                };

//                subscribers.Add(subscriber);
//            }
//            catch (Exception ex)
//            {
//                errors.Add(new
//                {
//                    row = rowNumber,
//                    message = ex.Message
//                });
//            }
//        }

//        // ========================================================
//        // 6. SAVE ALL
//        // ========================================================

//        if (subscribers.Count > 0)
//        {
//            await _context.Subscribers.AddRangeAsync(subscribers);

//            await _context.SaveChangesAsync();
//        }

//        // ========================================================
//        // 7. RESPONSE
//        // ========================================================

//        return Ok(new
//        {
//            message =
//                "Subscriber Excel import completed.",

//            imported =
//                subscribers.Count,

//            failed =
//                errors.Count,

//            totalRows =
//                rows.Count,

//            errors
//        });
//    }


//    // ============================================================
//    // READ EXCEL ROW
//    // ============================================================

//    private SubscriberExcelImportDto ReadExcelRow(
//        IXLRow row)
//    {
//        return new SubscriberExcelImportDto
//        {
//            NasId =
//                GetCell(row, 1),

//            NasName =
//                GetCell(row, 2),

//            PackageId =
//                GetCell(row, 3),

//            PackageName =
//                GetCell(row, 4),

//            SubscriberType =
//                GetCell(row, 5),

//            FullName =
//                GetCell(row, 6),

//            CompanyName =
//                GetCell(row, 7),

//            Mobile =
//                GetCell(row, 8),

//            Email =
//                GetCell(row, 9),

//            PortalUsername =
//                GetCell(row, 10),

//            PortalPassword =
//                GetCell(row, 11),

//            Address =
//                GetCell(row, 12),

//            Zip =
//                GetCell(row, 13),

//            City =
//                GetCell(row, 14),

//            State =
//                GetCell(row, 15),

//            PhotoUrl =
//                GetCell(row, 16),

//            GstNo =
//                GetCell(row, 17),

//            Comment =
//                GetCell(row, 18),

//            Service =
//                GetCell(row, 19),

//            PPPoEUsername =
//                GetCell(row, 20),

//            PPPoEPassword =
//                GetCell(row, 21),

//            MacAddress =
//                GetCell(row, 22),

//            StaticIp =
//                GetCell(row, 23),

//            ConnectionEnabled =
//                GetCell(row, 24),

//            IsActive =
//                GetCell(row, 25)
//        };
//    }


//    // ============================================================
//    // GET CELL
//    // ============================================================

//    private string? GetCell(
//        IXLRow row,
//        int column)
//    {
//        var value =
//            row.Cell(column)
//                .GetString()
//                .Trim();

//        return string.IsNullOrWhiteSpace(value)
//            ? null
//            : value;
//    }


//    // ============================================================
//    // VALIDATE ROW
//    // ============================================================

//    private string? ValidateRow(
//        SubscriberExcelImportDto dto)
//    {
//        if (string.IsNullOrWhiteSpace(dto.FullName))
//        {
//            return "FullName is required.";
//        }

//        if (string.IsNullOrWhiteSpace(dto.SubscriberType))
//        {
//            dto.SubscriberType = "Individual";
//        }

//        dto.SubscriberType =
//            dto.SubscriberType.Trim();

//        if (!dto.SubscriberType.Equals(
//                "Individual",
//                StringComparison.OrdinalIgnoreCase)
//            &&
//            !dto.SubscriberType.Equals(
//                "Corporate",
//                StringComparison.OrdinalIgnoreCase))
//        {
//            return
//                "SubscriberType must be Individual or Corporate.";
//        }

//        if (string.IsNullOrWhiteSpace(dto.Service))
//        {
//            dto.Service = "PPPoE";
//        }

//        dto.Service =
//            dto.Service.Trim();

//        if (!dto.Service.Equals(
//                "PPPoE",
//                StringComparison.OrdinalIgnoreCase)
//            &&
//            !dto.Service.Equals(
//                "Hotspot",
//                StringComparison.OrdinalIgnoreCase)
//            &&
//            !dto.Service.Equals(
//                "Static",
//                StringComparison.OrdinalIgnoreCase))
//        {
//            return
//                "Service must be PPPoE, Hotspot or Static.";
//        }

//        return null;
//    }


//    // ============================================================
//    // FIND NAS
//    // ============================================================

//    private async Task<NasLookupResult> FindNasAsync(
//        SubscriberExcelImportDto dto,
//        List<Guid> siteIds)
//    {
//        // No NAS
//        if (string.IsNullOrWhiteSpace(dto.NasId) &&
//            string.IsNullOrWhiteSpace(dto.NasName))
//        {
//            return NasLookupResult.Ok(null);
//        }

//        // ========================================================
//        // NAS ID
//        // ========================================================

//        if (!string.IsNullOrWhiteSpace(dto.NasId))
//        {
//            if (!Guid.TryParse(
//                dto.NasId.Trim(),
//                out var nasGuid))
//            {
//                return NasLookupResult.Fail(
//                    $"Invalid NasId: {dto.NasId}");
//            }

//            var nas =
//                await _context.NasDevices
//                    .FirstOrDefaultAsync(x =>
//                        x.Id == nasGuid &&
//                        siteIds.Contains(x.SiteId));

//            if (nas == null)
//            {
//                return NasLookupResult.Fail(
//                    $"NAS ID '{dto.NasId}' not found in your accessible site.");
//            }

//            // If both ID and Name supplied
//            if (!string.IsNullOrWhiteSpace(dto.NasName))
//            {
//                if (!string.Equals(
//                    nas.NasName?.Trim(),
//                    dto.NasName.Trim(),
//                    StringComparison.OrdinalIgnoreCase))
//                {
//                    return NasLookupResult.Fail(
//                        $"NasId and NasName do not match. Actual NAS name: {nas.NasName}");
//                }
//            }

//            return NasLookupResult.Ok(nas.Id);
//        }

//        // ========================================================
//        // NAS NAME
//        // ========================================================

//        var nasName =
//            dto.NasName!.Trim();

//        var nasList =
//            await _context.NasDevices
//                .Where(x =>
//                    siteIds.Contains(x.SiteId) &&
//                    x.NasName != null &&
//                    x.NasName.ToLower() ==
//                        nasName.ToLower())
//                .ToListAsync();

//        if (nasList.Count == 0)
//        {
//            return NasLookupResult.Fail(
//                $"NAS '{nasName}' not found in your accessible site.");
//        }

//        if (nasList.Count > 1)
//        {
//            return NasLookupResult.Fail(
//                $"Multiple NAS devices found with name '{nasName}'. Please use NasId.");
//        }

//        return NasLookupResult.Ok(
//            nasList[0].Id);
//    }


//    // ============================================================
//    // FIND PACKAGE
//    // ============================================================

//    private async Task<PackageLookupResult> FindPackageAsync(
//        SubscriberExcelImportDto dto,
//        List<Guid> siteIds)
//    {
//        // No Package
//        if (string.IsNullOrWhiteSpace(dto.PackageId) &&
//            string.IsNullOrWhiteSpace(dto.PackageName))
//        {
//            return PackageLookupResult.Ok(null);
//        }

//        // ========================================================
//        // PACKAGE ID
//        // ========================================================

//        if (!string.IsNullOrWhiteSpace(dto.PackageId))
//        {
//            if (!Guid.TryParse(
//                dto.PackageId.Trim(),
//                out var packageGuid))
//            {
//                return PackageLookupResult.Fail(
//                    $"Invalid PackageId: {dto.PackageId}");
//            }

//            var package =
//                await _context.PackageProfiles
//                    .FirstOrDefaultAsync(x =>
//                        x.Id == packageGuid &&
//                        siteIds.Contains(x.SiteId));

//            if (package == null)
//            {
//                return PackageLookupResult.Fail(
//                    $"Package ID '{dto.PackageId}' not found in your accessible site.");
//            }

//            // If both ID and Name supplied
//            if (!string.IsNullOrWhiteSpace(dto.PackageName))
//            {
//                if (!string.Equals(
//                    package.PackageName?.Trim(),
//                    dto.PackageName.Trim(),
//                    StringComparison.OrdinalIgnoreCase))
//                {
//                    return PackageLookupResult.Fail(
//                        $"PackageId and PackageName do not match. Actual package name: {package.PackageName}");
//                }
//            }

//            return PackageLookupResult.Ok(
//                package.Id);
//        }

//        // ========================================================
//        // PACKAGE NAME
//        // ========================================================

//        var packageName =
//            dto.PackageName!.Trim();

//        var packageList =
//            await _context.PackageProfiles
//                .Where(x =>
//                    siteIds.Contains(x.SiteId) &&
//                    x.PackageName != null &&
//                    x.PackageName.ToLower() ==
//                        packageName.ToLower())
//                .ToListAsync();

//        if (packageList.Count == 0)
//        {
//            return PackageLookupResult.Fail(
//                $"Package '{packageName}' not found in your accessible site.");
//        }

//        if (packageList.Count > 1)
//        {
//            return PackageLookupResult.Fail(
//                $"Multiple packages found with name '{packageName}'. Please use PackageId.");
//        }

//        return PackageLookupResult.Ok(
//            packageList[0].Id);
//    }


//    // ============================================================
//    // BOOLEAN PARSER
//    // Supports:
//    // true / false
//    // Active / Inactive
//    // Yes / No
//    // 1 / 0
//    // ============================================================

//    private BooleanResult ParseBoolean(
//        string? value,
//        bool defaultValue)
//    {
//        if (string.IsNullOrWhiteSpace(value))
//        {
//            return new BooleanResult(
//                true,
//                defaultValue);
//        }

//        var v =
//            value.Trim()
//                .ToLowerInvariant();

//        switch (v)
//        {
//            case "true":
//            case "yes":
//            case "1":
//            case "active":
//            case "enabled":
//                return new BooleanResult(
//                    true,
//                    true);

//            case "false":
//            case "no":
//            case "0":
//            case "inactive":
//            case "disabled":
//                return new BooleanResult(
//                    true,
//                    false);

//            default:
//                return new BooleanResult(
//                    false,
//                    false);
//        }
//    }


//    // ============================================================
//    // ACCESSIBLE SITE IDS
//    // ============================================================

//    private async Task<List<Guid>> GetAccessibleSiteIds(
//        string? userIdStr,
//        string? organizationIdStr,
//        bool isSuperAdmin)
//    {
//        // ========================================================
//        // SUPER ADMIN
//        // ========================================================

//        if (isSuperAdmin)
//        {
//            return await _context.Sites
//                .Where(x => !x.IsDeleted)
//                .Select(x => x.Id)
//                .ToListAsync();
//        }

//        // ========================================================
//        // USER ID
//        // ========================================================

//        if (!Guid.TryParse(
//            userIdStr,
//            out var currentUserId))
//        {
//            return new List<Guid>();
//        }

//        // ========================================================
//        // LOGGED-IN USER'S OWN SITE
//        // ========================================================

//        var loggedInSite =
//            await _context.Sites
//                .FirstOrDefaultAsync(x =>
//                    x.UserId == currentUserId &&
//                    !x.IsDeleted);

//        if (loggedInSite != null)
//        {
//            // IMPORTANT:
//            //
//            // User ki APNI site bhi include hogi
//            // aur uski child sites bhi.
//            //
//            // Example:
//            //
//            // User -> Site 66c5...
//            //
//            // NAS -> SiteId 66c5...
//            //
//            // Package -> SiteId 66c5...
//            //
//            // Dono accessible rahenge.

//            return await _context.Sites
//                .Where(x =>
//                    !x.IsDeleted &&
//                    (
//                        x.Id == loggedInSite.Id ||
//                        x.ParentSiteId == loggedInSite.Id
//                    ))
//                .Select(x => x.Id)
//                .ToListAsync();
//        }

//        // ========================================================
//        // ORGANIZATION ADMIN
//        // ========================================================

//        if (Guid.TryParse(
//            organizationIdStr,
//            out var organizationId))
//        {
//            return await _context.Sites
//                .Where(x =>
//                    x.ParentOrganisationID == organizationId &&
//                    x.ParentSiteId == null &&
//                    !x.IsDeleted)
//                .Select(x => x.Id)
//                .ToListAsync();
//        }

//        return new List<Guid>();
//    }


//    // ============================================================
//    // RESULT CLASSES
//    // ============================================================

//    private class NasLookupResult
//    {
//        public bool Success { get; set; }

//        public Guid? NasId { get; set; }

//        public string? Message { get; set; }

//        public static NasLookupResult Ok(
//            Guid? nasId)
//        {
//            return new NasLookupResult
//            {
//                Success = true,
//                NasId = nasId
//            };
//        }

//        public static NasLookupResult Fail(
//            string message)
//        {
//            return new NasLookupResult
//            {
//                Success = false,
//                Message = message
//            };
//        }
//    }


//    private class PackageLookupResult
//    {
//        public bool Success { get; set; }

//        public Guid? PackageId { get; set; }

//        public string? Message { get; set; }

//        public static PackageLookupResult Ok(
//            Guid? packageId)
//        {
//            return new PackageLookupResult
//            {
//                Success = true,
//                PackageId = packageId
//            };
//        }

//        public static PackageLookupResult Fail(
//            string message)
//        {
//            return new PackageLookupResult
//            {
//                Success = false,
//                Message = message
//            };
//        }
//    }


//    private class BooleanResult
//    {
//        public bool Success { get; }

//        public bool Value { get; }

//        public BooleanResult(
//            bool success,
//            bool value)
//        {
//            Success = success;
//            Value = value;
//        }
//    }
//}