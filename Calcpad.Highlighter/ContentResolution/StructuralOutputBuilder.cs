using System;
using System.Collections.Generic;
using System.Linq;
using Calcpad.Highlighter.Tokenizer.Models;

namespace Calcpad.Highlighter.ContentResolution
{
    /// <summary>Projects existing Stage 3 tokens into a flat, source-backed structural view.</summary>
    public sealed class StructuralOutputBuilder
    {
        private sealed record Candidate(int Line, int Column, int Sequence, StructuralConstruct Construct);
        private readonly record struct MappedPosition(string File, int Line, int Column, bool IsIncluded);

        public StructuralOutput Build(
            string rootSource,
            string rootSourceId,
            StagedResolvedContent staged,
            ISourceBufferProvider sourceBuffers = null)
        {
            if (rootSource is null)
                throw new ArgumentNullException(nameof(rootSource));
            if (string.IsNullOrWhiteSpace(rootSourceId))
                throw new ArgumentException("A stable root source identity is required.", nameof(rootSourceId));
            if (staged?.Stage1 is null || staged.Stage2 is null || staged.Stage3 is null)
                throw new ArgumentException("A complete staged resolution is required.", nameof(staged));

            var stage3 = staged.Stage3;
            var candidates = new List<Candidate>();
            var sequence = 0;
            var assignments = new HashSet<(string Name, int Line, int Column)>();
            foreach (var assignment in stage3.VariableAssignments)
                assignments.Add((assignment.Name, assignment.Line, assignment.Column));

            var reassignments = new HashSet<(string Name, int Line, int Column)>();
            foreach (var assignment in stage3.VariableReassignments)
                reassignments.Add((assignment.Name, assignment.Line, assignment.Column));

            var functionDefinitions = new HashSet<(string Name, int Line, int Column, string SourceFile)>();
            foreach (var pair in stage3.FunctionIndex)
            {
                foreach (var location in pair.Value)
                {
                    if (!location.IsAssignment)
                        continue;
                    var sourceFile = location.Source == "include" ? location.SourceFile : string.Empty;
                    functionDefinitions.Add((pair.Key, location.Line, location.Column, sourceFile ?? string.Empty));
                }
            }

            foreach (var token in stage3.Tokens ?? new List<Token>())
            {
                if (!TryGetKind(token, assignments, reassignments, functionDefinitions,
                    staged, rootSourceId, out var kind, out var name))
                    continue;

                var mapped = TryMapStage3Range(staged, token.Line, token.Column, token.Length,
                    rootSourceId, rootSource, sourceBuffers, out var range, out var text, out var origin);
                var orderLine = stage3.SourceMap.GetValueOrDefault(token.Line, token.Line);

                candidates.Add(new Candidate(orderLine, token.Column, sequence++,
                    new StructuralConstruct
                    {
                        Kind = kind,
                        Range = mapped ? range : null,
                        Text = mapped ? text : null,
                        Origin = mapped ? origin : GetFallbackOrigin(staged, token.Line),
                        Name = name
                    }));
            }

            // Macro definitions are removed from the expanded token stream, so project them
            // from Stage 2's existing definition metadata and original source mapping.
            foreach (var definition in staged.Stage2.MacroDefinitions ?? new List<MacroDefinition>())
            {
                var line = definition.LineNumber;
                if (line < 0 || line >= staged.Stage2.Lines.Count)
                    continue;
                var sourceLine = staged.Stage2.Lines[line] ?? string.Empty;
                var mapped = TryMapStage2Range(staged, line, 0, sourceLine.Length,
                    rootSourceId, rootSource, sourceBuffers, out var range, out var text, out var origin);
                candidates.Add(new Candidate(line, 0, sequence++,
                    new StructuralConstruct
                    {
                        Kind = StructuralConstructKind.MacroDefinition,
                        Range = mapped ? range : null,
                        Text = mapped ? text : null,
                        Origin = mapped ? origin : GetStage2FallbackOrigin(staged, line),
                        Name = definition.Name
                    }));
            }

            // Raw HTML/Markdown lines have no ordinary tokens. Keep them as flat line constructs.
            if (stage3.RawLines is not null)
            {
                foreach (var line in stage3.RawLines)
                {
                    if (line < 0 || line >= stage3.Lines.Count)
                        continue;
                    var sourceLine = stage3.Lines[line] ?? string.Empty;
                    if (sourceLine.Length == 0)
                        continue;

                    var mapped = TryMapStage3Range(staged, line, 0, sourceLine.Length,
                        rootSourceId, rootSource, sourceBuffers, out var range, out var text, out var origin);
                    candidates.Add(new Candidate(stage3.SourceMap.GetValueOrDefault(line, line), 0, sequence++,
                        new StructuralConstruct
                        {
                            Kind = StructuralConstructKind.HtmlOrMarkdownContent,
                            Range = mapped ? range : null,
                            Text = mapped ? text : null,
                            Origin = mapped ? origin : GetFallbackOrigin(staged, line)
                        }));
                }
            }

            candidates.Sort(static (left, right) =>
            {
                var line = left.Line.CompareTo(right.Line);
                if (line != 0) return line;
                var column = left.Column.CompareTo(right.Column);
                return column != 0 ? column : left.Sequence.CompareTo(right.Sequence);
            });

            return new StructuralOutput
            {
                Constructs = candidates.Select(candidate => candidate.Construct).ToArray()
            };
        }

