using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.API.Security;
using RadiusSoftware.API.Services.Payments;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Controllers;

/// <summary>
/// Online "Add Money" to a site's own wallet (L2 / L3 ...) through Razorpay.
///
/// 1. create-order : server creates a Razorpay order for the amount (keys set by L1)
/// 2. browser opens Razorpay Checkout (UPI, debit/ATM card, credit card, net banking, wallets)
/// 3. verify       : server checks Razorpay's signature, makes sure the payment is
///                   captured and credits the wallet exactly once
/// 4. webhook / check-status credit the wallet if the browser was closed after paying
/// </summary>
[Authorize]
[Route("api/[controller]")]
[ApiController]
public class WalletTopupController : ControllerBase
{
    public const decimal MinAmount = 100m;
    public const decimal MaxAmount = 500000m;

    private readonly AppDbContext _db;
    private readonly ISiteAccessService _access;
    private readonly IRazorpayService _razorpay;
    private readonly ILogger<WalletTopupController> _logger;

    public WalletTopupController(AppDbContext db, ISiteAccessService access, IRazorpayService razorpay, ILogger<WalletTopupController> logger)
    {
        _db = db;
        _access = access;
        _razorpay = razorpay;
        _logger = logger;
    }

    // =========================================================
    // Is online top-up available for the logged-in site?
    // =========================================================
    [HttpGet("options")]
    public async Task<IActionResult> Options()
    {
        var site = await _access.GetOwnSiteAsync();
        if (site == null)
            return Ok(new { enabled = false, reason = "Online top-up is available for site accounts only." });

        var cfg = await _razorpay.ResolveConfigAsync(site.Id);
        var balance = await _db.SiteWallets.AsNoTracking()
            .Where(w => w.SiteId == site.Id).Select(w => (decimal?)w.Balance).FirstOrDefaultAsync() ?? 0;

        return Ok(new
        {
            enabled = cfg != null && !string.IsNullOrWhiteSpace(cfg.ApiKey),
            reason = cfg == null ? "Online payment is not set up yet. Please ask your admin to add Razorpay keys." : null,
            provider = cfg?.Provider,
            mode = cfg?.Mode,
            siteName = site.SiteName,
            balance,
            minAmount = MinAmount,
            maxAmount = MaxAmount
        });
    }

    public class CreateOrderRequest
    {
        public decimal Amount { get; set; }
    }

