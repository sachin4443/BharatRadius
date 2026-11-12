using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PdfSharp.Drawing;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;
using System.Data;
using System.Security.Claims;

namespace RadiusSoftware.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CAFController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _environment;

    // =========================================================
    // THEME
    // =========================================================
    private static readonly XColor ThemeOrange = XColor.FromArgb(255, 108, 15); // #FF6C0F
    private static readonly XColor ThemeOrangeDark = XColor.FromArgb(235, 85, 5);
    private static readonly XColor ThemeNavy = XColor.FromArgb(24, 34, 52);
    private static readonly XColor TextDark = XColor.FromArgb(45, 45, 45);
    private static readonly XColor TextGray = XColor.FromArgb(105, 105, 105);
    private static readonly XColor BorderGray = XColor.FromArgb(220, 224, 230);
    private static readonly XColor SectionBg = XColor.FromArgb(247, 248, 250);
    private static readonly XColor White = XColor.FromArgb(255, 255, 255);

    public CAFController(
        AppDbContext context,
        IWebHostEnvironment environment)
    {
        _context = context;
        _environment = environment;
    }

    // =========================================================
    // GET SUBSCRIBERS
    // =========================================================
    [HttpGet("subscribers")]
    public async Task<IActionResult> GetSubscribers()
    {
        try
        {
            var isSuperAdmin = string.Equals(
                User.FindFirst("IsSuperAdmin")?.Value,
                "True",
                StringComparison.OrdinalIgnoreCase);

            var userIdStr =
                User.FindFirst(ClaimTypes.NameIdentifier)?.Value ??
                User.FindFirst("sub")?.Value;

            if (isSuperAdmin)
            {
                var allSubscribers = await _context.Subscribers
                    .AsNoTracking()
                    .OrderByDescending(x => x.CreatedAt)
                    .ToListAsync();

                return Ok(allSubscribers);
            }

            if (!Guid.TryParse(userIdStr, out var currentUserId))
            {
                return Unauthorized(new
                {
                    message = "Invalid logged-in user."
                });
            }

            var subscribers = await _context.Subscribers
                .AsNoTracking()
                .Where(sub => _context.Sites.Any(site =>
                    site.Id == sub.SiteId &&
                    site.UserId == currentUserId &&
                    !site.IsDeleted))
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

            return Ok(subscribers);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Unable to load subscribers.",
                error = ex.Message
            });
        }
    }

    // =========================================================
    // GET SUBSCRIBER DETAILS
    // =========================================================
    [HttpGet("subscribers/{subscriberId:guid}")]
    public async Task<IActionResult> GetSubscriber(Guid subscriberId)
    {
        try
        {
            var subscriber = await GetAuthorizedSubscriberAsync(subscriberId);

            if (subscriber == null)
            {
                return NotFound(new
                {
                    message = "Subscriber not found or access denied."
                });
            }

            var site = await _context.Sites
                .AsNoTracking()
                .Where(x =>
                    x.Id == subscriber.SiteId &&
                    !x.IsDeleted)
                .Select(x => new
                {
                    x.Id,
                    x.SiteName,
                    x.CompanyName,
                    x.SiteEmail,
                    x.SiteMobileNo
                })
                .FirstOrDefaultAsync();

            PackageProfile? package = null;

            if (subscriber.PackageId.HasValue)
            {
                package = await _context.Set<PackageProfile>()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x =>
                        x.Id == subscriber.PackageId.Value);
            }

            var documents = await _context.CAFDocuments
                .AsNoTracking()
                .Where(x => x.SubscriberId == subscriberId)
                .OrderBy(x => x.DocumentType)
                .Select(x => new
                {
                    x.Id,
                    x.DocumentType,
                    x.FileName,
                    x.RelativePath,
                    x.UploadedAt
                })
                .ToListAsync();

            return Ok(new
            {
                subscriber,
                site,
                package,
                documents
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Unable to load subscriber details.",
                error = ex.Message
            });
        }
    }

    // =========================================================
    // UPLOAD DOCUMENT
    // =========================================================
    [HttpPost("subscribers/{subscriberId:guid}/documents/{documentType}")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> UploadDocument(
        Guid subscriberId,
        string documentType,
        IFormFile file)
    {
        try
        {
            var allowedTypes = new[]
            {
                "Aadhaar",
                "PAN",
                "DrivingLicence",
                "Agreement"
            };

            var normalizedType = allowedTypes.FirstOrDefault(
                x => x.Equals(
                    documentType,
                    StringComparison.OrdinalIgnoreCase));

            if (normalizedType == null)
            {
                return BadRequest(new
                {
                    message = "Invalid document type."
                });
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(new
                {
                    message = "Please select a file."
                });
            }

            var subscriber =
                await GetAuthorizedSubscriberAsync(subscriberId);

            if (subscriber == null)
            {
                return NotFound(new
                {
                    message = "Subscriber not found or access denied."
                });
            }

            var extension =
                Path.GetExtension(file.FileName)
                    .ToLowerInvariant();

            var allowedExtensions = new[]
            {
                ".pdf",
                ".jpg",
                ".jpeg",
                ".png"
            };

            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new
                {
                    message = "Only PDF, JPG, JPEG and PNG files are allowed."
                });
            }

            var webRoot = Path.Combine(
                Directory.GetCurrentDirectory(),
                "wwwroot");

            var subscriberFolder = Path.Combine(
                webRoot,
                "caf-documents",
                subscriberId.ToString());

            Directory.CreateDirectory(subscriberFolder);

            var storedFileName =
                $"{normalizedType}_{Guid.NewGuid():N}{extension}";

            var physicalPath =
                Path.Combine(
                    subscriberFolder,
                    storedFileName);

            await using (var stream =
                new FileStream(
                    physicalPath,
                    FileMode.CreateNew))
            {
                await file.CopyToAsync(stream);
            }

            var document = new CAFDocument
            {
                Id = Guid.NewGuid(),
                SubscriberId = subscriberId,
                DocumentType = normalizedType,
                FileName = Path.GetFileName(file.FileName),
                StoredFileName = storedFileName,
                RelativePath =
                    $"/caf-documents/{subscriberId}/{storedFileName}",
                UploadedAt = DateTime.UtcNow
            };

            _context.CAFDocuments.Add(document);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"{normalizedType} uploaded successfully."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Unable to upload document.",
                error = ex.Message
            });
        }
    }

    // =========================================================
    // GET DOCUMENTS
    // =========================================================
    [HttpGet("subscribers/{subscriberId:guid}/documents")]
    public async Task<IActionResult> GetDocuments(Guid subscriberId)
    {
        var subscriber =
            await GetAuthorizedSubscriberAsync(subscriberId);

        if (subscriber == null)
        {
            return NotFound();
        }

        var uploaded = await _context.CAFDocuments
            .AsNoTracking()
            .Where(x => x.SubscriberId == subscriberId)
            .ToListAsync();

        var documentTypes = new[]
        {
            "Aadhaar",
            "PAN",
            "DrivingLicence",
            "Agreement"
        };

        var result = documentTypes.Select(type =>
        {
            var doc = uploaded.FirstOrDefault(
                x => x.DocumentType == type);

            return new
            {
                documentType = type,
                uploaded = doc != null,
                id = doc?.Id,
                fileName = doc?.FileName,
                relativePath = doc?.RelativePath,
                uploadedAt = doc?.UploadedAt
            };
        }).ToList();

        return Ok(result);
    }

    // =========================================================
    // DOWNLOAD DOCUMENT
    // =========================================================
    [HttpGet("documents/{documentId:guid}/download")]
    public async Task<IActionResult> DownloadDocument(Guid documentId)
    {
        var doc = await _context.CAFDocuments
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == documentId);

        if (doc == null)
        {
            return NotFound();
        }

        var subscriber =
            await GetAuthorizedSubscriberAsync(doc.SubscriberId);

        if (subscriber == null)
        {
            return Forbid();
        }

        var physicalPath =
            GetPhysicalPath(doc.RelativePath);

        if (!System.IO.File.Exists(physicalPath))
        {
            return NotFound();
        }

        var bytes =
            await System.IO.File.ReadAllBytesAsync(
                physicalPath);

        return File(
            bytes,
            GetContentType(Path.GetExtension(doc.FileName)),
            doc.FileName);
    }

    // =========================================================
    // GENERATE CAF
    // =========================================================
    [HttpGet("generate/{subscriberId:guid}")]
    public async Task<IActionResult> GenerateCAF(Guid subscriberId)
    {
        try
        {
            var subscriber =
                await GetAuthorizedSubscriberAsync(subscriberId);

            if (subscriber == null)
            {
                return NotFound(new
                {
                    message = "Subscriber not found or access denied."
                });
            }

            var site = await _context.Sites
                .AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    x.Id == subscriber.SiteId &&
                    !x.IsDeleted);

            if (site == null)
            {
                return BadRequest(new
                {
                    message = "Subscriber site not found."
                });
            }

            PackageProfile? package = null;

            if (subscriber.PackageId.HasValue)
            {
                package = await _context
                    .Set<PackageProfile>()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x =>
                        x.Id == subscriber.PackageId.Value);
            }

            var cafNumber =
                await GetNextCafNumberAsync();

            var generatedAt =
                DateTime.UtcNow;

            var documents = await _context.CAFDocuments
                .AsNoTracking()
                .Where(x => x.SubscriberId == subscriberId)
                .OrderBy(x => x.DocumentType)
                .ToListAsync();

            var pdfBytes = GenerateCafPdf(
                subscriber,
                site,
                package,
                cafNumber,
                generatedAt,
                documents);

            pdfBytes =
                AppendDocumentsToPdf(
                    pdfBytes,
                    documents);

            var cafFolder = Path.Combine(
                Directory.GetCurrentDirectory(),
                "wwwroot",
                "caf-forms");

            Directory.CreateDirectory(cafFolder);

            var pdfFileName =
                $"CAF-{cafNumber}.pdf";

            var pdfPhysicalPath =
                Path.Combine(
                    cafFolder,
                    pdfFileName);

            await System.IO.File.WriteAllBytesAsync(
                pdfPhysicalPath,
                pdfBytes);

            var caf = new CustomerApplicationForm
            {
                Id = Guid.NewGuid(),
                CafNumber = cafNumber,
                SubscriberId = subscriber.Id,
                SiteId = subscriber.SiteId,
                GeneratedAt = generatedAt,
                PdfPath =
                    $"/caf-forms/{pdfFileName}"
            };

            _context.CustomerApplicationForms.Add(caf);

            await _context.SaveChangesAsync();

            return File(
                pdfBytes,
                "application/pdf",
                pdfFileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Unable to generate CAF.",
                error = ex.Message,
                details = ex.ToString()
            });
        }
    }

    // =========================================================
    // PDF GENERATION
    // =========================================================
    private byte[] GenerateCafPdf(
        Subscriber subscriber,
        Site site,
        PackageProfile? package,
        long cafNumber,
        DateTime generatedAt,
        List<CAFDocument> documents)
    {
        using var pdf = new PdfDocument();

        var page = pdf.AddPage();

        page.Size = PdfSharp.PageSize.A4;

        using var gfx =
            XGraphics.FromPdfPage(page);

        // -----------------------------------------------------
        // FONTS
        // -----------------------------------------------------

        var fontCompany =
            new XFont(
                "Arial",
                17,
                XFontStyleEx.Bold);

        var fontTitle =
            new XFont(
                "Arial",
                9,
                XFontStyleEx.Regular);

        var fontCAF =
            new XFont(
                "Arial",
                15,
                XFontStyleEx.Bold);

        var fontDate =
            new XFont(
                "Arial",
                8,
                XFontStyleEx.Regular);

        var fontSection =
            new XFont(
                "Arial",
                9,
                XFontStyleEx.Bold);

        var fontLabel =
            new XFont(
                "Arial",
                7.5,
                XFontStyleEx.Regular);

        var fontValue =
            new XFont(
                "Arial",
                9,
                XFontStyleEx.Bold);

        var fontNormal =
            new XFont(
                "Arial",
                8.5,
                XFontStyleEx.Regular);

        var fontSmall =
            new XFont(
                "Arial",
                7.5,
                XFontStyleEx.Regular);

        var fontSmallBold =
            new XFont(
                "Arial",
                7.5,
                XFontStyleEx.Bold);

        // -----------------------------------------------------
        // BRUSHES
        // -----------------------------------------------------

        var orangeBrush =
            new XSolidBrush(ThemeOrange);

        var orangeDarkBrush =
            new XSolidBrush(ThemeOrangeDark);

        var navyBrush =
            new XSolidBrush(ThemeNavy);

        var blackBrush =
            new XSolidBrush(TextDark);

        var grayBrush =
            new XSolidBrush(TextGray);

        var sectionBrush =
            new XSolidBrush(SectionBg);

        var whiteBrush =
            new XSolidBrush(White);

        var borderPen =
            new XPen(BorderGray, 0.7);

        // -----------------------------------------------------
        // PAGE DIMENSIONS
        // -----------------------------------------------------

        double width = page.Width;
        double height = page.Height;

        double margin = 38;
        double contentWidth =
            width - margin * 2;

        // =====================================================
        // HEADER
        // =====================================================

        const double headerHeight = 86;

        // White header
        gfx.DrawRectangle(
            whiteBrush,
            0,
            0,
            width,
            headerHeight);

        // Top orange line
        gfx.DrawRectangle(
            orangeBrush,
            0,
            0,
            width,
            5);

        // Left orange vertical accent
        gfx.DrawRectangle(
            orangeBrush,
            margin,
            20,
            4,
            48);

        // Company name
        gfx.DrawString(
            "FAB FIVE NETWORK PRIVATE LIMITED",
            fontCompany,
            navyBrush,
            new XPoint(
                margin + 16,
                37));

        // Subtitle
        gfx.DrawString(
            "CUSTOMER APPLICATION FORM",
            fontTitle,
            grayBrush,
            new XPoint(
                margin + 17,
                54));

        // Small separator
        gfx.DrawRectangle(
            orangeBrush,
            margin + 17,
            61,
            42,
            2);

        // CAF number block
        double cafBoxWidth = 150;
        double cafBoxX =
            width - margin - cafBoxWidth;

        gfx.DrawRectangle(
            sectionBrush,
            cafBoxX,
            18,
            cafBoxWidth,
            50);

        gfx.DrawString(
            $"CAF-{cafNumber}",
            fontCAF,
            orangeDarkBrush,
            new XRect(
                cafBoxX + 8,
                24,
                cafBoxWidth - 16,
                20),
            XStringFormats.TopRight);

        gfx.DrawString(
            $"Created: {generatedAt.ToLocalTime():dd MMM yyyy}",
            fontDate,
            grayBrush,
            new XRect(
                cafBoxX + 8,
                48,
                cafBoxWidth - 16,
                14),
            XStringFormats.TopRight);

        // Header bottom border
        gfx.DrawLine(
            borderPen,
            margin,
            headerHeight,
            width - margin,
            headerHeight);

        double y = headerHeight + 24;

        // =====================================================
        // CUSTOMER NAME
        // =====================================================

        gfx.DrawString(
            SafeString(subscriber.FullName),
            new XFont(
                "Arial",
                15,
                XFontStyleEx.Bold),
            blackBrush,
            new XPoint(
                margin,
                y));

        y += 21;

        if (!string.IsNullOrWhiteSpace(
            subscriber.CompanyName))
        {
            gfx.DrawString(
                subscriber.CompanyName.Trim(),
                fontSmall,
                grayBrush,
                new XPoint(
                    margin,
                    y));

            y += 17;
        }
        else
        {
            y += 7;
        }

        // =====================================================
        // FIELD HELPER
        // =====================================================

        void DrawField(
            string label,
            string? value,
            double x,
            double yy,
            double fieldWidth)
        {
            gfx.DrawString(
                label.ToUpperInvariant(),
                fontLabel,
                grayBrush,
                new XPoint(
                    x,
                    yy));

            gfx.DrawString(
                SafeString(value),
                fontValue,
                blackBrush,
                new XRect(
                    x,
                    yy + 12,
                    fieldWidth,
                    17),
                XStringFormats.TopLeft);
        }

        double colWidth =
            contentWidth / 3;

        // =====================================================
        // CUSTOMER DETAILS
        // =====================================================

        DrawSectionHeader(
            gfx,
            "CUSTOMER DETAILS",
            margin,
            ref y,
            contentWidth,
            fontSection,
            navyBrush,
            orangeBrush,
            sectionBrush);

        DrawField(
            "Mobile",
            subscriber.Mobile,
            margin,
            y,
            colWidth - 12);

        DrawField(
            "Email",
            subscriber.Email,
            margin + colWidth,
            y,
            colWidth - 12);

        DrawField(
            "Subscriber Type",
            subscriber.SubscriberType,
            margin + colWidth * 2,
            y,
            colWidth - 12);

        y += 38;

        DrawField(
            "GST No.",
            subscriber.GstNo,
            margin,
            y,
            colWidth - 12);

        DrawField(
            "Service",
            subscriber.Service,
            margin + colWidth,
            y,
            colWidth - 12);

        DrawField(
            "Account Created",
            FormatDate(subscriber.CreatedAt),
            margin + colWidth * 2,
            y,
            colWidth - 12);

        y += 39;

        // =====================================================
        // ADDRESS
        // =====================================================

        DrawSectionHeader(
            gfx,
            "BILLING & INSTALLATION ADDRESS",
            margin,
            ref y,
            contentWidth,
            fontSection,
            navyBrush,
            orangeBrush,
            sectionBrush);

        // Address label
        gfx.DrawString(
            "ADDRESS",
            fontLabel,
            grayBrush,
            new XPoint(
                margin,
                y));

        y += 12;

        // Address in its own box
        var address =
            BuildAddress(subscriber);

        double addressHeight = 34;

        gfx.DrawRectangle(
            whiteBrush,
            margin,
            y,
            contentWidth,
            addressHeight);

        gfx.DrawRectangle(
            borderPen,
            margin,
            y,
            contentWidth,
            addressHeight);

        // Sirf text draw kar rahe hain yaha pe bina 'y' overwrite kiye.
        DrawWrappedText(
            gfx,
            address,
            fontNormal,
            blackBrush,
            margin + 9,
            y + 5,
            contentWidth - 18,
            12,
            2);

        // Gap ko theek kar diya gaya hai (addressHeight ke niche 15 extra space)
        y += addressHeight + 15;

        // Separate city/state/pin columns
        DrawField(
            "City",
            subscriber.City,
            margin,
            y,
            colWidth - 12);

        DrawField(
            "State",
            subscriber.State,
            margin + colWidth,
            y,
            colWidth - 12);

        DrawField(
            "PIN Code",
            subscriber.Zip,
            margin + colWidth * 2,
            y,
            colWidth - 12);

        y += 39;

        // =====================================================
        // PACKAGE
        // =====================================================

        DrawSectionHeader(
            gfx,
            "PLAN / PACKAGE DETAILS",
            margin,
            ref y,
            contentWidth,
            fontSection,
            navyBrush,
            orangeBrush,
            sectionBrush);

        if (package != null)
        {
            DrawField(
                "Package",
                package.PackageName,
                margin,
                y,
                colWidth - 12);

            DrawField(
                "Category",
                package.PlanCategory,
                margin + colWidth,
                y,
                colWidth - 12);

            DrawField(
                "Price",
                FormatPrice(package.Price),
                margin + colWidth * 2,
                y,
                colWidth - 12);

            y += 38;

            DrawField(
                "Download",
                FormatSpeed(
                    package.DownloadMbps,
                    package.DownloadUnit),
                margin,
                y,
                colWidth - 12);

            DrawField(
                "Upload",
                FormatSpeed(
                    package.UploadMbps,
                    package.UploadUnit),
                margin + colWidth,
                y,
                colWidth - 12);

            DrawField(
                "Validity",
                FormatValidity(
                    package.ExpiryDays,
                    package.ValidityType),
                margin + colWidth * 2,
                y,
                colWidth - 12);

            y += 38;

            DrawField(
                "Valid Until",
                FormatDate(subscriber.ExpireDate),
                margin,
                y,
                colWidth - 12);

            y += 32;

            if (!string.IsNullOrWhiteSpace(
                package.Description))
            {
                gfx.DrawString(
                    "DESCRIPTION",
                    fontLabel,
                    grayBrush,
                    new XPoint(
                        margin,
                        y));

                y += 11;

                y = DrawWrappedText(
                    gfx,
                    package.Description.Trim(),
                    fontNormal,
                    blackBrush,
                    margin,
                    y,
                    contentWidth,
                    12,
                    2);

                y += 7;
            }
        }
        else
        {
            gfx.DrawString(
                "No package is assigned to this subscriber.",
                fontNormal,
                grayBrush,
                new XPoint(
                    margin,
                    y));

            y += 28;
        }

        // =====================================================
        // CONNECTION DETAILS
        // =====================================================

        DrawSectionHeader(
            gfx,
            "CONNECTION DETAILS",
            margin,
            ref y,
            contentWidth,
            fontSection,
            navyBrush,
            orangeBrush,
            sectionBrush);

        DrawField(
            "PPPoE Username",
            subscriber.PPPoEUsername,
            margin,
            y,
            colWidth - 12);

        DrawField(
            "MAC Address",
            subscriber.MacAddress,
            margin + colWidth,
            y,
            colWidth - 12);

        DrawField(
            "Static IP",
            subscriber.StaticIp,
            margin + colWidth * 2,
            y,
            colWidth - 12);

        y += 38;

        DrawField(
            "Connection Status",
            subscriber.ConnectionEnabled
                ? "Enabled"
                : "Disabled",
            margin,
            y,
            colWidth - 12);

        DrawField(
            "Subscriber Status",
            subscriber.IsActive
                ? "Active"
                : "Inactive",
            margin + colWidth,
            y,
            colWidth - 12);

        DrawField(
            "Expiry Date",
            FormatDate(subscriber.ExpireDate),
            margin + colWidth * 2,
            y,
            colWidth - 12);

        y += 39;

        // =====================================================
        // DOCUMENTS
        // =====================================================

        DrawSectionHeader(
            gfx,
            "DOCUMENTS",
            margin,
            ref y,
            contentWidth,
            fontSection,
            navyBrush,
            orangeBrush,
            sectionBrush);

        var uploadedDocs = documents
            .Where(x =>
                !string.IsNullOrWhiteSpace(
                    x.DocumentType))
            .Select(x =>
                GetDocumentDisplayName(
                    x.DocumentType))
            .Distinct()
            .ToList();

        string docText =
            uploadedDocs.Count == 0
                ? "No documents uploaded."
                : string.Join(
                    "   |   ",
                    uploadedDocs);

        gfx.DrawString(
            docText,
            fontNormal,
            blackBrush,
            new XRect(
                margin,
                y,
                contentWidth,
                22),
            XStringFormats.TopLeft);

        y += 40; // Gap increased from 29 to 40 

        // =====================================================
        // DECLARATION
        // =====================================================

        DrawSectionHeader(
            gfx,
            "CUSTOMER DECLARATION",
            margin,
            ref y,
            contentWidth,
            fontSection,
            navyBrush,
            orangeBrush,
            sectionBrush);

        var declaration =
            "I confirm that the information provided in this Customer Application Form is true and correct to the best of my knowledge. I agree to the applicable service terms and conditions.";

        // Text start hone se pehle thoda gap (y + 5) aur line height (13) set kiya
        y = DrawWrappedText(
            gfx,
            declaration,
            fontSmall,
            grayBrush,
            margin,
            y + 5,
            contentWidth,
            13,
            3);

        y += 45; // Text aur Signature ke beech ka proper gap

        // =====================================================
        // SIGNATURES
        // =====================================================

        // YAHAN CHANGE HAI: Math.Min ki jagah Math.Max use hoga
        // Taki line hamesha text ke niche (y) rahe, kabhi uske upar overlap na ho.
        double signatureY = Math.Max(y, height - 92);

        // Customer signature
        gfx.DrawLine(
            XPens.Gray,
            margin,
            signatureY,
            margin + 155,
            signatureY);

        gfx.DrawString(
            "Customer Signature",
            fontSmall,
            grayBrush,
            new XPoint(
                margin,
                signatureY + 15));

        // Authorized signature
        gfx.DrawLine(
            XPens.Gray,
            width - margin - 155,
            signatureY,
            width - margin,
            signatureY);

        gfx.DrawString(
            "Authorized Signature",
            fontSmall,
            grayBrush,
            new XPoint(
                width - margin - 155,
                signatureY + 15));

        // =====================================================
        // FOOTER
        // =====================================================

        const double footerHeight = 38;

        double footerY =
            height - footerHeight;

        // Same color assigned by user #f16f2b
        var footerBackgroundBrush = new XSolidBrush(XColor.FromArgb(241, 111, 43));

        gfx.DrawRectangle(
            footerBackgroundBrush,
            0,
            footerY,
            width,
            footerHeight);

        // Footer company
        var footerCompany =
            !string.IsNullOrWhiteSpace(
                subscriber.CompanyName)
                ? subscriber.CompanyName.Trim()
                : "Fab Five Network Private Limited";

        gfx.DrawString(
            footerCompany,
            fontSmallBold,
            whiteBrush,
            new XPoint(
                margin,
                footerY + 23));

        // Footer CAF number
        gfx.DrawString(
            $"CAF-{cafNumber}",
            fontSmall,
            whiteBrush,
            new XRect(
                width - margin - 150,
                footerY + 10,
                150,
                15),
            XStringFormats.TopRight);

        // =====================================================
        // SAVE
        // =====================================================

        using var stream =
            new MemoryStream();

        pdf.Save(
            stream,
            false);

        return stream.ToArray();
    }

    // =========================================================
    // SECTION HEADER
    // =========================================================
    private static void DrawSectionHeader(
        XGraphics gfx,
        string title,
        double margin,
        ref double y,
        double width,
        XFont font,
        XBrush navyBrush,
        XBrush orangeBrush,
        XBrush backgroundBrush)
    {
        double headerHeight = 22;

        gfx.DrawRectangle(
            backgroundBrush,
            margin,
            y - 3,
            width,
            headerHeight);

        gfx.DrawRectangle(
            orangeBrush,
            margin,
            y - 3,
            4,
            headerHeight);

        gfx.DrawString(
            title,
            font,
            navyBrush,
            new XPoint(
                margin + 13,
                y + 11));

        y += 31;
    }

    // =========================================================
    // WRAPPED TEXT
    // =========================================================
    private static double DrawWrappedText(
        XGraphics gfx,
        string text,
        XFont font,
        XBrush brush,
        double x,
        double y,
        double maxWidth,
        double lineHeight,
        int maxLines)
    {
        text = SafeString(text);

        var words =
            text.Split(
                ' ',
                StringSplitOptions.RemoveEmptyEntries);

        var lines =
            new List<string>();

        var current = string.Empty;

        foreach (var word in words)
        {
            var candidate =
                string.IsNullOrWhiteSpace(current)
                    ? word
                    : current + " " + word;

            var size =
                gfx.MeasureString(
                    candidate,
                    font);

            if (size.Width <= maxWidth)
            {
                current = candidate;
            }
            else
            {
                if (!string.IsNullOrWhiteSpace(
                    current))
                {
                    lines.Add(current);
                }

                current = word;
            }

            if (lines.Count >= maxLines)
            {
                break;
            }
        }

        if (lines.Count < maxLines &&
            !string.IsNullOrWhiteSpace(current))
        {
            lines.Add(current);
        }

        if (lines.Count > maxLines)
        {
            lines =
                lines.Take(maxLines).ToList();
        }

        for (int i = 0; i < lines.Count; i++)
        {
            gfx.DrawString(
                lines[i],
                font,
                brush,
                new XPoint(
                    x,
                    y + lineHeight));

            y += lineHeight;
        }

        return y;
    }

    // =========================================================
    // APPEND DOCUMENTS
    // =========================================================
    private byte[] AppendDocumentsToPdf(
        byte[] cafPdf,
        List<CAFDocument> documents)
    {
        if (documents == null ||
            documents.Count == 0)
        {
            return cafPdf;
        }

        using var inputStream =
            new MemoryStream(cafPdf);

        using var source =
            PdfReader.Open(
                inputStream,
                PdfDocumentOpenMode.Import);

        using var result =
            new PdfDocument();

        for (int i = 0;
             i < source.PageCount;
             i++)
        {
            result.AddPage(
                source.Pages[i]);
        }

        foreach (var document in documents)
        {
            try
            {
                var physicalPath =
                    GetPhysicalPath(
                        document.RelativePath);

                if (!System.IO.File.Exists(
                    physicalPath))
                {
                    continue;
                }

                var extension =
                    Path.GetExtension(
                        physicalPath)
                        .ToLowerInvariant();

                if (extension == ".pdf")
                {
                    AppendPdfFile(
                        result,
                        physicalPath);
                }
                else if (
                    extension == ".jpg" ||
                    extension == ".jpeg" ||
                    extension == ".png")
                {
                    AppendImageFile(
                        result,
                        physicalPath);
                }
            }
            catch
            {
                // Ignore invalid document
            }
        }

        using var output =
            new MemoryStream();

        result.Save(
            output,
            false);

        return output.ToArray();
    }

    // =========================================================
    // APPEND PDF
    // =========================================================
    private static void AppendPdfFile(
        PdfDocument target,
        string pdfPath)
    {
        using var pdf =
            PdfReader.Open(
                pdfPath,
                PdfDocumentOpenMode.Import);

        for (int i = 0;
             i < pdf.PageCount;
             i++)
        {
            target.AddPage(
                pdf.Pages[i]);
        }
    }

    // =========================================================
    // APPEND IMAGE
    // =========================================================
    private static void AppendImageFile(
        PdfDocument target,
        string imagePath)
    {
        var page =
            target.AddPage();

        page.Size =
            PdfSharp.PageSize.A4;

        using var gfx =
            XGraphics.FromPdfPage(page);

        using var image =
            XImage.FromFile(imagePath);

        double margin = 30;

        double availW =
            page.Width - margin * 2;

        double availH =
            page.Height - margin * 2;

        double ratio =
            Math.Min(
                availW / image.PixelWidth,
                availH / image.PixelHeight);

        double w =
            image.PixelWidth * ratio;

        double h =
            image.PixelHeight * ratio;

        gfx.DrawImage(
            image,
            (page.Width - w) / 2,
            (page.Height - h) / 2,
            w,
            h);
    }

    // =========================================================
    // AUTHORIZED SUBSCRIBER
    // =========================================================
    private async Task<Subscriber?>
        GetAuthorizedSubscriberAsync(
            Guid subscriberId)
    {
        var isSuperAdmin =
            string.Equals(
                User.FindFirst(
                    "IsSuperAdmin")?.Value,
                "True",
                StringComparison.OrdinalIgnoreCase);

        var userIdStr =
            User.FindFirst(
                ClaimTypes.NameIdentifier)?.Value ??
            User.FindFirst("sub")?.Value;

        var subscriber =
            await _context.Subscribers
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Id == subscriberId);

        if (subscriber == null)
        {
            return null;
        }

        if (isSuperAdmin)
        {
            return subscriber;
        }

        if (!Guid.TryParse(
            userIdStr,
            out var currentUserId))
        {
            return null;
        }

        var allowed =
            await _context.Sites
                .AsNoTracking()
                .AnyAsync(site =>
                    site.Id == subscriber.SiteId &&
                    site.UserId == currentUserId &&
                    !site.IsDeleted);

        return allowed
            ? subscriber
            : null;
    }

    // =========================================================
    // CAF NUMBER
    // =========================================================
    private async Task<long>
        GetNextCafNumberAsync()
    {
        var connection =
            _context.Database.GetDbConnection();

        await using var command =
            connection.CreateCommand();

        command.CommandText =
            "SELECT nextval('public.caf_number_seq');";

        if (connection.State !=
            ConnectionState.Open)
        {
            await connection.OpenAsync();
        }

        var result =
            await command.ExecuteScalarAsync();

        return result == null
            ? 1000000001
            : Convert.ToInt64(result);
    }

    // =========================================================
    // PHYSICAL PATH
    // =========================================================
    private string GetPhysicalPath(
        string relativePath)
    {
        var webRoot =
            Path.Combine(
                Directory.GetCurrentDirectory(),
                "wwwroot");

        var cleanPath =
            (relativePath ?? string.Empty)
            .TrimStart('/')
            .Replace(
                '/',
                Path.DirectorySeparatorChar);

        return Path.Combine(
            webRoot,
            cleanPath);
    }

    // =========================================================
    // ADDRESS
    // =========================================================
    private static string BuildAddress(
        Subscriber subscriber)
    {
        return string.Join(
            ", ",
            new[]
            {
                subscriber.Address,
                subscriber.City,
                subscriber.State,
                subscriber.Zip
            }
            .Where(x =>
                !string.IsNullOrWhiteSpace(x))
            .Select(x => x!.Trim()));
    }

    // =========================================================
    // FORMAT HELPERS
    // =========================================================
    private static string FormatSpeed(
        decimal speed,
        string? unit)
    {
        return $"{speed:0.##} {unit?.Trim()}"
            .Trim();
    }

    private static string FormatValidity(
        int days,
        string? validityType)
    {
        return $"{days} {validityType?.Trim() ?? "Days"}";
    }

    private static string FormatPrice(
        decimal price)
    {
        return $"₹ {price:N2}";
    }

    private static string GetDocumentDisplayName(
        string type)
    {
        return type switch
        {
            "Aadhaar" =>
                "Aadhaar Card",

            "PAN" =>
                "PAN Card",

            "DrivingLicence" =>
                "Driving Licence",

            "Agreement" =>
                "Agreement",

            _ =>
                type
        };
    }

    private static string FormatDate(
        DateTime? val)
    {
        return val.HasValue
            ? val.Value
                .ToLocalTime()
                .ToString("dd MMM yyyy")
            : "-";
    }

    private static string FormatDate(
        DateTime val)
    {
        return val
            .ToLocalTime()
            .ToString("dd MMM yyyy");
    }

    private static string SafeString(
        string? val)
    {
        return string.IsNullOrWhiteSpace(val)
            ? "-"
            : val.Trim();
    }

    private static string GetContentType(
        string ext)
    {
        return ext
            .ToLowerInvariant() switch
        {
            ".pdf" =>
                "application/pdf",

            ".jpg" or ".jpeg" =>
                "image/jpeg",

            ".png" =>
                "image/png",

            _ =>
                "application/octet-stream"
        };
    }

    // =========================================================
    // CAF HISTORY
    // =========================================================
    [HttpGet("history/{subscriberId:guid}")]
    public async Task<IActionResult>
        GetCAFHistory(Guid subscriberId)
    {
        var subscriber =
            await GetAuthorizedSubscriberAsync(
                subscriberId);

        if (subscriber == null)
        {
            return NotFound(new
            {
                message =
                    "Subscriber not found or access denied."
            });
        }

        var history =
            await _context.CustomerApplicationForms
                .AsNoTracking()
                .Where(x =>
                    x.SubscriberId ==
                    subscriberId)
                .OrderByDescending(
                    x => x.GeneratedAt)
                .Select(x => new
                {
                    x.Id,
                    x.CafNumber,
                    x.GeneratedAt,
                    x.PdfPath
                })
                .ToListAsync();

        return Ok(history);
    }
}