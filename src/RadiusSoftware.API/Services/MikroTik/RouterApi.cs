using System.Collections.Concurrent;
using System.Globalization;
using System.Net.Sockets;
using RadiusSoftware.Core.Entities;
using tik4net;

namespace RadiusSoftware.API.Services.MikroTik;

public class RouterUnreachableException : Exception
{
    public RouterUnreachableException(string message) : base(message) { }
}

/// <summary>
/// Fast, safe access to the MikroTik API for live graphs / ping / interface lists.
///
///  - Checks the TCP port first with a short timeout, so an offline router fails
///    in ~2 seconds instead of blocking a request for 20-40 seconds.
///  - Remembers an unreachable router for 30 seconds (no repeated waiting).
///  - Max 2 parallel API sessions per router (graphs polling from several
///    browsers can no longer pile up hundreds of connections).
///  - Everything runs in C# (no python.exe per request, password not on a command line).
/// </summary>
public static class RouterApi
{
    private static readonly ConcurrentDictionary<string, DateTime> UnreachableUntil = new();
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Gates = new();

    public static async Task<T> RunAsync<T>(NasDevice nas, Func<ITikConnection, T> work, int timeoutMs = 4000)
    {
        var key = $"{nas.NasIpAddress}:{nas.ApiPort}";

        if (UnreachableUntil.TryGetValue(key, out var until) && until > DateTime.UtcNow)
            throw new RouterUnreachableException(
                $"Router {nas.NasName} ({nas.NasIpAddress}) is not reachable. Retrying in {(int)(until - DateTime.UtcNow).TotalSeconds + 1}s.");

        var gate = Gates.GetOrAdd(key, _ => new SemaphoreSlim(2, 2));
        if (!await gate.WaitAsync(TimeSpan.FromSeconds(6)))
            throw new RouterUnreachableException($"Router {nas.NasName} is busy. Please try again.");

        try
        {
            // 1. Quick TCP check of the API port
            using (var tcp = new TcpClient())
            {
                using var cts = new CancellationTokenSource(2000);
                try
                {
                    await tcp.ConnectAsync(nas.NasIpAddress, nas.ApiPort, cts.Token);
                }
                catch (Exception)
                {
                    UnreachableUntil[key] = DateTime.UtcNow.AddSeconds(30);
                    throw new RouterUnreachableException(
                        $"Router {nas.NasName} ({nas.NasIpAddress}:{nas.ApiPort}) is not reachable from the server.");
                }
            }

            // 2. Real API session
            return await Task.Run(() =>
            {
                using var connection = OpenWithLogin(nas, key, timeoutMs);
                UnreachableUntil.TryRemove(key, out _);
                return work(connection);
            });
        }
        finally
        {
            gate.Release();
        }
    }

    /// <summary>
    /// Opens the API session (tik4net "Api" handles both old and new RouterOS login).
    /// A refused login is remembered for 60 s so a wrong password does not flood
    /// the router with failed logins, and the error says what to check.
    /// </summary>
    private static ITikConnection OpenWithLogin(NasDevice nas, string key, int timeoutMs)
    {
        var connection = ConnectionFactory.CreateConnection(TikConnectionType.Api);
        try
        {
            connection.SendTimeout = timeoutMs;
            connection.ReceiveTimeout = timeoutMs;
            connection.Open(nas.NasIpAddress, nas.ApiPort, nas.ApiUsername, nas.ApiPassword);
            return connection;
        }
        catch (Exception ex) when (ex is TikCommandException or TikConnectionException)
        {
            connection.Dispose();
            UnreachableUntil[key] = DateTime.UtcNow.AddSeconds(60);
            var detail = string.IsNullOrWhiteSpace(ex.Message) ? "" : $" ({ex.Message.Trim()})";
            throw new RouterUnreachableException(
                $"Login to router {nas.NasName} ({nas.NasIpAddress}:{nas.ApiPort}) failed{detail}. " +
                "Check the NAS API username / password, that the user's group has the 'api' policy, " +
                "and that IP > Services > api is enabled for the server's IP.");
        }
    }

    public static string Word(ITikReSentence row, string key) =>
        row.Words.TryGetValue(key, out var v) ? v : "";

    /// <summary>Current RX/TX bits per second of the given interfaces.</summary>
    public static Dictionary<string, (long rx, long tx)> InterfaceTraffic(ITikConnection connection, IReadOnlyCollection<string> names)
    {
        var result = new Dictionary<string, (long rx, long tx)>(StringComparer.Ordinal);
        if (names.Count == 0) return result;

        try
        {
            // monitor-traffic gives the router's own bps value in one call
            var rows = connection.CreateCommandAndParameters(
                    "/interface/monitor-traffic",
                    "interface", string.Join(",", names),
                    "once", "")
                .ExecuteList();

            foreach (var row in rows)
            {
                var name = Word(row, "name");
                if (string.IsNullOrEmpty(name)) continue;
                long.TryParse(Word(row, "rx-bits-per-second"), out var rx);
                long.TryParse(Word(row, "tx-bits-per-second"), out var tx);
                result[name] = (rx, tx);
            }

            if (result.Count > 0) return result;
        }
        catch
        {
            // older RouterOS / unusual interface: use byte counters below
        }

        // Fallback: read byte counters of only these interfaces twice, 1 second apart
        Dictionary<string, (long rx, long tx)> Snapshot()
        {
            var snap = new Dictionary<string, (long, long)>();
            foreach (var name in names)
            {
                var cmd = connection.CreateCommand("/interface/print");
                cmd.AddParameter("name", name, TikCommandParameterFormat.Filter);
                var row = cmd.ExecuteList().FirstOrDefault();
                if (row == null) continue;
                long.TryParse(Word(row, "rx-byte"), out var rx);
                long.TryParse(Word(row, "tx-byte"), out var tx);
                snap[name] = (rx, tx);
            }
            return snap;
        }

        var first = Snapshot();
        var started = DateTime.UtcNow;
        Thread.Sleep(1000);
        var second = Snapshot();
        var seconds = Math.Max(0.5, (DateTime.UtcNow - started).TotalSeconds);

        foreach (var (name, b) in second)
        {
            if (!first.TryGetValue(name, out var a)) continue;
            result[name] = ((long)(Math.Max(0, b.rx - a.rx) * 8 / seconds), (long)(Math.Max(0, b.tx - a.tx) * 8 / seconds));
        }
        return result;
    }

    /// <summary>RouterOS time values: "12ms", "12ms345us", "1s20ms", "345us".</summary>
    public static double ParseMs(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return 0;
        double total = 0;
        var number = "";
        for (int i = 0; i < value.Length; i++)
        {
            var c = value[i];
            if (char.IsDigit(c) || c == '.') { number += c; continue; }
            var unit = value.Substring(i);
            double n = double.TryParse(number, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : 0;
            if (unit.StartsWith("ms")) { total += n; i += 1; }
            else if (unit.StartsWith("us")) { total += n / 1000; i += 1; }
            else if (unit.StartsWith("s")) total += n * 1000;
            else if (unit.StartsWith("m")) total += n * 60000;
            number = "";
        }
        if (number.Length > 0 && double.TryParse(number, NumberStyles.Float, CultureInfo.InvariantCulture, out var rest))
            total += rest;
        return Math.Round(total, 2);
    }
}
