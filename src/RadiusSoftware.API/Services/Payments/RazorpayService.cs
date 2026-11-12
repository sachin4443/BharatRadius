using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RadiusSoftware.Core.Entities;
using RadiusSoftware.Infrastructure.Data;

namespace RadiusSoftware.API.Services.Payments;

public record RazorpayOrder(string Id, long AmountPaise, string Currency, string Status);
public record RazorpayPayment(string Id, string OrderId, long AmountPaise, string Currency, string Status, string? Method);

public class PaymentGatewayException : Exception
{
    public PaymentGatewayException(string message) : base(message) { }
}

/// <summary>
/// Razorpay REST API (orders, payments, capture) and signature checks.
/// Keys come from the PaymentGatewayConfig that the L1 admin saved, so the money
/// goes to that Razorpay account.
/// </summary>
public interface IRazorpayService
{
    /// <summary>Site's own Razorpay config, else nearest parent site's, else the organization default.</summary>
    Task<PaymentGatewayConfig?> ResolveConfigAsync(Guid siteId);
    Task<RazorpayOrder> CreateOrderAsync(PaymentGatewayConfig cfg, long amountPaise, string receipt, IDictionary<string, string> notes);
    Task<RazorpayPayment> GetPaymentAsync(PaymentGatewayConfig cfg, string paymentId);
    Task<RazorpayPayment> CapturePaymentAsync(PaymentGatewayConfig cfg, string paymentId, long amountPaise, string currency);
    Task<IReadOnlyList<RazorpayPayment>> GetOrderPaymentsAsync(PaymentGatewayConfig cfg, string orderId);
    Task<bool> TestKeysAsync(PaymentGatewayConfig cfg);
    bool VerifyCheckoutSignature(PaymentGatewayConfig cfg, string orderId, string paymentId, string signature);
    bool VerifyWebhookSignature(string? webhookSecret, string rawBody, string? signature);
}

