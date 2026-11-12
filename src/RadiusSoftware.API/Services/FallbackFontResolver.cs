using PdfSharp.Fonts;
using System.IO;

public class FallbackFontResolver : IFontResolver
{
    public string DefaultFontName => "Arial";

    public byte[] GetFont(string faceName)
    {
        // Windows ke default Arial font ko fallback me read karna
        var fontPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Fonts), "arial.ttf");
        if (File.Exists(fontPath))
        {
            return File.ReadAllBytes(fontPath);
        }

        // Linux / Docker container ke liye generic check
        var linuxFontPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
        if (File.Exists(linuxFontPath))
        {
            return File.ReadAllBytes(linuxFontPath);
        }

        return null;
    }

    public FontResolverInfo ResolveTypeface(string familyName, bool isBold, bool isItalic)
    {
        return new FontResolverInfo("Arial");
    }
}