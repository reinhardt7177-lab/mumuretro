param([string]$OutputDirectory = '', [ValidateSet('all','full','resume','unreadable','later')][string]$Mode = 'all')
# Shadow temple validation (ShadowTempleSmoke). Every case uses fresh isolated records next to its evidence.
$ErrorActionPreference = 'Stop'
$PSDefaultParameterValues['Get-Content:Encoding'] = 'UTF8'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot '../reports/2026-09-30/shadow-temple/temple' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/Windows/MumuPlanet.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build the Windows player first.' }

function Invoke-Temple([string]$Folder, [string]$Stage, [string]$Profile) {
    New-Item -ItemType Directory -Force $Folder | Out-Null
    $arguments = '-batchmode -screen-width 1440 -screen-height 900 -mumu-shadow-temple-smoke "{0}" -mumu-shadow-temple-mode {1} -mumu-progress-file "{2}" -logFile "{0}/player-{1}.log"' -f $Folder, $Stage, $Profile
    $task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
    if (-not $task.WaitForExit(240000)) { Stop-Process -Id $task.Id; throw "Shadow temple $Stage timed out; only its own player was stopped." }
    $resultPath = Join-Path $Folder 'result.json'
    if (-not (Test-Path -LiteralPath $resultPath)) { throw "Shadow temple $Stage wrote no result (exit $($task.ExitCode)). See $Folder" }
    $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    Copy-Item -LiteralPath $resultPath (Join-Path $Folder "result-$Stage.json") -Force
    if ($task.ExitCode -ne 0 -or -not $result.passed) { throw "Shadow temple $Stage failed: $($result.error)" }
    "Shadow temple ${Stage}: $($result.checks.Count) checks passed"
    return $result
}

if ($Mode -in 'all','full') {
    $folder = Join-Path $OutputDirectory 'full'
    Remove-Item -LiteralPath $folder -Recurse -Force -ErrorAction SilentlyContinue
    $profile = Join-Path $folder ('isolated-' + [Guid]::NewGuid().ToString('N') + '.json')
    $null = Invoke-Temple $folder 'full' $profile
    if (-not (Test-Path -LiteralPath ($profile + '.shadow.json'))) { throw 'Full run did not write the planet completion record.' }
    $approach = Get-Content -LiteralPath ($profile + '.shadow.json') -Raw | ConvertFrom-Json
    if (-not $approach.completed) { throw 'Planet record is not completed after the full run.' }
    'Full run: planet record completed = True'
}
if ($Mode -in 'all','resume','later') {
    $folder = Join-Path $OutputDirectory 'resume'
    Remove-Item -LiteralPath $folder -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force $folder | Out-Null
    $profile = Join-Path $folder ('isolated-' + [Guid]::NewGuid().ToString('N') + '.json')
    $journey = $profile + '.shadow-journey.json'
    $previous = $null
    foreach ($stage in 'stage-a','stage-b','stage-c','stage-d','stage-e') {
        $null = Invoke-Temple $folder $stage $profile
        if (-not (Test-Path -LiteralPath $journey)) { throw "$stage left no journey record." }
        $record = Get-Content -LiteralPath $journey -Raw | ConvertFrom-Json
        Copy-Item -LiteralPath $journey (Join-Path $folder "journey-after-$stage.json") -Force
        if ($previous -ne $null -and $record.seed -ne $previous.seed) { throw "$stage changed the layout seed." }
        "  after ${stage}: stage $($record.stage), active $($record.active), mirrors $($record.mirrors -join ','), round $($record.round)"
        $previous = $record
    }
}
if ($Mode -in 'all','unreadable','later') {
    $folder = Join-Path $OutputDirectory 'unreadable'
    Remove-Item -LiteralPath $folder -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force $folder | Out-Null
    $profile = Join-Path $folder ('isolated-' + [Guid]::NewGuid().ToString('N') + '.json')
    $journey = $profile + '.shadow-journey.json'
    $broken = '{"version":1,"stage":9,"seed":"broken'
    [IO.File]::WriteAllText($journey, $broken, (New-Object Text.UTF8Encoding($false)))
    $null = Invoke-Temple $folder 'unreadable' $profile
    if ([IO.File]::ReadAllText($journey) -ne $broken) { throw 'The unreadable journey record was modified.' }
    'Unreadable record preserved byte for byte'
}