public class RazorpayService : IRazorpayService
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpFactory;
    private readonly string _baseUrl;

    public RazorpayService(AppDbContext db, IHttpClientFactory httpFactory, IConfiguration configuration)
    {
        _db = db;
        _httpFactory = httpFactory;
        _baseUrl = (configuration["Razorpay:ApiBaseUrl"] ?? "https://api.razorpay.com").TrimEnd('/');
    }

    public async Task<PaymentGatewayConfig?> ResolveConfigAsync(Guid siteId)
    {
        var visited = new HashSet<Guid>();
        Guid? current = siteId;
        Guid orgId = Guid.Empty;

        while (current.HasValue && visited.Add(current.Value))
        {
            var site = await _db.Sites.AsNoTracking()
                .Where(s => s.Id == current.Value)
                .Select(s => new { s.Id, s.ParentSiteId, s.ParentOrganisationID })
                .FirstOrDefaultAsync();
            if (site == null) break;
            orgId = site.ParentOrganisationID;

            var own = await _db.PaymentGatewayConfigs.AsNoTracking()
                .Where(c => c.SiteId == site.Id && c.IsActive && c.Provider == "Razorpay")
                .OrderByDescending(c => c.IsDefault).ThenByDescending(c => c.UpdatedAt)
                .FirstOrDefaultAsync();
            if (own != null) return own;

            current = site.ParentSiteId;
        }

        if (orgId == Guid.Empty) return null;

        return await _db.PaymentGatewayConfigs.AsNoTracking()
            .Where(c => c.OrganizationId == orgId && c.SiteId == null && c.IsActive && c.Provider == "Razorpay")
            .OrderByDescending(c => c.IsDefault).ThenByDescending(c => c.UpdatedAt)
            .FirstOrDefaultAsync();
    }

    private HttpClient Client(PaymentGatewayConfig cfg)
    {
        if (string.IsNullOrWhiteSpace(cfg.ApiKey) || string.IsNullOrWhiteSpace(cfg.ApiSecret))
            throw new PaymentGatewayException("Razorpay Key ID / Secret is not configured. Please contact your admin.");

        var client = _httpFactory.CreateClient("razorpay");
        client.BaseAddress = new Uri(_baseUrl + "/");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{cfg.ApiKey}:{cfg.ApiSecret}")));
        return client;
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            string message = $"Payment gateway error (HTTP {(int)response.StatusCode}).";
            try
            {
                using var err = JsonDocument.Parse(text);
                if (err.RootElement.TryGetProperty("error", out var e) && e.TryGetProperty("description", out var d))
                    message = "Payment gateway: " + d.GetString();
            }
            catch { /* keep generic message */ }
            throw new PaymentGatewayException(message);
        }
        using var doc = JsonDocument.Parse(text);
        return doc.RootElement.Clone();
    }

    private static RazorpayPayment ToPayment(JsonElement p) => new(
        p.GetProperty("id").GetString() ?? "",
        p.TryGetProperty("order_id", out var o) && o.ValueKind == JsonValueKind.String ? o.GetString()! : "",
        p.GetProperty("amount").GetInt64(),
        p.TryGetProperty("currency", out var c) ? c.GetString() ?? "INR" : "INR",
        p.TryGetProperty("status", out var s) ? s.GetString() ?? "" : "",
        p.TryGetProperty("method", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null);

    public async Task<RazorpayOrder> CreateOrderAsync(PaymentGatewayConfig cfg, long amountPaise, string receipt, IDictionary<string, string> notes)
    {
        var body = JsonSerializer.Serialize(new
        {
            amount = amountPaise,
            currency = "INR",
            receipt,
            payment_capture = 1,
            notes
        });
        var response = await Client(cfg).PostAsync("v1/orders", new StringContent(body, Encoding.UTF8, "application/json"));
        var json = await ReadAsync(response);
        return new RazorpayOrder(
            json.GetProperty("id").GetString() ?? "",
            json.GetProperty("amount").GetInt64(),
            json.TryGetProperty("currency", out var c) ? c.GetString() ?? "INR" : "INR",
            json.TryGetProperty("status", out var s) ? s.GetString() ?? "" : "");
    }

    public async Task<RazorpayPayment> GetPaymentAsync(PaymentGatewayConfig cfg, string paymentId)
    {
        var response = await Client(cfg).GetAsync($"v1/payments/{Uri.EscapeDataString(paymentId)}");
        return ToPayment(await ReadAsync(response));
    }

    public async Task<RazorpayPayment> CapturePaymentAsync(PaymentGatewayConfig cfg, string paymentId, long amountPaise, string currency)
    {
        var body = JsonSerializer.Serialize(new { amount = amountPaise, currency });
        var response = await Client(cfg).PostAsync($"v1/payments/{Uri.EscapeDataString(paymentId)}/capture",
            new StringContent(body, Encoding.UTF8, "application/json"));
        return ToPayment(await ReadAsync(response));
    }

    public async Task<IReadOnlyList<RazorpayPayment>> GetOrderPaymentsAsync(PaymentGatewayConfig cfg, string orderId)
    {
        var response = await Client(cfg).GetAsync($"v1/orders/{Uri.EscapeDataString(orderId)}/payments");
        var json = await ReadAsync(response);
        if (!json.TryGetProperty("items", out var items)) return Array.Empty<RazorpayPayment>();
        return items.EnumerateArray().Select(ToPayment).ToList();
    }

    public async Task<bool> TestKeysAsync(PaymentGatewayConfig cfg)
    {
        var response = await Client(cfg).GetAsync("v1/orders?count=1");
        await ReadAsync(response);
        return true;
    }

    private static string HmacHex(string secret, string data)
    {
        using var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(h.ComputeHash(Encoding.UTF8.GetBytes(data))).ToLowerInvariant();
    }

    private static bool SameHex(string a, string b) =>
        a.Length == b.Length &&
        CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(a), Encoding.ASCII.GetBytes(b.ToLowerInvariant()));

    public bool VerifyCheckoutSignature(PaymentGatewayConfig cfg, string orderId, string paymentId, string signature)
    {
        if (string.IsNullOrWhiteSpace(cfg.ApiSecret) || string.IsNullOrWhiteSpace(signature)) return false;
        return SameHex(HmacHex(cfg.ApiSecret, $"{orderId}|{paymentId}"), signature.Trim());
    }

    public bool VerifyWebhookSignature(string? webhookSecret, string rawBody, string? signature)
    {
        if (string.IsNullOrWhiteSpace(webhookSecret) || string.IsNullOrWhiteSpace(signature)) return false;
        return SameHex(HmacHex(webhookSecret, rawBody), signature.Trim());
    }
}
