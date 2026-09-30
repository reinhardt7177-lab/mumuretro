param([ValidateSet('ice','collection','cycle')][string]$Mode='ice',[string]$OutputRoot='')
$ErrorActionPreference='Stop'
$out=Join-Path $PSScriptRoot "../reports/2026-09-24/water-interior-v02/$Mode"
if($OutputRoot){$out=Join-Path $OutputRoot $Mode}
$out=[IO.Path]::GetFullPath($out);New-Item -ItemType Directory -Force $out | Out-Null
$exe=Join-Path $PSScriptRoot 'MumuPlanet/Builds/WaterTempleJourney/WaterTempleJourney.exe'
$p=Start-Process -FilePath $exe -ArgumentList "-batchmode -mumu-$Mode-smoke `"$out`" -mumu-water-journey-file `"$out/isolated-unused.json`" -screen-width 1440 -screen-height 900 -logFile `"$out/player.log`"" -WindowStyle Hidden -PassThru
if(-not $p.WaitForExit(60000)){Stop-Process -Id $p.Id;throw 'Game validation timed out'}
if($p.ExitCode -ne 0){throw "Validation player failed: $out"}
$r=Get-Content "$out/result.json" -Raw | ConvertFrom-Json
if(-not $r.passed){throw $r.error}
"$Mode : $($r.checks.Count) passed"
