param([string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot '../reports/2026-09-21/unity-temple-exterior' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/Windows/MumuPlanet.exe'
$profile = Join-Path $OutputDirectory ('uncompleted-' + [Guid]::NewGuid().ToString('N') + '.json')
$arguments = '-batchmode -screen-width 1440 -screen-height 900 -mumu-exterior-smoke "{0}" -mumu-progress-file "{1}" -logFile "{0}/player.log"' -f $OutputDirectory,$profile
$task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
if (-not $task.WaitForExit(300000)) { Stop-Process -Id $task.Id; throw 'Exterior validation timed out; only its own player was stopped.' }
if ($task.ExitCode -ne 0) { throw "Exterior validation failed. See $OutputDirectory/player.log" }
$result = Get-Content -LiteralPath (Join-Path $OutputDirectory 'result.json') -Raw | ConvertFrom-Json
if (-not $result.passed) { throw $result.error }
Write-Output "Exterior validation passed: $($result.checks.Count) checks"
