param([string]$OutputDirectory = '', [ValidateSet('collection','bracelet','movement')][string]$Mode='collection')
$ErrorActionPreference = 'Stop'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot '../reports/2026-09-24/water-collection-room' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/WaterCollectionRoom/WaterCollectionRoom.exe'
$flag = switch ($Mode) { 'bracelet' { '-mumu-bracelet-smoke' }; 'movement' { '-mumu-smoke' }; default { '-mumu-collection-smoke' } }
$arguments = '-batchmode -screen-width 1440 -screen-height 900 {1} "{0}" -mumu-progress-file "{0}/isolated-progress.json" -logFile "{0}/player.log"' -f $OutputDirectory,$flag
$task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
if (-not $task.WaitForExit(60000)) { Stop-Process -Id $task.Id; throw 'Validation timed out; only its own process stopped.' }
if ($task.ExitCode -ne 0) { throw "Validation exit $($task.ExitCode). See player.log." }
$result = Get-Content -LiteralPath (Join-Path $OutputDirectory 'result.json') -Raw | ConvertFrom-Json
if (-not $result.passed) { throw $result.error }
Write-Output "Validation passed: $Mode at $OutputDirectory"
