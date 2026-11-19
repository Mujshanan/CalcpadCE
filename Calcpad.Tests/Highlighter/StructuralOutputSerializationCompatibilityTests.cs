using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using Calcpad.Highlighter.ContentResolution;
using Xunit;

namespace Calcpad.Tests.Highlighter
{
    public class StructuralOutputSerializationCompatibilityTests
    {
        [Fact]
        public void StructuralOutput_UsesWebJsonDefaultsAndMatchesTypeScriptFixture()
        {
            // ASP.NET Core MVC uses the System.Text.Json web defaults. CalcpadApiService
            // registers AddControllers() without a JsonStringEnumConverter or custom
            // JsonOptions, so enum values cross this boundary as JSON numbers.
            var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
            var constructs = Enumerable.Range(0, 16)
                .Select(value => new StructuralConstruct
                {
                    Kind = (StructuralConstructKind)value,
                    Range = value == 0
                        ? new SourceRange
                        {
                            File = "fixture://root",
                            StartLine = 0,
                            StartColumn = 0,
                            EndLine = 0,
                            EndColumn = 1
                        }
                        : null,
                    Text = value == 0 ? "x" : null,
                    Origin = (SourceOrigin)(value % 5),
                    Name = value == (int)StructuralConstructKind.VariableDefinition ? "x" : null
                })
                .ToArray();
            var output = new StructuralOutput { Constructs = constructs };

            var actualJson = JsonSerializer.Serialize(output, options);
            var fixturePath = Path.Combine(
                AppContext.BaseDirectory,
                "Highlighter",
                "Fixtures",
                "structural-output.web.json");
            var expectedJson = File.ReadAllText(fixturePath);
            var expectedFixture = JsonNode.Parse(expectedJson);
            Assert.True(
                JsonNode.DeepEquals(
                    expectedFixture["structuralConstructKindNames"],
                    JsonNode.Parse(JsonSerializer.Serialize(
                        System.Enum.GetNames(typeof(StructuralConstructKind))))),
                "StructuralConstructKind names/order changed; update the shared fixture and TypeScript mapping deliberately.");
            Assert.True(
                JsonNode.DeepEquals(
                    expectedFixture["sourceOriginNames"],
                    JsonNode.Parse(JsonSerializer.Serialize(System.Enum.GetNames(typeof(SourceOrigin))))),
                "SourceOrigin names/order changed; update the shared fixture and TypeScript mapping deliberately.");

            // Enum metadata is part of the shared contract fixture, not the serialized
            // StructuralOutput payload itself.
            expectedFixture.AsObject().Remove("structuralConstructKindNames");
            expectedFixture.AsObject().Remove("sourceOriginNames");

            Assert.True(
                JsonNode.DeepEquals(expectedFixture, JsonNode.Parse(actualJson)),
                $"C# StructuralOutput JSON did not match the shared TypeScript fixture. Actual: {actualJson}");
        }
    }
}
