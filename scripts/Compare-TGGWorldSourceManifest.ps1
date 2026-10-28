# TGG WORLD source-recovery manifest comparison
# Read-only: hashes files and compares them with a SHA-256 manifest. Does not extract,
# modify source, create commits, push, merge, deploy, or touch production.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot,

    [Parameter(Mandatory = $true)]
    [string]$ManifestPath,

    [string]$ReportPath = ""
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path -LiteralPath $SourceRoot).Path
$manifest = (Resolve-Path -LiteralPath $ManifestPath).Path
$required = @(
    "src/game/threeEngine.ts",
    "src/game/gameState.ts",
    "src/App.tsx",
    "src/components/HUD.tsx",
    "src/components/TGGPhone.tsx",
    "scripts/verify-gameplay.ts",
    "package.json",
    "vite.config.ts",
    "tsconfig.json"
)

# Accept standard sha256sum lines: "<64-hex>  path" or "<64-hex> *path".
# Blank lines and comments are ignored. Unknown formats fail closed.
$entries = [System.Collections.Generic.List[object]]::new()
$parseErrors = [System.Collections.Generic.List[string]]::new()
$lineNumber = 0
foreach ($line in Get-Content -LiteralPath $manifest) {
    $lineNumber++
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith("#")) { continue }
    if ($line -match '^\s*([A-Fa-f0-9]{64})\s+[* ]?(.+?)\s*$') {
        $expectedHash = $Matches[1].ToLowerInvariant()
        $relative = $Matches[2].Trim() -replace '\\', '/'
        while ($relative.StartsWith("./")) { $relative = $relative.Substring(2) }
        if ([IO.Path]::IsPathRooted($relative) -or $relative -match '(^|/)\.\.(?:/|$)') {
            $parseErrors.Add("Line $lineNumber contains an unsafe path: $relative")
            continue
        }
        $entries.Add([pscustomobject]@{ RelativePath = $relative; ExpectedSHA256 = $expectedHash; Line = $lineNumber })
    } else {
        $parseErrors.Add("Line $lineNumber has an unsupported manifest format.")
    }
}

$results = [System.Collections.Generic.List[object]]::new()
$seen = @{}
foreach ($entry in $entries) {
    $key = $entry.RelativePath.ToLowerInvariant()
    if ($seen.ContainsKey($key)) {
        $parseErrors.Add("Duplicate manifest path: $($entry.RelativePath)")
        continue
    }
    $seen[$key] = $true
    $path = Join-Path $root ($entry.RelativePath -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        $results.Add([pscustomobject]@{
            RelativePath = $entry.RelativePath
            ExpectedSHA256 = $entry.ExpectedSHA256
            ActualSHA256 = $null
            Status = "MISSING_FILE"
        })
        continue
    }
    $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    $results.Add([pscustomobject]@{
        RelativePath = $entry.RelativePath
        ExpectedSHA256 = $entry.ExpectedSHA256
        ActualSHA256 = $actual
        Status = if ($actual -eq $entry.ExpectedSHA256) { "MATCH" } else { "HASH_MISMATCH" }
    })
}

$requiredChecks = foreach ($relative in $required) {
    $manifestEntry = $entries | Where-Object { $_.RelativePath -eq $relative } | Select-Object -First 1
    [pscustomobject]@{
        RelativePath = $relative
        ListedInManifest = [bool]$manifestEntry
        PresentOnDisk = Test-Path -LiteralPath (Join-Path $root ($relative -replace '/', [IO.Path]::DirectorySeparatorChar)) -PathType Leaf
    }
}

$mismatches = @($results | Where-Object { $_.Status -ne "MATCH" })
$status = if ($parseErrors.Count -gt 0) {
    "BLOCKED_MANIFEST_PARSE_ERRORS"
} elseif ($entries.Count -eq 0) {
    "BLOCKED_NO_VALID_MANIFEST_ENTRIES"
} elseif ($mismatches.Count -gt 0) {
    "FAIL_MANIFEST_MISMATCH_OR_MISSING_FILE"
} elseif (@($requiredChecks | Where-Object { -not $_.ListedInManifest -or -not $_.PresentOnDisk }).Count -gt 0) {
    "BLOCKED_REQUIRED_SOURCE_NOT_COVERED"
} else {
    "PASS_MANIFEST_HASHES_MATCH"
}

$report = [pscustomobject]@{
    Status = $status
    SourceRoot = $root
    ManifestPath = $manifest
    CheckedAtUtc = [DateTime]::UtcNow.ToString("o")
    ManifestEntryCount = $entries.Count
    MatchingEntryCount = @($results | Where-Object { $_.Status -eq "MATCH" }).Count
    MismatchOrMissingCount = $mismatches.Count
    ParseErrors = @($parseErrors)
    RequiredSourceChecks = @($requiredChecks)
    Files = @($results)
    Notes = @(
        "Read-only: no extraction, source edits, commits, pushes, merges, or deployments.",
        "PASS means every parsed manifest entry matched and every required source file was present and explicitly covered by the manifest.",
        "The manifest must come from a trusted source; a matching untrusted manifest does not prove provenance.",
        "Only standard SHA-256 checksum lines are accepted. Review parse errors rather than treating unsupported formats as success."
    )
}
$json = $report | ConvertTo-Json -Depth 7
$json
if ($ReportPath) {
    $parent = Split-Path -Parent $ReportPath
    if ($parent -and -not (Test-Path -LiteralPath $parent -PathType Container)) {
        throw "Report directory does not exist: $parent"
    }
    Set-Content -LiteralPath $ReportPath -Value $json -Encoding UTF8
}
if ($status -ne "PASS_MANIFEST_HASHES_MATCH") { exit 2 }
