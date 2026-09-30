param([string]$OutputDirectory = '', [switch]$MovementRegression)
$ErrorActionPreference = 'Stop'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot '../reports/2026-09-24/water-ice-room' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/WaterIceRoom/WaterIceRoom.exe'
$flag = if ($MovementRegression) { '-mumu-smoke' } else { '-mumu-ice-smoke' }
$arguments = '-batchmode -screen-width 1440 -screen-height 900 {1} "{0}" -mumu-progress-file "{0}/isolated-progress.json" -logFile "{0}/player.log"' -f $OutputDirectory,$flag
$task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
if (-not $task.WaitForExit(60000)) { Stop-Process -Id $task.Id; throw 'Validation timeout; only its own process stopped.' }
if ($task.ExitCode -ne 0) { throw "Validation exited with $($task.ExitCode). See player.log." }
$result = Get-Content -LiteralPath (Join-Path $OutputDirectory 'result.json') -Raw | ConvertFrom-Json
if (-not $result.passed) { throw $result.error }
Write-Output "Validation passed: $OutputDirectory"
