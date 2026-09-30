param([string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot '../reports/2026-09-24/water-bracelet-lab' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/WaterBraceletLab/WaterBraceletLab.exe'
$arguments = '-batchmode -screen-width 1440 -screen-height 900 -mumu-bracelet-smoke "{0}" -mumu-progress-file "{0}/isolated-progress.json" -logFile "{0}/player.log"' -f $OutputDirectory
$task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
Write-Output "Water bracelet smoke PID: $($task.Id)"
if (-not $task.WaitForExit(60000)) { Stop-Process -Id $task.Id; throw 'Bracelet check exceeded 60 seconds; only its own process was stopped.' }
if ($task.ExitCode -ne 0) { throw "Bracelet player exited with $($task.ExitCode). Check player.log." }
$result = Get-Content -LiteralPath (Join-Path $OutputDirectory 'result.json') -Raw | ConvertFrom-Json
if (-not $result.passed) { throw $result.error }
if (-not (Test-Path -LiteralPath (Join-Path $OutputDirectory 'trial.png'))) { throw 'Trial screenshot is missing.' }
Write-Output "Passed $($result.checks.Count) checks, screenshot saved, clean process exit."