        private static bool TryGetKind(
            Token token,
            HashSet<(string Name, int Line, int Column)> assignments,
            HashSet<(string Name, int Line, int Column)> reassignments,
            HashSet<(string Name, int Line, int Column, string SourceFile)> functionDefinitions,
            StagedResolvedContent staged,
            string rootSourceId,
            out StructuralConstructKind kind,
            out string name)
        {
            name = token.Text;
            switch (token.Type)
            {
                case TokenType.Comment:
                case TokenType.HtmlComment:
                    kind = StructuralConstructKind.Comment;
                    return true;
                case TokenType.Tag:
                case TokenType.HtmlContent:
                case TokenType.JavaScript:
                case TokenType.Css:
                case TokenType.Svg:
                    kind = StructuralConstructKind.HtmlOrMarkdownContent;
                    return true;
                case TokenType.Variable:
                    if (reassignments.Contains((token.Text, token.Line, token.Column)))
                    {
                        kind = StructuralConstructKind.VariableReassignment;
                        return true;
                    }
                    if (assignments.Contains((token.Text, token.Line, token.Column)))
                    {
                        kind = StructuralConstructKind.VariableDefinition;
                        return true;
                    }
                    kind = default;
                    return false;
                case TokenType.Function:
                    if (TryMapStage3Range(staged, token.Line, token.Column, token.Length,
                        rootSourceId, null, null, out var range, out _, out _) &&
                        functionDefinitions.Contains((token.Text, range.StartLine, range.StartColumn, GetStage3SourceFile(staged, token.Line))))
                        kind = StructuralConstructKind.FunctionDefinition;
                    else
                        kind = StructuralConstructKind.FunctionCall;
                    return true;
                case TokenType.Macro:
                    kind = StructuralConstructKind.MacroCall;
                    return true;
                case TokenType.ControlBlockKeyword:
                case TokenType.EndKeyword:
                    kind = StructuralConstructKind.ControlFlowDirective;
                    return true;
                case TokenType.Command:
                    kind = StructuralConstructKind.Command;
                    return true;
                case TokenType.Include:
                    kind = StructuralConstructKind.IncludeDirective;
                    return true;
                case TokenType.FilePath:
                case TokenType.DataExchangeKeyword:
                    kind = StructuralConstructKind.DataExchangeDirective;
                    return true;
                case TokenType.Input:
                    kind = StructuralConstructKind.InputDirective;
                    return true;
                case TokenType.Setting:
                case TokenType.SettingsJson:
                    kind = StructuralConstructKind.SettingsDirective;
                    return true;
                default:
                    kind = default;
                    return false;
            }
        }

