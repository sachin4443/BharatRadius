using Microsoft.AspNetCore.Identity;

namespace RadiusSoftware.API.Security;

/// <summary>
/// Panel user passwords are stored as ASP.NET Core Identity hashes (PBKDF2).
/// Older rows still contain plain-text passwords; these keep working and are
/// upgraded to a hash automatically on the next successful login.
/// </summary>
public static class PasswordUtil
{
    private static readonly PasswordHasher<object> Hasher = new();
    private static readonly object Dummy = new();

    public static string Hash(string password) => Hasher.HashPassword(Dummy, password);

    public static bool IsHashed(string? stored) =>
        !string.IsNullOrEmpty(stored) && stored.StartsWith("AQAAAA", StringComparison.Ordinal) && stored.Length > 60;

    /// <param name="needsUpgrade">true when the stored value is plain text (or an old hash) and should be re-saved.</param>
    public static bool Verify(string? stored, string? provided, out bool needsUpgrade)
    {
        needsUpgrade = false;
        if (string.IsNullOrEmpty(stored) || provided == null) return false;

        if (IsHashed(stored))
        {
            try
            {
                var result = Hasher.VerifyHashedPassword(Dummy, stored, provided);
                needsUpgrade = result == PasswordVerificationResult.SuccessRehashNeeded;
                return result != PasswordVerificationResult.Failed;
            }
            catch (FormatException)
            {
                // fall through to plain-text comparison
            }
        }

        var ok = System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(stored),
            System.Text.Encoding.UTF8.GetBytes(provided));
        needsUpgrade = ok;
        return ok;
    }
}
