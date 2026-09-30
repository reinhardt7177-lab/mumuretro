param([string]$OutputDirectory='D:/mumumetro/reports/2026-09-27/water-ending',[string]$CompletedSave='',[ValidateRange(30,300)][int]$TimeoutSeconds=180)
$ErrorActionPreference='Stop'
$OutputDirectory=[IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$exe=Join-Path $PSScriptRoot 'MumuPlanet/Builds/WaterTempleJourney/WaterTempleJourney.exe'
$save=if($CompletedSave){[IO.Path]::GetFullPath($CompletedSave)}else{Join-Path $OutputDirectory 'isolated-unused.json'}
$waterSave=Join-Path $OutputDirectory ('water-completion-'+[Guid]::NewGuid().ToString('N')+'.json')
$balanceSave=Join-Path $OutputDirectory ('balance-progress-'+[Guid]::NewGuid().ToString('N')+'.json')
$mode=if($CompletedSave){'-mumu-water-journey-smoke sanctuary-entry'}else{'-mumu-sanctuary-smoke'}
$p=Start-Process -FilePath $exe -ArgumentList "-batchmode $mode `"$OutputDirectory`" -mumu-water-journey-file `"$save`" -mumu-water-file `"$waterSave`" -mumu-progress-file `"$balanceSave`" -screen-width 1440 -screen-height 900 -logFile `"$OutputDirectory/player.log`"" -WindowStyle Hidden -PassThru
# The real ending saves to a fresh record and renders seven deity views plus the returned seal.
if(-not $p.WaitForExit($TimeoutSeconds*1000)){Stop-Process -Id $p.Id;throw 'Sanctuary validation timed out'}
if($p.ExitCode -ne 0){throw "Sanctuary player failed: $OutputDirectory"}
$result=Get-Content "$OutputDirectory/sanctuary-result.json" -Raw | ConvertFrom-Json
if(-not $result.passed){throw $result.error}
if(-not (Test-Path -LiteralPath $waterSave)){throw 'Water completion record was not written'}
foreach($capture in @('sanctuary-entry','deity-audience','deity-review-0','deity-review-90','deity-review-180','deity-review-270','deity-face','water-seal-after-return')){
    if(-not (Test-Path -LiteralPath (Join-Path $OutputDirectory ($capture+'.png')))){throw "Missing runtime capture: $capture"}
}
"sanctuary : $($result.checks.Count) passed"
