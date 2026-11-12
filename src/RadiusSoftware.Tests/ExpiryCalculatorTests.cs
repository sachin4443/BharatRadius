using RadiusSoftware.API.Services.Billing;
using RadiusSoftware.API.Services.Query;
using RadiusSoftware.Core.Entities;
using Xunit;

namespace RadiusSoftware.Tests;

/// <summary>Expiry / recharge date rules (all dates in India time).</summary>
public class ExpiryCalculatorTests
{
    private static DateTime Ist(int y, int m, int d, int h = 0, int min = 0, int s = 0) =>
        IstClock.ToUtc(new DateTime(y, m, d, h, min, s));

    private static DateTime ToIst(DateTime utc) => IstClock.ToIst(utc);

    private static PackageProfile Pkg(int units, string type) => new() { ExpiryDays = units, ValidityType = type };

    [Fact]
    public void Active_subscriber_extends_from_current_expiry()
    {
        var expiry = Ist(2026, 12, 20, 23, 59, 59);
        var now = Ist(2026, 11, 12, 10, 0);

        var start = ExpiryCalculator.RechargeStart(expiry, now);
        var end = ExpiryCalculator.AddValidity(start, Pkg(30, "Days"));

        Assert.Equal(expiry, start);
        Assert.Equal(new DateTime(2027, 1, 19, 23, 59, 59), ToIst(end));
    }

    [Fact]
    public void Expired_subscriber_starts_from_recharge_time()
    {
        var expiry = Ist(2026, 10, 1, 23, 59, 59);
        var now = Ist(2026, 11, 12, 14, 30);

        var start = ExpiryCalculator.RechargeStart(expiry, now);
        var end = ExpiryCalculator.AddValidity(start, Pkg(30, "Days"));

        Assert.Equal(now, start);
        Assert.Equal(new DateTime(2026, 12, 12, 14, 30, 0), ToIst(end));
    }

    [Fact]
    public void Start_now_option_ignores_running_validity()
    {
        var expiry = Ist(2026, 12, 20);
        var now = Ist(2026, 11, 12, 9, 0);
        Assert.Equal(now, ExpiryCalculator.RechargeStart(expiry, now, "now"));
    }

    [Fact]
    public void No_expiry_starts_now()
    {
        var now = Ist(2026, 11, 12, 9, 0);
        Assert.Equal(now, ExpiryCalculator.RechargeStart(null, now));
    }

    [Theory]
    [InlineData(1, "Months", 2026, 12, 12)]   // monthly
    [InlineData(3, "Months", 2027, 2, 12)]    // quarterly
    [InlineData(6, "Months", 2027, 5, 12)]    // half-yearly
    [InlineData(12, "Months", 2027, 11, 12)]  // yearly (12 months)
    [InlineData(1, "Years", 2027, 11, 12)]    // yearly
    [InlineData(30, "Days", 2026, 12, 12)]
    [InlineData(2, "Weeks", 2026, 11, 26)]
    public void Plan_durations(int units, string type, int y, int m, int d)
    {
        var start = Ist(2026, 11, 12, 14, 30);
        var end = ExpiryCalculator.AddValidity(start, Pkg(units, type));
        Assert.Equal(new DateTime(y, m, d, 14, 30, 0), ToIst(end));
    }

    [Fact]
    public void Quantity_multiplies_the_period()
    {
        var start = Ist(2026, 11, 12, 14, 30);
        var end = ExpiryCalculator.AddValidity(start, Pkg(1, "Months"), quantity: 3);
        Assert.Equal(new DateTime(2027, 2, 12, 14, 30, 0), ToIst(end));
    }

    [Fact]
    public void Month_end_is_clamped_to_shorter_month()
    {
        var start = Ist(2027, 1, 31, 23, 59, 59);
        Assert.Equal(new DateTime(2027, 2, 28, 23, 59, 59), ToIst(ExpiryCalculator.AddValidity(start, Pkg(1, "Months"))));
    }

    [Fact]
    public void Leap_year_february()
    {
        var start = Ist(2028, 1, 31, 12, 0);
        Assert.Equal(new DateTime(2028, 2, 29, 12, 0, 0), ToIst(ExpiryCalculator.AddValidity(start, Pkg(1, "Months"))));

        var leapDay = Ist(2028, 2, 29, 12, 0);
        Assert.Equal(new DateTime(2029, 2, 28, 12, 0, 0), ToIst(ExpiryCalculator.AddValidity(leapDay, Pkg(1, "Years"))));
    }

    [Fact]
    public void Early_morning_IST_uses_the_india_date_not_utc_date()
    {
        // 31 Jan 02:00 IST is still 30 Jan in UTC. One month later must be 28 Feb (IST), not 30 Jan + 1 month in UTC.
        var start = Ist(2027, 1, 31, 2, 0);
        Assert.Equal(new DateTime(2027, 2, 28, 2, 0, 0), ToIst(ExpiryCalculator.AddValidity(start, Pkg(1, "Months"))));
    }

    [Fact]
    public void Typed_date_means_end_of_that_day_in_india()
    {
        var typed = new DateTime(2026, 12, 20); // Kind = Unspecified, from a date input
        var utc = ExpiryCalculator.FromUserInput(typed);
        Assert.Equal(DateTimeKind.Utc, utc.Kind);
        Assert.Equal(new DateTime(2026, 12, 20, 23, 59, 59), ToIst(utc));
    }

    [Fact]
    public void Utc_input_is_kept()
    {
        var utc = new DateTime(2026, 12, 20, 10, 0, 0, DateTimeKind.Utc);
        Assert.Equal(utc, ExpiryCalculator.FromUserInput(utc));
    }

    [Fact]
    public void Same_ist_day_check()
    {
        Assert.True(ExpiryCalculator.SameIstDay(Ist(2026, 12, 20, 0, 30), Ist(2026, 12, 20, 23, 59)));
        Assert.False(ExpiryCalculator.SameIstDay(Ist(2026, 12, 20, 23, 59), Ist(2026, 12, 21, 0, 1)));
    }
}
