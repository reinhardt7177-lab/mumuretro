param([string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot '../reports/2026-09-20/unity-meadow' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/Windows/MumuPlanet.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build the Unity Windows player first.' }
$arguments = '-batchmode -screen-width 1440 -screen-height 900 -mumu-meadow-smoke "{0}" -logFile "{0}/player.log"' -f $OutputDirectory
$task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
if (-not $task.WaitForExit(120000)) {
    Stop-Process -Id $task.Id
    throw 'Meadow validation timed out; stopped its own player.'
}
if ($task.ExitCode -ne 0) { throw "Meadow validation failed: $OutputDirectory/player.log" }
$result = Get-Content -LiteralPath (Join-Path $OutputDirectory 'result.json') -Raw | ConvertFrom-Json
if (-not $result.passed) { throw $result.error }
$result
