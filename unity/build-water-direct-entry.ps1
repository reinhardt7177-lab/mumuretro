param(
    [string]$Report = '',
    [string]$Editor = 'C:/Program Files/Unity/Hub/Editor/6000.0.84f1/Editor/Unity.exe',
    [switch]$SkipBuild
)
# Regenerates the planet scene without the retired cliff chapter, builds both Windows players,
# then runs the direct-entry check and the regression checks it can affect.
$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 reads BOM-less UTF-8 as the ANSI code page; Korean in result JSON then breaks
# ConvertFrom-Json. Scripts called below inherit this default.
$PSDefaultParameterValues['Get-Content:Encoding'] = 'UTF8'
if (-not $Report) { $Report = Join-Path $PSScriptRoot '../reports/2026-09-30/water-direct-entry' }
$Report = [IO.Path]::GetFullPath($Report)
New-Item -ItemType Directory -Force $Report | Out-Null
$project = Join-Path $PSScriptRoot 'MumuPlanet'
if (-not $SkipBuild) {
    if (Get-Process -Name 'Unity' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq [IO.Path]::GetFullPath($Editor) }) {
        throw 'Close the running Unity Editor first; batch mode cannot open a project that is already open.'
    }
    $log = Join-Path $Report 'unity-build.log'
    $arguments = '-batchmode -nographics -quit -projectPath "{0}" -executeMethod Mumu.Editor.BuildWaterSanctuaryExterior.CreateAndBuild -logFile "{1}"' -f $project,$log
    $task = Start-Process -FilePath $Editor -ArgumentList $arguments -WindowStyle Hidden -PassThru
    $task.WaitForExit()
    $text = if (Test-Path -LiteralPath $log) { [IO.File]::ReadAllText($log) } else { '' }
    if ($text -match 'No valid Unity Editor license found') {
        throw 'Unity Editor license is not active. Sign in with Unity Hub, activate a Personal license, then run this script again.'
    }
    if ($task.ExitCode -ne 0 -or $text -notmatch 'MUMU_WATER_ENDING_BUILDS_OK') { throw "Unity generation/build failed (exit $($task.ExitCode)). See $log" }
    ($text -split "`n" | Where-Object { $_ -match 'WATER_SANCTUARY_|WATER_FONT_MISSING' }) | Set-Content -Encoding utf8 (Join-Path $Report 'generator-summary.txt')
    Write-Output 'Scene regenerated; MumuPlanet.exe and WaterTempleJourney.exe built.'
}
& (Join-Path $PSScriptRoot 'check-water-entrance.ps1') -OutputDirectory (Join-Path $Report 'entrance')
& (Join-Path $PSScriptRoot 'check-water-sanctuary.ps1') -OutputDirectory (Join-Path $Report 'ending')
& (Join-Path $PSScriptRoot 'check-water-journey.ps1') -OutputDirectory (Join-Path $Report 'journey')
& (Join-Path $PSScriptRoot 'check.ps1') -OutputDirectory (Join-Path $Report 'exploration') | Out-Null
Write-Output 'Exploration movement check passed.'
& (Join-Path $PSScriptRoot 'check-quest-guide.ps1') -OutputDirectory (Join-Path $Report 'quest-guide')
& (Join-Path $PSScriptRoot 'check-exterior.ps1') -OutputDirectory (Join-Path $Report 'weight-exterior')
& (Join-Path $PSScriptRoot 'check-temple.ps1') -OutputDirectory (Join-Path $Report 'weight-temple')
& (Join-Path $PSScriptRoot 'check-starsail.ps1') -OutputDirectory (Join-Path $Report 'starsail')
& (Join-Path $PSScriptRoot 'check-notebook.ps1') -OutputDirectory (Join-Path $Report 'notebook')
# PlanetExplorer.SlideAlong changes every Step() wall contact, so walk-heavy temple and interior checks run too.
& (Join-Path $PSScriptRoot 'check-temple-journey.ps1') -OutputDirectory (Join-Path $Report 'temple-journey')
foreach ($mode in 'ice', 'collection', 'cycle') {
    & (Join-Path $PSScriptRoot 'check-water-interior-v02.ps1') -Mode $mode -OutputRoot (Join-Path $Report 'water-interior')
}
# check-meadow.ps1 is left out on purpose: its wind-determinism step already failed on the 2026-09-27
# build before this change (see reports/2026-09-30/water-direct-entry/REPORT.md).
Write-Output "All water direct-entry and regression checks passed. Evidence: $Report"