        private static string GetStage3SourceFile(StagedResolvedContent staged, int stage3Line)
        {
            return staged.Stage3.IncludeMap.TryGetValue(stage3Line, out var info) &&
                info?.Source == "include" ? info.SourceFile ?? string.Empty : string.Empty;
        }

        private static SourceOrigin GetFallbackOrigin(StagedResolvedContent staged, int stage3Line)
        {
            if (staged.Stage3.MacroExpansions.ContainsKey(stage3Line))
                return SourceOrigin.Generated;
            var stage2Line = staged.Stage3.SourceMap.GetValueOrDefault(stage3Line, -1);
            return GetStage2FallbackOrigin(staged, stage2Line);
        }

        private static SourceOrigin GetStage2FallbackOrigin(StagedResolvedContent staged, int stage2Line)
        {
            if (stage2Line < 0)
                return SourceOrigin.Unknown;
            return staged.Stage2.IncludeMap.TryGetValue(stage2Line, out var info) &&
                info?.Source == "include" ? SourceOrigin.IncludedFile : SourceOrigin.Local;
        }

        private static bool TryMapStage3Range(
            StagedResolvedContent staged, int stage3Line, int stage3Column, int length,
            string rootSourceId, string rootSource, ISourceBufferProvider sourceBuffers,
            out SourceRange range, out string text, out SourceOrigin origin)
        {
            range = null;
            text = null;
            origin = SourceOrigin.Unknown;
            if (length <= 0 || !TryMapStage3Position(staged, stage3Line, stage3Column,
                rootSourceId, out var first, out var macro))
                return false;

            var last = first;
            for (var offset = 1; offset < length; offset++)
            {
                if (!TryMapStage3Position(staged, stage3Line, stage3Column + offset,
                    rootSourceId, out var current, out _) ||
                    current.File != first.File || current.Line != first.Line ||
                    current.Column != first.Column + offset)
                    return false;
                last = current;
            }

            return FinishRange(first, last, length, macro, rootSource, sourceBuffers,
                out range, out text, out origin);
        }

        private static bool TryMapStage2Range(
            StagedResolvedContent staged, int stage2Line, int stage2Column, int length,
            string rootSourceId, string rootSource, ISourceBufferProvider sourceBuffers,
            out SourceRange range, out string text, out SourceOrigin origin)
        {
            range = null;
            text = null;
            origin = SourceOrigin.Unknown;
            if (length <= 0 || !TryMapStage2Position(staged, stage2Line, stage2Column,
                rootSourceId, out var first))
                return false;

            var last = first;
            for (var offset = 1; offset < length; offset++)
            {
                if (!TryMapStage2Position(staged, stage2Line, stage2Column + offset,
                    rootSourceId, out var current) ||
                    current.File != first.File || current.Line != first.Line ||
                    current.Column != first.Column + offset)
                    return false;
                last = current;
            }

            return FinishRange(first, last, length, false, rootSource, sourceBuffers,
                out range, out text, out origin);
        }

        private static bool FinishRange(
            MappedPosition first, MappedPosition last, int length, bool macro,
            string rootSource, ISourceBufferProvider sourceBuffers,
            out SourceRange range, out string text, out SourceOrigin origin)
        {
            range = new SourceRange
            {
                File = first.File,
                StartLine = first.Line,
                StartColumn = first.Column,
                EndLine = last.Line,
                EndColumn = last.Column + 1
            };
            text = null;
            origin = macro ? SourceOrigin.MacroExpansion :
                first.IsIncluded ? SourceOrigin.IncludedFile : SourceOrigin.Local;

            string source = null;
            if (!first.IsIncluded)
                source = rootSource;
            else if (sourceBuffers is not null)
                sourceBuffers.TryGetSource(first.File, out source);

            if (source is not null && TryGetLine(source, first.Line, out var lineText) &&
                first.Column >= 0 && first.Column + length <= lineText.Length)
                text = lineText.Substring(first.Column, length);
            return true;
        }

