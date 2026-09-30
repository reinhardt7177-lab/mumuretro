param([string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot '../reports/2026-09-20/unity-weight-temple' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/Windows/MumuPlanet.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build the Unity player first.' }
$profile = Join-Path $OutputDirectory ('progress-' + [Guid]::NewGuid().ToString('N') + '.json')
$arguments = '-batchmode -screen-width 1440 -screen-height 900 -mumu-temple-smoke "{0}" -mumu-progress-file "{1}" -logFile "{0}/player.log"' -f $OutputDirectory,$profile
$task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
if (-not $task.WaitForExit(240000)) { Stop-Process -Id $task.Id; throw 'Temple validation timed out; only its own player was stopped.' }
if ($task.ExitCode -ne 0) { throw "Temple validation failed. See $OutputDirectory/player.log" }
$result = Get-Content -LiteralPath (Join-Path $OutputDirectory 'result.json') -Raw | ConvertFrom-Json
if (-not $result.passed) { throw $result.error }
Write-Output "Temple validation passed: $($result.checks.Count) checks"
$reloadArgs = '-batchmode -screen-width 1440 -screen-height 900 -mumu-seal-smoke "{0}" -mumu-progress-file "{1}" -logFile "{0}/seal-reload-player.log"' -f $OutputDirectory,$profile
$reload = Start-Process -FilePath $exe -ArgumentList $reloadArgs -WindowStyle Hidden -PassThru
if (-not $reload.WaitForExit(120000)) { Stop-Process -Id $reload.Id; throw 'Seal reload validation timed out.' }
if ($reload.ExitCode -ne 0) { throw 'Seal reload validation failed; inspect seal-reload-player.log.' }
$reloaded = Get-Content -LiteralPath (Join-Path $OutputDirectory 'seal-reload-result.json') -Raw | ConvertFrom-Json
if (-not $reloaded.passed) { throw $reloaded.error }
Write-Output 'Completion save and sealed door passed a separate-process reload.'
