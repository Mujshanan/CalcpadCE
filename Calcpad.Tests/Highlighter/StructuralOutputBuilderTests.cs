using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Calcpad.Highlighter.ContentResolution;
using Xunit;

namespace Calcpad.Tests.Highlighter
{
    public class StructuralOutputBuilderTests
    {
        private sealed class InMemorySourceBuffers : ISourceBufferProvider
        {
            private readonly Dictionary<string, string> _sources;

            public InMemorySourceBuffers(Dictionary<string, string> sources)
                => _sources = sources;

            public bool TryGetSource(string file, out string source)
                => _sources.TryGetValue(file, out source);
        }

        [Fact]
        public void Build_ProjectsAssignmentsCommentsAndIndependentControlDirectives()
        {
            const string source =
                "x = 1\n" +
                "x = 2\n" +
                "' a note\n" +
                "#if x > 0\n" +
                "#else\n" +
                "#end if";

            var staged = new ContentResolver().GetStagedContent(source);
            var output = new StructuralOutputBuilder().Build(source, "untitled://worksheet/1", staged);

            Assert.Contains(output.Constructs, c =>
                c.Kind == StructuralConstructKind.VariableDefinition && c.Name == "x" &&
                c.Range?.StartLine == 0 && c.Text == "x");
            Assert.Contains(output.Constructs, c =>
                c.Kind == StructuralConstructKind.VariableReassignment && c.Name == "x" &&
                c.Range?.StartLine == 1 && c.Text == "x");
            Assert.Contains(output.Constructs, c =>
                c.Kind == StructuralConstructKind.Comment && c.Text == "' a note");

            var directives = output.Constructs
                .Where(c => c.Kind == StructuralConstructKind.ControlFlowDirective)
                .ToArray();
            Assert.Equal(3, directives.Length);
            Assert.Equal(new[] { "#if", "#else", "#end if" }, directives.Select(c => c.Text));
            Assert.All(directives, c => Assert.NotNull(c.Range));
        }

        [Fact]
        public void GetStagedContent_ResolvesIncludeFromUnsavedBuffer()
        {
            var directory = Path.Combine(Path.GetTempPath(), $"calcpad_unsaved_include_{Guid.NewGuid():N}");
            Directory.CreateDirectory(directory);
            try
            {
                var rootPath = Path.Combine(directory, "main.cpd");
                var includePath = Path.GetFullPath(Path.Combine(directory, "virtual.cpd"));
                const string root = "#include virtual.cpd";
                const string included = "includedValue = 42";
                var buffers = new InMemorySourceBuffers(new Dictionary<string, string>
                {
                    [includePath] = included
                });

                var staged = new ContentResolver().GetStagedContent(
                    root, rootPath, sourceBuffers: buffers);

                Assert.Contains(includePath, staged.Stage2.IncludedFileHashes.Keys);

                var output = new StructuralOutputBuilder().Build(root, rootPath, staged, buffers);
                var construct = Assert.Single(output.Constructs.Where(c =>
                    c.Kind == StructuralConstructKind.VariableDefinition &&
                    c.Name == "includedValue"));

                Assert.Equal(includePath, construct.Range?.File);
                Assert.Equal(0, construct.Range?.StartLine);
                Assert.Equal("includedValue", construct.Text);
                Assert.Equal(SourceOrigin.IncludedFile, construct.Origin);
            }
            finally
            {
                Directory.Delete(directory, recursive: true);
            }
        }

        [Fact]
        public void Build_DoesNotInventMathematicalExpressionBoundaries()
        {
            const string source = "x = a + b";
            var staged = new ContentResolver().GetStagedContent(source);
            var output = new StructuralOutputBuilder().Build(source, "untitled://worksheet/math", staged);

            Assert.DoesNotContain(output.Constructs,
                c => c.Kind == StructuralConstructKind.MathematicalExpression);
        }
    }
}
