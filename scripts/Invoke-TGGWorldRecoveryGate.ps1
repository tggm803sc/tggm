# TGG WORLD local recovery gate runner
# Run this from an authorized Windows/Antigravity terminal after the source has been
# safely exported to a separate recovery directory. This script is read-only with
# respect to source and Git; it does not upload, commit, push, merge, or deploy.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot,

    [Parameter(Mandatory = $true)]
    [string]$ManifestPath,

    [string]$EvidenceDirectory = ".\TGG-Recovery-Evidence"
)

$ErrorActionPreference = "Stop"
$source = (Resolve-Path -LiteralPath $SourceRoot).Path
$manifest = (Resolve-Path -LiteralPath $ManifestPath).Path
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$presenceValidator = Join-Path $scriptRoot "Validate-TGGWorldSourceRecovery.ps1"
$manifestComparer = Join-Path $scriptRoot "Compare-TGGWorldSourceManifest.ps1"

foreach ($requiredScript in @($presenceValidator, $manifestComparer)) {
    if (-not (Test-Path -LiteralPath $requiredScript -PathType Leaf)) {
        throw "Required gate script is missing: $requiredScript"
    }
}
if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    throw "Source root is not a directory: $source"
}
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
    throw "Manifest is not a file: $manifest"
}

$evidence = [IO.Path]::GetFullPath($EvidenceDirectory)
if (-not (Test-Path -LiteralPath $evidence -PathType Container)) {
    New-Item -ItemType Directory -Path $evidence | Out-Null
}

$presencePath = Join-Path $evidence "source-presence-and-hashes.json"
$manifestPathOut = Join-Path $evidence "manifest-comparison.json"
$summaryPath = Join-Path $evidence "recovery-gate-summary.json"

function Invoke-GateScript {
    param(
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    $output = @(& powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
    $joined = ($output | ForEach-Object { "$_" }) -join "`n"
    $parsed = $null
    try { $parsed = $joined | ConvertFrom-Json -ErrorAction Stop } catch {}
    [pscustomobject]@{
        Script = Split-Path -Leaf $ScriptPath
        ExitCode = $exitCode
        ParsedJson = $parsed
        RawOutput = $joined
    }
}

$presence = Invoke-GateScript -ScriptPath $presenceValidator -Arguments @(
    "-SourceRoot", $source,
    "-ExpectedManifestPath", $manifest,
    "-ReportPath", $presencePath
)
$comparison = Invoke-GateScript -ScriptPath $manifestComparer -Arguments @(
    "-SourceRoot", $source,
    "-ManifestPath", $manifest,
    "-ReportPath", $manifestPathOut
)

$overall = if ($presence.ExitCode -eq 0 -and $comparison.ExitCode -eq 0 -and
    $comparison.ParsedJson -and $comparison.ParsedJson.Status -eq "PASS_MANIFEST_HASHES_MATCH") {
    "PASS_SOURCE_PRESENCE_AND_MANIFEST_HASHES"
} else {
    "BLOCKED_OR_FAILED_REVIEW_REPORTS"
}

$summary = [pscustomobject]@{
    Status = $overall
    CheckedAtUtc = [DateTime]::UtcNow.ToString("o")
    SourceRoot = $source
    ManifestPath = $manifest
    EvidenceDirectory = $evidence
    PresenceValidatorExitCode = $presence.ExitCode
    ManifestComparerExitCode = $comparison.ExitCode
    PresenceReport = $presencePath
    ManifestComparisonReport = $manifestPathOut
    PresenceRawOutput = $presence.RawOutput
    ManifestComparisonRawOutput = $comparison.RawOutput
    Safety = @(
        "No source files were changed by this runner or its two read-only validators.",
        "No Git operations, uploads, network calls, merges, or deployments were performed.",
        "A passing hash comparison does not prove provenance unless the manifest is trusted.",
        "This gate does not run TypeScript, Vite build, gameplay tests, or live runtime proof."
    )
}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$summary | ConvertTo-Json -Depth 8
Write-Output "Evidence summary saved to: $summaryPath"
if ($overall -ne "PASS_SOURCE_PRESENCE_AND_MANIFEST_HASHES") { exit 2 }
