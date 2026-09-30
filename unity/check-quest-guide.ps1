param([string]$OutputDirectory = 'D:/mumumetro/reports/2026-09-23/unity-quest-guide')
$ErrorActionPreference = 'Stop'
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$exe = Join-Path $PSScriptRoot 'MumuPlanet/Builds/Windows/MumuPlanet.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build the Unity Windows game first.' }
foreach ($size in @(@(1440,900),@(960,540))) {
    $width = $size[0]; $height = $size[1]
    $folder = Join-Path $OutputDirectory ('{0}x{1}' -f $width,$height)
    New-Item -ItemType Directory -Force $folder | Out-Null
    $intro = Join-Path $folder ('intro-' + [Guid]::NewGuid().ToString('N') + '.json')
    $temple = Join-Path $folder ('temple-' + [Guid]::NewGuid().ToString('N') + '.json')
    $arguments = '-batchmode -screen-width {0} -screen-height {1} -mumu-guide-smoke "{2}" -mumu-intro-file "{3}" -mumu-progress-file "{4}" -logFile "{2}/player.log"' -f $width,$height,$folder,$intro,$temple
    $task = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
    if (-not $task.WaitForExit(180000)) { Stop-Process -Id $task.Id; throw "Guide test timed out at ${width}x${height}." }
    $resultPath = Join-Path $folder 'guide-result.json'
    if (-not (Test-Path -LiteralPath $resultPath)) { throw "Guide result missing at ${width}x${height}." }
    $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    if ($task.ExitCode -ne 0 -or -not $result.passed) { throw $result.error }
    Write-Output "Quest guide ${width}x${height}: $($result.checks.Count) checks passed"
}