    // =========================================================
    // 1. CREATE ORDER
    // =========================================================
    [HttpPost("create-order")]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest request)
    {
        var site = await _access.GetOwnSiteAsync();
        if (site == null)
            return BadRequest(new { message = "Online top-up is available for site accounts only." });

        var amount = Math.Round(request?.Amount ?? 0, 2);
        if (amount < MinAmount || amount > MaxAmount)
            return BadRequest(new { message = $"Amount must be between ₹{MinAmount:0} and ₹{MaxAmount:0}." });

        var cfg = await _razorpay.ResolveConfigAsync(site.Id);
        if (cfg == null)
            return BadRequest(new { message = "Online payment is not set up yet. Please ask your admin to add Razorpay keys." });

        var userId = _access.CurrentUserId;
        var user = await _db.Users.AsNoTracking().Where(u => u.Id == userId)
            .Select(u => new { u.FullName, u.Email, u.Mobile }).FirstOrDefaultAsync();

        var topup = new WalletTopup
        {
            SiteId = site.Id,
            UserId = userId,
            Amount = amount,
            Provider = "Razorpay",
            PaymentGatewayConfigId = cfg.Id
        };

        RazorpayOrder order;
        try
        {
            order = await _razorpay.CreateOrderAsync(cfg, (long)(amount * 100),
                receipt: $"wt_{topup.Id:N}"[..30],
                notes: new Dictionary<string, string>
                {
                    ["topupId"] = topup.Id.ToString(),
                    ["siteId"] = site.Id.ToString(),
                    ["site"] = site.SiteName
                });
        }
        catch (PaymentGatewayException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Razorpay order could not be created for site {SiteId}", site.Id);
            return StatusCode(502, new { message = "Could not reach the payment gateway. Please try again." });
        }

        topup.ProviderOrderId = order.Id;
        _db.WalletTopups.Add(topup);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            topupId = topup.Id,
            orderId = order.Id,
            keyId = cfg.ApiKey,
            amount = order.AmountPaise,
            currency = order.Currency,
            mode = cfg.Mode,
            name = string.IsNullOrWhiteSpace(site.CompanyName) ? site.SiteName : site.CompanyName,
            description = $"Wallet top-up – {site.SiteName}",
            prefill = new { name = user?.FullName, email = user?.Email, contact = user?.Mobile }
        });
    }

    public class VerifyRequest
    {
        public string OrderId { get; set; } = string.Empty;
        public string PaymentId { get; set; } = string.Empty;
        public string Signature { get; set; } = string.Empty;
    }

    // =========================================================
    // 2. VERIFY (called by the browser after Razorpay success)
    // =========================================================
    [HttpPost("verify")]
    public async Task<IActionResult> Verify([FromBody] VerifyRequest request)
    {
        var site = await _access.GetOwnSiteAsync();
        if (site == null) return Forbid();

        var topup = await _db.WalletTopups.AsNoTracking()
            .FirstOrDefaultAsync(t => t.ProviderOrderId == request.OrderId && t.SiteId == site.Id);
        if (topup == null) return NotFound(new { message = "Payment not found." });
        if (topup.Status == "PAID") return Ok(await ResultAsync(topup.Id, "Amount already added to your wallet."));

        var cfg = await ConfigOfAsync(topup);
        if (cfg == null) return BadRequest(new { message = "Payment gateway is not configured any more." });

        if (!_razorpay.VerifyCheckoutSignature(cfg, request.OrderId, request.PaymentId, request.Signature))
        {
            _logger.LogWarning("Invalid Razorpay signature for order {OrderId}", request.OrderId);
            return BadRequest(new { message = "Payment could not be verified." });
        }

        return await ConfirmPaymentAsync(cfg, topup.Id, request.PaymentId);
    }

    // =========================================================
    // 3. CHECK STATUS (pending payment, e.g. browser closed)
    // =========================================================
    [HttpPost("{id:guid}/check")]
    public async Task<IActionResult> Check(Guid id)
    {
        var site = await _access.GetOwnSiteAsync();
        if (site == null) return Forbid();

        var topup = await _db.WalletTopups.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id && t.SiteId == site.Id);
        if (topup == null) return NotFound(new { message = "Payment not found." });
        if (topup.Status == "PAID") return Ok(await ResultAsync(topup.Id, "Amount already added to your wallet."));

        var cfg = await ConfigOfAsync(topup);
        if (cfg == null) return BadRequest(new { message = "Payment gateway is not configured any more." });

        IReadOnlyList<RazorpayPayment> payments;
        try
        {
            payments = await _razorpay.GetOrderPaymentsAsync(cfg, topup.ProviderOrderId);
        }
        catch (PaymentGatewayException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var paid = payments.FirstOrDefault(p => p.Status is "captured" or "authorized");
        if (paid == null)
        {
            var failed = payments.Any() && payments.All(p => p.Status == "failed");
            return Ok(new { success = false, status = failed ? "FAILED" : "PENDING", message = failed ? "Payment failed." : "Payment not received yet." });
        }

        return await ConfirmPaymentAsync(cfg, topup.Id, paid.Id);
    }

    // =========================================================
    // HISTORY of own site
    // =========================================================
    [HttpGet("history")]
    public async Task<IActionResult> History([FromQuery] int take = 20)
    {
        var site = await _access.GetOwnSiteAsync();
        if (site == null) return Ok(Array.Empty<object>());

        var rows = await _db.WalletTopups.AsNoTracking()
            .Where(t => t.SiteId == site.Id)
            .OrderByDescending(t => t.CreatedAt)
            .Take(Math.Clamp(take, 1, 100))
            .Select(t => new { t.Id, t.Amount, t.Status, t.PaymentMethod, t.ProviderOrderId, t.ProviderPaymentId, t.CreatedAt, t.PaidAt, t.FailureReason })
            .ToListAsync();
        return Ok(rows);
    }

    // =========================================================
    // 4. WEBHOOK (Razorpay → server). Set in Razorpay dashboard:
    //    URL   : https://<api>/api/WalletTopup/webhook/razorpay
    //    Secret: the "Salt / Webhook secret" saved in SMS & Payment Gateway
    //    Events: payment.captured, order.paid
    // =========================================================
    [AllowAnonymous]
    [HttpPost("webhook/razorpay")]
    public async Task<IActionResult> Webhook()
    {
        string raw;
        using (var reader = new StreamReader(Request.Body))
            raw = await reader.ReadToEndAsync();

        string? eventName, orderId, paymentId;
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            eventName = root.GetProperty("event").GetString();
            var payment = root.GetProperty("payload").GetProperty("payment").GetProperty("entity");
            orderId = payment.GetProperty("order_id").GetString();
            paymentId = payment.GetProperty("id").GetString();
        }
        catch
        {
            return BadRequest();
        }

        if (string.IsNullOrEmpty(orderId) || string.IsNullOrEmpty(paymentId)) return Ok();

        var topup = await _db.WalletTopups.AsNoTracking().FirstOrDefaultAsync(t => t.ProviderOrderId == orderId);
        if (topup == null) return Ok(); // not ours

        var cfg = await ConfigOfAsync(topup);
        if (cfg == null || !_razorpay.VerifyWebhookSignature(cfg.SaltOrWebhookSecret, raw, Request.Headers["X-Razorpay-Signature"]))
        {
            _logger.LogWarning("Rejected Razorpay webhook for order {OrderId}: bad signature", orderId);
            return BadRequest();
        }

        if (eventName is "payment.captured" or "order.paid" && topup.Status != "PAID")
        {
            await ConfirmPaymentAsync(cfg, topup.Id, paymentId);
        }
        else if (eventName == "payment.failed" && topup.Status == "CREATED")
        {
            var row = await _db.WalletTopups.FirstAsync(t => t.Id == topup.Id);
            row.FailureReason = "Payment failed at the gateway.";
            row.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return Ok();
    }

    // =========================================================
    // Helpers
    // =========================================================

    private async Task<PaymentGatewayConfig?> ConfigOfAsync(WalletTopup topup) =>
        topup.PaymentGatewayConfigId.HasValue
            ? await _db.PaymentGatewayConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.Id == topup.PaymentGatewayConfigId)
            : null;

    private async Task<object> ResultAsync(Guid topupId, string message)
    {
        var t = await _db.WalletTopups.AsNoTracking().FirstAsync(x => x.Id == topupId);
        var balance = await _db.SiteWallets.AsNoTracking()
            .Where(w => w.SiteId == t.SiteId).Select(w => (decimal?)w.Balance).FirstOrDefaultAsync() ?? 0;
        return new { success = t.Status == "PAID", status = t.Status, amount = t.Amount, paymentId = t.ProviderPaymentId, method = t.PaymentMethod, balance, message };
    }

    /// <summary>
    /// Makes sure the payment really belongs to this order, is captured and has the
    /// right amount, then credits the wallet exactly once.
    /// </summary>
    private async Task<IActionResult> ConfirmPaymentAsync(PaymentGatewayConfig cfg, Guid topupId, string paymentId)
    {
        var expected = await _db.WalletTopups.AsNoTracking().FirstAsync(t => t.Id == topupId);
        var expectedPaise = (long)(expected.Amount * 100);

        RazorpayPayment payment;
        try
        {
            payment = await _razorpay.GetPaymentAsync(cfg, paymentId);
            if (payment.OrderId != expected.ProviderOrderId)
                return BadRequest(new { message = "Payment does not belong to this order." });
            if (payment.AmountPaise != expectedPaise)
                return BadRequest(new { message = "Paid amount does not match." });
            if (payment.Status == "authorized")
                payment = await _razorpay.CapturePaymentAsync(cfg, paymentId, expectedPaise, payment.Currency);
            if (payment.Status != "captured")
                return Ok(new { success = false, status = "PENDING", message = $"Payment status is '{payment.Status}'. The wallet will be updated once it is completed." });
        }
        catch (PaymentGatewayException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        await using (var tx = await _db.Database.BeginTransactionAsync())
        {
            var topup = await _db.WalletTopups
                .FromSqlInterpolated($@"SELECT * FROM ""WalletTopups"" WHERE ""Id"" = {topupId} FOR UPDATE")
                .FirstAsync();

            if (topup.Status == "PAID")
            {
                await tx.RollbackAsync();
                return Ok(await ResultAsync(topupId, "Amount already added to your wallet."));
            }

            var siteId = topup.SiteId;
            var wallet = await _db.SiteWallets
                .FromSqlInterpolated($@"SELECT * FROM ""SiteWallets"" WHERE ""SiteId"" = {siteId} FOR UPDATE")
                .FirstOrDefaultAsync();
            if (wallet == null)
            {
                wallet = new SiteWallet { Id = Guid.NewGuid(), SiteId = siteId, Balance = 0, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
                _db.SiteWallets.Add(wallet);
            }

            var now = DateTime.UtcNow;
            var before = wallet.Balance;
            wallet.Balance += topup.Amount;
            wallet.UpdatedAt = now;

            var txn = new WalletTransaction
            {
                Id = Guid.NewGuid(),
                SiteId = siteId,
                TransactionType = "CREDIT",
                Amount = topup.Amount,
                BalanceBefore = before,
                BalanceAfter = wallet.Balance,
                Description = $"Online top-up via Razorpay ({payment.Method ?? "online"}) • {payment.Id}",
                CreatedAt = now
            };
            _db.WalletTransactions.Add(txn);

            topup.Status = "PAID";
            topup.ProviderPaymentId = payment.Id;
            topup.PaymentMethod = payment.Method;
            topup.PaidAt = now;
            topup.UpdatedAt = now;
            topup.FailureReason = null;
            topup.WalletTransactionId = txn.Id;

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }

        _logger.LogInformation("Wallet top-up {TopupId} credited ({PaymentId})", topupId, paymentId);
        return Ok(await ResultAsync(topupId, "Payment successful. Amount added to your wallet."));
    }
}
