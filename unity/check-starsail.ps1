param([string]$OutputDirectory = 'D:/mumumetro/reports/2026-09-23/unity-starsail')
$ErrorActionPreference = 'Stop'
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/Windows/MumuPlanet.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build the Starsail scene first.' }
$isolatedRecord = Join-Path $OutputDirectory 'isolated-completion.json'
$introRecord = Join-Path $OutputDirectory ('isolated-intro-' + [Guid]::NewGuid().ToString('N') + '.json')
$arguments = '-batchmode -screen-width 1440 -screen-height 900 -mumu-ship-smoke "{0}" -mumu-progress-file "{1}" -mumu-intro-file "{2}" -logFile "{0}/player.log"' -f $OutputDirectory,$isolatedRecord,$introRecord
$task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
if (-not $task.WaitForExit(120000)) { Stop-Process -Id $task.Id; throw 'Starsail validation timed out.' }
$resultPath = Join-Path $OutputDirectory 'ship-result.json'
if (-not (Test-Path -LiteralPath $resultPath)) { throw 'Starsail result file missing. See player.log.' }
$result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
if ($task.ExitCode -ne 0 -or -not $result.passed) { throw $result.error }
Write-Output "Starsail opening passed: $($result.checks.Count) checks"
$resumeArguments = '-batchmode -screen-width 1440 -screen-height 900 -mumu-ship-resume-smoke "{0}" -mumu-progress-file "{1}" -mumu-intro-file "{2}" -logFile "{0}/resume-player.log"' -f $OutputDirectory,$isolatedRecord,$introRecord
$resumeTask = Start-Process -FilePath $exe -ArgumentList $resumeArguments -WindowStyle Hidden -PassThru
if (-not $resumeTask.WaitForExit(120000)) { Stop-Process -Id $resumeTask.Id; throw 'Starsail relaunch validation timed out.' }
$resumePath = Join-Path $OutputDirectory 'ship-resume-result.json'
if (-not (Test-Path -LiteralPath $resumePath)) { throw 'Starsail relaunch result file missing. See resume-player.log.' }
$resumeResult = Get-Content -LiteralPath $resumePath -Raw | ConvertFrom-Json
if ($resumeTask.ExitCode -ne 0 -or -not $resumeResult.passed) { throw $resumeResult.error }
Write-Output "Starsail relaunch passed: $($resumeResult.checks.Count) checks"
