param(
    [string]$Editor = 'C:/Program Files/Unity/Hub/Editor/6000.0.84f1/Editor/Unity.exe'
)
$ErrorActionPreference = 'Stop'
$projectPath = Join-Path $PSScriptRoot 'MumuPlanet'
$logDir = Join-Path $projectPath 'Logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
foreach ($step in @(@('BuildExploration.Create','scene.log','-quit'),@('BuildWeightTemple.RunBatch','windows-build.log',''))) {
    $logPath = Join-Path $logDir $step[1]
    $arguments = '-batchmode {3} -projectPath "{0}" -executeMethod Mumu.Editor.{1} -logFile "{2}"' -f $projectPath,$step[0],$logPath,$step[2]
    $task = Start-Process -FilePath $Editor -ArgumentList $arguments -WindowStyle Hidden -PassThru
    $task.WaitForExit()
    if ($task.ExitCode -ne 0) { throw "Unity failed: $($step[0]); see $logPath" }
}
Write-Output (Join-Path $projectPath 'Builds/Windows/MumuPlanet.exe')
