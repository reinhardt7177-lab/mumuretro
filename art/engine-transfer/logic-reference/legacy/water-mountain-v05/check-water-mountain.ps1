param([string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot '../reports/2026-09-23/unity-water-mountain' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/Windows/MumuPlanet.exe'
$profile = Join-Path $OutputDirectory ('isolated-' + [Guid]::NewGuid().ToString('N') + '.json')
$journeyRecord = Join-Path $OutputDirectory ('water-journey-' + [Guid]::NewGuid().ToString('N') + '.json')
$arguments = '-batchmode -screen-width 1440 -screen-height 900 -mumu-water-smoke "{0}" -mumu-progress-file "{1}" -mumu-water-journey-file "{2}" -logFile "{0}/player.log"' -f $OutputDirectory,$profile,$journeyRecord
$task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
if (-not $task.WaitForExit(300000)) { Stop-Process -Id $task.Id; throw 'Water mountain check timed out; only its own player was stopped.' }
if ($task.ExitCode -ne 0) { throw "Water mountain check failed. See $OutputDirectory/player.log" }
$result = Get-Content -LiteralPath (Join-Path $OutputDirectory 'result.json') -Raw | ConvertFrom-Json
if (-not $result.passed) { throw $result.error }
$waterRecord = "$profile.water.json"
if (-not (Test-Path -LiteralPath $waterRecord)) { throw 'The melted water entrance was not saved.' }
$saved = Get-Content -LiteralPath $waterRecord -Raw | ConvertFrom-Json
if ($saved.version -ne 1 -or -not $saved.entranceOpen) { throw 'The local water entrance record is invalid.' }
if (-not (Test-Path -LiteralPath $journeyRecord)) { throw 'Entering the first room did not write its isolated journey record.' }
$journey = Get-Content -LiteralPath $journeyRecord -Raw | ConvertFrom-Json
if ($journey.version -ne 1 -or $journey.room -ne 0 -or $journey.finished) { throw 'The first-room journey record is invalid.' }
Write-Output "Water mountain check passed: $($result.checks.Count) checks"
