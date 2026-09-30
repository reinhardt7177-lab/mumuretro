param([string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot '../reports/2026-09-30/water-direct-entry/entrance' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/Windows/MumuPlanet.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build the Unity Windows game first.' }
# fresh: no water record. visited: thaw record left by the retired cliff chapter. unreadable: damaged record.
$cases = @(
    @{ Name = 'fresh'; Record = $null },
    @{ Name = 'visited'; Record = '{"version":1,"entranceOpen":true,"completed":false}' },
    @{ Name = 'unreadable'; Record = '{broken' }
)
foreach ($case in $cases) {
    $folder = Join-Path $OutputDirectory $case.Name
    New-Item -ItemType Directory -Force $folder | Out-Null
    $profile = Join-Path $folder ('isolated-' + [Guid]::NewGuid().ToString('N') + '.json')
    $waterRecord = "$profile.water.json"
    $journeyRecord = Join-Path $folder ('water-journey-' + [Guid]::NewGuid().ToString('N') + '.json')
    if ($case.Record) { [IO.File]::WriteAllText($waterRecord, $case.Record) }
    $arguments = '-batchmode -screen-width 1440 -screen-height 900 -mumu-water-entrance-smoke "{0}" -mumu-water-entrance-mode {1} -mumu-progress-file "{2}" -mumu-water-journey-file "{3}" -logFile "{0}/player.log"' -f $folder,$case.Name,$profile,$journeyRecord
    $task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
    if (-not $task.WaitForExit(300000)) { Stop-Process -Id $task.Id; throw "Water entrance check timed out ($($case.Name)); only its own player was stopped." }
    $resultPath = Join-Path $folder 'result.json'
    if (-not (Test-Path -LiteralPath $resultPath)) { throw "Result missing ($($case.Name)). See $folder/player.log" }
    $result = Get-Content -LiteralPath $resultPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($task.ExitCode -ne 0 -or -not $result.passed) { throw "$($case.Name): $($result.error)" }
    # Independent file checks, outside the game process.
    if (-not (Test-Path -LiteralPath $journeyRecord)) { throw "$($case.Name): entering did not write the isolated journey record." }
    $journey = Get-Content -LiteralPath $journeyRecord -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($journey.version -ne 1 -or $journey.room -ne 0 -or $journey.finished) { throw "$($case.Name): first-room journey record is invalid." }
    if ($case.Record) {
        if ([IO.File]::ReadAllText($waterRecord) -ne $case.Record) { throw "$($case.Name): the existing water record was rewritten." }
    } else {
        $saved = Get-Content -LiteralPath $waterRecord -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($saved.version -ne 1 -or -not $saved.entranceOpen -or $saved.completed) { throw 'fresh: first entry did not record the visit correctly.' }
    }
    Write-Output "Water entrance $($case.Name): $($result.checks.Count) checks passed"
}
