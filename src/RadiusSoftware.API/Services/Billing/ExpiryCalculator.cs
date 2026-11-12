using RadiusSoftware.API.Services.Query;
using RadiusSoftware.Core.Entities;

namespace RadiusSoftware.API.Services.Billing;

/// <summary>
/// The ONE place where subscriber validity / expiry dates are calculated.
/// Used by recharge, package change, subscriber create/edit and import, so every
/// screen shows the same date.
///
/// Rules
///  - Dates are calculated in India time (IST) and stored in UTC.
///  - Months / years use the calendar (31 Jan + 1 month = 28/29 Feb, leap years OK).
///    Days add exact days (20 Dec + 30 days = 19 Jan).
///  - Recharge of an ACTIVE subscriber (expiry in the future) starts at the current
///    expiry, so no paid days are lost. An EXPIRED subscriber starts from now.
///  - A date typed by an operator without a time means "valid till the end of that
///    day" (23:59:59 IST).
/// </summary>
public static class ExpiryCalculator
{
    public const int MaxQuantity = 36;

    /// <summary>Package validity in a readable form, e.g. "3 Months".</summary>
    public static string Describe(PackageProfile package) =>
        $"{Math.Max(1, package.ExpiryDays)} {(string.IsNullOrWhiteSpace(package.ValidityType) ? "Days" : package.ValidityType)}";

    /// <summary>End of <paramref name="quantity"/> package periods starting at <paramref name="startUtc"/>.</summary>
    public static DateTime AddValidity(DateTime startUtc, PackageProfile package, int quantity = 1)
    {
        var units = Math.Max(1, package.ExpiryDays) * Math.Clamp(quantity, 1, MaxQuantity);
        var type = (package.ValidityType ?? "Days").Trim().ToLowerInvariant();

        // Work on the India calendar date so month ends / leap years match what users see
        var ist = IstClock.ToIst(DateTime.SpecifyKind(startUtc, DateTimeKind.Utc));
        DateTime endIst =
            type.Contains("year") ? ist.AddYears(units) :
            type.Contains("month") ? ist.AddMonths(units) :
            type.Contains("week") ? ist.AddDays(units * 7) :
            type.Contains("hour") ? ist.AddHours(units) :
            ist.AddDays(units);

        return IstClock.ToUtc(endIst);
    }

    /// <summary>
    /// Where a new recharge period begins.
    ///   "auto" (default): current expiry if still active, else now
    ///   "now"           : now (e.g. operator wants to restart the plan today)
    /// </summary>
    public static DateTime RechargeStart(DateTime? currentExpiryUtc, DateTime nowUtc, string? startFrom = null)
    {
        var active = currentExpiryUtc.HasValue && currentExpiryUtc.Value > nowUtc;
        if (string.Equals(startFrom, "now", StringComparison.OrdinalIgnoreCase)) return nowUtc;
        return active ? DateTime.SpecifyKind(currentExpiryUtc!.Value, DateTimeKind.Utc) : nowUtc;
    }

    /// <summary>
    /// Expiry typed in a form / Excel. A pure date (no time) becomes 23:59:59 IST of
    /// that day; a value with a time is read as IST; a UTC value is kept.
    /// </summary>
    public static DateTime FromUserInput(DateTime value)
    {
        if (value.Kind == DateTimeKind.Utc) return value;
        var local = value.TimeOfDay == TimeSpan.Zero ? value.Date.AddDays(1).AddSeconds(-1) : value;
        return IstClock.ToUtc(local);
    }

    /// <summary>True when two UTC instants fall on the same India calendar day.</summary>
    public static bool SameIstDay(DateTime aUtc, DateTime bUtc) =>
        IstClock.ToIst(aUtc).Date == IstClock.ToIst(bUtc).Date;
}
