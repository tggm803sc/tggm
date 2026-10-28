# TGG WORLD source-recovery validation
# Read-only validation. Does not extract archives, modify source, push commits, or touch production.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot,

    [string]$ExpectedManifestPath = "",

    [string]$ReportPath = ""
)

$ErrorActionPreference = "Stop"
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

$root = (Resolve-Path -LiteralPath $SourceRoot).Path
$results = [System.Collections.Generic.List[object]]::new()

foreach ($relative in $required) {
    $path = Join-Path $root ($relative -replace '/', [IO.Path]::DirectorySeparatorChar)
    $exists = Test-Path -LiteralPath $path -PathType Leaf
    $hash = $null
    $length = $null
    if ($exists) {
        $item = Get-Item -LiteralPath $path
        $length = $item.Length
        $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    $results.Add([pscustomobject]@{
        RelativePath = $relative
        Exists = $exists
        LengthBytes = $length
        SHA256 = $hash
    })
}

$manifestResult = "NOT_PROVIDED"
if ($ExpectedManifestPath) {
    if (Test-Path -LiteralPath $ExpectedManifestPath -PathType Leaf) {
        $manifestResult = "PRESENT_REQUIRES_LINE_BY_LINE_COMPARISON"
    } else {
        $manifestResult = "MISSING"
    }
}

$missing = @($results | Where-Object { -not $_.Exists })
$report = [pscustomobject]@{
    Status = if ($missing.Count -eq 0) { "SOURCE_TREE_FILES_PRESENT_HASHES_RECORDED" } else { "BLOCKED_REQUIRED_FILES_MISSING" }
    SourceRoot = $root
    CheckedAtUtc = [DateTime]::UtcNow.ToString("o")
    RequiredFileCount = $required.Count
    PresentFileCount = $required.Count - $missing.Count
    MissingFiles = @($missing | ForEach-Object { $_.RelativePath })
    ManifestStatus = $manifestResult
    Files = @($results)
    Notes = @(
        "This script is read-only and does not extract or change files.",
        "File hashes identify the local contents but do not prove they match a trusted upstream until compared with a trusted manifest or commit.",
        "No Git commit, push, merge, deployment, or production operation is performed."
    )
}

$json = $report | ConvertTo-Json -Depth 6
$json
if ($ReportPath) {
    $parent = Split-Path -Parent $ReportPath
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        throw "Report directory does not exist: $parent"
    }
    Set-Content -LiteralPath $ReportPath -Value $json -Encoding UTF8
}
if ($missing.Count -gt 0) { exit 2 }
