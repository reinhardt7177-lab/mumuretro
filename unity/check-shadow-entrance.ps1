param([string]$OutputDirectory = '')
# Moon gate on the planet (ShadowEntranceSmoke): fresh walk-in and round trip, then a sealed record.
$ErrorActionPreference = 'Stop'
$PSDefaultParameterValues['Get-Content:Encoding'] = 'UTF8'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot '../reports/2026-09-30/shadow-temple/entrance' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/Windows/MumuPlanet.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build the Windows player first.' }
foreach ($mode in 'fresh', 'sealed') {
    $folder = Join-Path $OutputDirectory $mode
    Remove-Item -LiteralPath $folder -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force $folder | Out-Null
    $profile = Join-Path $folder ('isolated-' + [Guid]::NewGuid().ToString('N') + '.json')
    $intro = Join-Path $folder 'isolated-intro.json'
    $journey = Join-Path $folder 'isolated-journey.json'
    if ($mode -eq 'sealed') {
        [IO.File]::WriteAllText($profile + '.shadow.json', '{"version":1,"entranceOpen":true,"completed":true}', (New-Object Text.UTF8Encoding($false)))
    }
    $arguments = '-batchmode -screen-width 1440 -screen-height 900 -mumu-shadow-entrance-smoke "{0}" -mumu-shadow-entrance-mode {1} -mumu-progress-file "{2}" -mumu-intro-file "{3}" -mumu-journey-file "{4}" -logFile "{0}/player.log"' -f $folder, $mode, $profile, $intro, $journey
    $task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
    if (-not $task.WaitForExit(240000)) { Stop-Process -Id $task.Id; throw "Moon gate $mode timed out; only its own player was stopped." }
    $resultPath = Join-Path $folder 'result.json'
    if (-not (Test-Path -LiteralPath $resultPath)) { throw "Moon gate $mode wrote no result (exit $($task.ExitCode))." }
    $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    if ($task.ExitCode -ne 0 -or -not $result.passed) { throw "Moon gate $mode failed: $($result.error)" }
    if ($mode -eq 'fresh') {
        $approach = Get-Content -LiteralPath ($profile + '.shadow.json') -Raw | ConvertFrom-Json
        if (-not $approach.entranceOpen -or $approach.completed) { throw 'Fresh round trip should record a visit only.' }
    }
    "Moon gate ${mode}: $($result.checks.Count) checks passed"
}
