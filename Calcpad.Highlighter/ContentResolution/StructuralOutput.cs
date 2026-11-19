using System;
using System.Collections.Generic;

namespace Calcpad.Highlighter.ContentResolution
{
    /// <summary>A flat, source-ordered projection of constructs recognized by the existing pipeline.</summary>
    public sealed class StructuralOutput
    {
        public IReadOnlyList<StructuralConstruct> Constructs { get; init; }
            = Array.Empty<StructuralConstruct>();
    }

    public sealed class StructuralConstruct
    {
        public StructuralConstructKind Kind { get; init; }
        public SourceRange Range { get; init; }
        public string Text { get; init; }
        public SourceOrigin Origin { get; init; }
        public string Name { get; init; }
    }

    /// <summary>Zero-based source coordinates with an exclusive end position.</summary>
    public sealed class SourceRange
    {
        public string File { get; init; }
        public int StartLine { get; init; }
        public int StartColumn { get; init; }
        public int EndLine { get; init; }
        public int EndColumn { get; init; }
    }

    public enum StructuralConstructKind
    {
        Comment,
        HtmlOrMarkdownContent,
        VariableDefinition,
        VariableReassignment,
        FunctionDefinition,
        FunctionCall,
        MacroDefinition,
        MacroCall,
        CustomUnitDefinition,
        ControlFlowDirective,
        Command,
        IncludeDirective,
        DataExchangeDirective,
        InputDirective,
        SettingsDirective,
        MathematicalExpression
    }

    public enum SourceOrigin
    {
        Local,
        IncludedFile,
        MacroExpansion,
        Generated,
        Unknown
    }
}
