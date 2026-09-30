param([string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot '../reports/2026-09-20/unity-exploration' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/Windows/MumuPlanet.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Run unity/build.ps1 first.' }
$arguments = '-batchmode -screen-width 1440 -screen-height 900 -mumu-smoke "{0}" -logFile "{0}/player.log"' -f $OutputDirectory
$task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
if (-not $task.WaitForExit(120000)) {
    Stop-Process -Id $task.Id
    throw 'The validation player timed out. Its own process was stopped.'
}
if ($task.ExitCode -ne 0) { throw "Player validation failed. See $OutputDirectory/player.log" }
$result = Get-Content -LiteralPath (Join-Path $OutputDirectory 'result.json') -Raw | ConvertFrom-Json
if (-not $result.passed) { throw $result.error }
$result
