param([string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot '../reports/2026-09-23/unity-temple-journey' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/Windows/MumuPlanet.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build the Unity player first.' }
$ship = '{"version":1,"recovered":true,"opened":true,"read":true,"solved":true,"departed":true,"dials":[3,5,8]}'
$cases = @(
    @{ Name='weight'; Scene='WeightTemple'; Count=4; Pivot=2; Locations=@(0,-1,5,-1); X=@(-2,0,2,3); Z=@(-4.8,-4.8,-4.8,-4.8) },
    @{ Name='twin'; Scene='TwinBalanceTemple'; Count=4; Pivot=2; Locations=@(0,-1,2,-1); X=@(-2,0,2,3); Z=@(-4.8,-4.8,-4.8,-4.8) },
    @{ Name='lever'; Scene='LeverBalanceTemple'; Count=2; Pivot=3; Locations=@(0,4); X=@(-2,2); Z=@(-4.8,-4.8) }
)
foreach ($case in $cases) {
    $dir = Join-Path $OutputDirectory $case.Name
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $journey = Join-Path $dir 'journey.json'
    $intro = Join-Path $dir 'intro.json'
    $completion = Join-Path $dir 'completion.json'
    $fixture = [ordered]@{ version=1; active=$true; scene=$case.Scene; count=$case.Count; pivot=$case.Pivot; locations=$case.Locations; floorX=$case.X; floorZ=$case.Z }
    [IO.File]::WriteAllText($journey,($fixture | ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($intro,$ship,[Text.UTF8Encoding]::new($false))
    foreach ($phase in @('first','reload')) {
        $runDir = Join-Path $dir $phase
        New-Item -ItemType Directory -Force -Path $runDir | Out-Null
        $arguments = '-batchmode -screen-width 1440 -screen-height 900 -mumu-journey-smoke "{0}" -mumu-journey-file "{1}" -mumu-progress-file "{2}" -mumu-intro-file "{3}" -logFile "{0}/player.log"' -f $runDir,$journey,$completion,$intro
        $task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
        if (-not $task.WaitForExit(120000)) { Stop-Process -Id $task.Id; throw "$($case.Name) $phase validation timed out." }
        $resultPath = Join-Path $runDir 'journey-result.json'
        if (-not (Test-Path -LiteralPath $resultPath)) { throw "$($case.Name) $phase did not write a result. See $runDir/player.log" }
        $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
        if ($task.ExitCode -ne 0 -or -not $result.passed) { throw "$($case.Name) $phase failed: $($result.error)" }
        Write-Output "$($case.Name) $phase`: $($result.checks.Count) checks"
    }
}
