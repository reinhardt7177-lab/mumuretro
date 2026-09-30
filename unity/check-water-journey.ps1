param([string]$OutputDirectory="D:/mumumetro/reports/2026-09-24/water-temple-journey")
$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$save=Join-Path $OutputDirectory ('journey-'+[Guid]::NewGuid().ToString('N')+'.json')
$waterSave=Join-Path $OutputDirectory ('water-approach-'+[Guid]::NewGuid().ToString('N')+'.json')
$exe=Join-Path $PSScriptRoot 'MumuPlanet/Builds/WaterTempleJourney/WaterTempleJourney.exe'
foreach($stage in @('seed','ice-resume','collection-resume','cycle-resume','finished')){
  $log=Join-Path $OutputDirectory ($stage+'.log')
  $result=Join-Path $OutputDirectory ($stage+'.json')
  $p=Start-Process -FilePath $exe -ArgumentList "-batchmode -mumu-water-journey-file `"$save`" -mumu-water-file `"$waterSave`" -mumu-water-journey-smoke $stage `"$OutputDirectory`" -screen-width 960 -screen-height 540 -logFile `"$log`"" -WindowStyle Hidden -PassThru
  if(-not $p.WaitForExit(60000)){Stop-Process -Id $p.Id;throw "Timed out: $stage"}
  if($p.ExitCode -ne 0){throw "Player failed: $stage. See $log"}
  $r=Get-Content $result -Raw | ConvertFrom-Json
  if(-not $r.passed){throw $r.error}
  Write-Output "$stage : $($r.checks.Count) passed"
}
Write-Output "Isolated save: $save"
