param([string]$OutputDirectory = 'D:/mumumetro/reports/2026-09-21/unity-notebook')
$ErrorActionPreference = 'Stop'
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/Windows/MumuPlanet.exe'
foreach ($state in @('uncompleted','completed','wide')) {
    $directory = Join-Path $OutputDirectory $state
    New-Item -ItemType Directory -Force $directory | Out-Null
    $profile = Join-Path $directory ('profile-' + [guid]::NewGuid().ToString('N') + '.json')
    if ($state -ne 'uncompleted') { [IO.File]::WriteAllText($profile,'{"version":1,"balanceCompleted":true,"lesson":"fixture"}') }
    $width = if ($state -eq 'completed') { 960 } elseif ($state -eq 'wide') {1920} else { 1440 }
    $height = if ($state -eq 'completed') { 540 } elseif ($state -eq 'wide') {868} else { 900 }
    $arguments = '-batchmode -screen-width {0} -screen-height {1} -mumu-notebook-smoke "{2}" -mumu-progress-file "{3}" -logFile "{2}/player.log"' -f $width,$height,$directory,$profile
    $task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
    if (-not $task.WaitForExit(180000)) { Stop-Process -Id $task.Id; throw 'Notebook validation timed out.' }
    $result = Get-Content -LiteralPath (Join-Path $directory 'notebook-result.json') -Raw | ConvertFrom-Json
    if ($task.ExitCode -ne 0 -or -not $result.passed) { throw $result.error }
    Write-Output "Notebook $state validation passed: $($result.checks.Count) checks at ${width}x${height}"
}