        private static bool TryMapStage3Position(
            StagedResolvedContent staged, int stage3Line, int stage3Column, string rootSourceId,
            out MappedPosition mapped, out bool macro)
        {
            mapped = default;
            macro = false;
            if (stage3Column < 0 || !staged.Stage3.SourceMap.TryGetValue(stage3Line, out var stage2Line))
                return false;

            var stage2Column = stage3Column;
            if (staged.Stage3.MacroExpansions.TryGetValue(stage3Line, out var expansion))
            {
                macro = true;
                if (expansion.Origins is not { } origins || stage3Column >= origins.Count)
                    return false;
                var point = origins[stage3Column];
                if (point.Line < 0 || point.Column < 0)
                    return false;
                stage2Line = point.Line;
                stage2Column = point.Column;
            }

            return TryMapStage2Position(staged, stage2Line, stage2Column, rootSourceId, out mapped);
        }

        private static bool TryMapStage2Position(
            StagedResolvedContent staged, int stage2Line, int stage2Column, string rootSourceId,
            out MappedPosition mapped)
        {
            mapped = default;
            if (staged.Stage2.IncludeMap.TryGetValue(stage2Line, out var include) &&
                include?.Source == "include")
            {
                var line = include.OriginalLine;
                var column = stage2Column;
                if (include.Segments is { Count: > 0 } segments)
                {
                    var found = false;
                    foreach (var segment in segments)
                    {
                        if (stage2Column >= segment.StartColumn &&
                            stage2Column < segment.StartColumn + segment.Length)
                        {
                            line = segment.OriginalLine;
                            column = stage2Column - segment.StartColumn;
                            found = true;
                            break;
                        }
                    }
                    if (!found) return false;
                }

                var file = include.FilePath ?? include.SourceFile;
                if (string.IsNullOrWhiteSpace(file) || line < 0)
                    return false;
                mapped = new MappedPosition(file, line, column, true);
                return true;
            }

            if (!staged.Stage2.SourceMap.TryGetValue(stage2Line, out var stage1Line))
                return false;

            var originalLine = stage1Line;
            var originalColumn = stage2Column;
            if (staged.Stage1.LineContinuationSegments is not null &&
                staged.Stage1.LineContinuationSegments.TryGetValue(stage1Line, out var segments))
            {
                var found = false;
                foreach (var segment in segments)
                {
                    if (stage2Column >= segment.StartColumn &&
                        stage2Column < segment.StartColumn + segment.Length)
                    {
                        originalLine = segment.OriginalLine;
                        originalColumn = stage2Column - segment.StartColumn;
                        found = true;
                        break;
                    }
                }
                if (!found) return false;
            }
            else if (staged.Stage1.SourceMap.TryGetValue(stage1Line, out var sourceLine))
                originalLine = sourceLine;
            else
                return false;

            mapped = new MappedPosition(rootSourceId, originalLine, originalColumn, false);
            return true;
        }

        private static bool TryGetLine(string source, int targetLine, out string line)
        {
            line = null;
            if (targetLine < 0) return false;
            var currentLine = 0;
            var start = 0;
            for (var i = 0; i <= source.Length; i++)
            {
                if (i != source.Length && source[i] != '\r' && source[i] != '\n')
                    continue;
                if (currentLine == targetLine)
                {
                    line = source.Substring(start, i - start);
                    return true;
                }
                if (i < source.Length && source[i] == '\r' && i + 1 < source.Length && source[i + 1] == '\n')
                    i++;
                start = i + 1;
                currentLine++;
            }
            return false;
        }
    }
}
