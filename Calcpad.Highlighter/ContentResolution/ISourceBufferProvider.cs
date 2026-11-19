namespace Calcpad.Highlighter.ContentResolution
{
    /// <summary>
    /// Supplies the current original text of an included source file, including unsaved host
    /// buffer contents. The resolver still owns include resolution and preprocessing.
    /// </summary>
    public interface ISourceBufferProvider
    {
        /// <summary>
        /// Attempts to retrieve the exact current source text for a resolved include identity.
        /// Return false to let the resolver fall back to the filesystem.
        /// </summary>
        bool TryGetSource(string file, out string source);
    }
}
