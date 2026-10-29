param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$prefix = $workspaceRoot + '\'
$reportDir = Join-Path $workspaceRoot 'reports\2026-10-24\cleanup'
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$candidates = [Collections.Generic.List[object]]::new()
function Add-Candidate([string]$relative, [string]$reason) {
    $path = Join-Path $workspaceRoot $relative
    if (!(Test-Path -LiteralPath $path)) { return }
    $resolved = (Resolve-Path -LiteralPath $path).ProviderPath
    if (!$resolved.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Target outside workspace: $relative" }
    $item = Get-Item -LiteralPath $resolved -Force
    $all = if ($item.PSIsContainer) { @(Get-ChildItem -LiteralPath $resolved -Recurse -Force) } else { @($item) }
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or @($all | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw "Reparse point in target: $relative" }
    $files = @($all | Where-Object { !$_.PSIsContainer })
    $bytes = ($files | Measure-Object -Property Length -Sum).Sum
    $candidates.Add([pscustomobject]@{path=$resolved;relative=$relative;reason=$reason;directory=[bool]$item.PSIsContainer;files=$files.Count;bytes=[long]$bytes})
}
# Explicitly reproducible caches/output only. Source worktrees and evidence galleries stay.
if (Test-Path -LiteralPath 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe') {
    Add-Candidate '.integration\blender\runtime\blender-4.5.3-windows-x64' 'Superseded portable Blender runtime; installed Blender 5.2 retained'
}
Add-Candidate '.integration\vercel-cli-cache' 'Re-downloadable npm/npx deployment CLI cache'
Add-Candidate 'dist' 'Generated web build; release manifest preserved and build tool retained'
foreach ($relative in @('tools\__pycache__','tools\blender\__pycache__')) { Add-Candidate $relative 'Regenerable Python bytecode cache' }
if (Test-Path -LiteralPath (Join-Path $workspaceRoot 'tmp')) {
    Get-ChildItem -LiteralPath (Join-Path $workspaceRoot 'tmp') -File -Recurse -Force | Where-Object {
        $_.Extension -in @('.log','.err','.tmp') -or $_.Name -match '-(?:pid|status)\.txt$'
    } | ForEach-Object { Add-Candidate $_.FullName.Substring($prefix.Length) 'Temporary process/build/verification log; final reports preserved' }
    Add-Candidate 'tmp\three-0.160.0.tgz' 'Downloaded package archive; pinned vendor/three and manifest retained'
}
$plan = [ordered]@{createdAt=(Get-Date).ToString('o');workspace=$workspaceRoot;apply=[bool]$Apply;count=$candidates.Count;files=($candidates|Measure-Object files -Sum).Sum;bytes=($candidates|Measure-Object bytes -Sum).Sum;targets=@($candidates.ToArray());preserved=@('src','assets','vendor','art and Blender originals','reports and linked comparison images','test source tools','Git history and both worktrees','save data and credentials')}
$plan | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $reportDir 'plan.json') -Encoding utf8
Write-Output ('PLAN {0} targets / {1} files / {2:N2} GiB' -f $plan.count,$plan.files,($plan.bytes/1GB))
if (!$Apply) { return }
# Refuse to remove output/cache currently named by a Node/Blender process.
$running = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('node.exe','blender.exe') })
foreach ($target in $candidates) {
    foreach ($process in $running) {
        if ($process.CommandLine -and ($process.CommandLine.Replace('/','\').IndexOf($target.path,[StringComparison]::OrdinalIgnoreCase) -ge 0)) { throw "Target in use by process $($process.ProcessId): $($target.relative)" }
    }
}
function Protected-Hashes {
    $result = [ordered]@{}
    foreach ($name in @('src','assets','vendor','art','server','tools')) {
        Get-ChildItem -LiteralPath (Join-Path $workspaceRoot $name) -File -Recurse -Force | Where-Object { $_.FullName -notmatch '[\\/]__pycache__[\\/]' } | ForEach-Object {
            $key=$_.FullName.Substring($prefix.Length).Replace('\','/');$result[$key]=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        }
    }
    foreach ($name in @('index.html','fire-trial.html','AGENTS.md','CLAUDE.md','README.md','SECOND_BRAIN.md','vercel.json','교실서버.cmd')) {
        $result[$name]=(Get-FileHash -LiteralPath (Join-Path $workspaceRoot $name) -Algorithm SHA256).Hash
    }
    return $result
}
$before = Protected-Hashes
$before | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $reportDir 'protected-before.json') -Encoding utf8
$release = Join-Path $workspaceRoot 'dist\assets\release.json'
if (Test-Path -LiteralPath $release) { Copy-Item -LiteralPath $release -Destination (Join-Path $reportDir 'removed-build-release.json') }
$deleted = [Collections.Generic.List[object]]::new()
foreach ($target in $candidates) {
    # Resolve again immediately before a native PowerShell deletion. Never cross shells.
    $resolved=(Resolve-Path -LiteralPath $target.path).ProviderPath
    if (!$resolved.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase) -or $resolved -ne $target.path) { throw 'Resolved deletion target changed' }
    if ($target.directory) { Remove-Item -LiteralPath $resolved -Recurse -Force } else { Remove-Item -LiteralPath $resolved -Force }
    if (Test-Path -LiteralPath $resolved) { throw "Deletion incomplete: $($target.relative)" }
    $deleted.Add($target)
    $deleted.ToArray() | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $reportDir 'deleted.json') -Encoding utf8
}
$after = Protected-Hashes
$changed = @($before.Keys | Where-Object { !$after.Contains($_) -or $before[$_] -ne $after[$_] })
$added = @($after.Keys | Where-Object { !$before.Contains($_) })
$receipt=[ordered]@{pass=($changed.Count -eq 0 -and $added.Count -eq 0);finishedAt=(Get-Date).ToString('o');deletedTargets=$deleted.Count;deletedFiles=($deleted|Measure-Object files -Sum).Sum;freedBytes=($deleted|Measure-Object bytes -Sum).Sum;protectedFiles=$before.Count;changedProtected=$changed;addedProtected=$added;scope='Generated output/caches/temp logs only; full source/assets/art/tests preserved byte-for-byte'}
$receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $reportDir 'result.json') -Encoding utf8
if (!$receipt.pass) { throw 'Protected content changed during cleanup; see receipt' }
Write-Output ('PASS removed {0} files / {1:N2} GiB; {2} protected files unchanged' -f $receipt.deletedFiles,($receipt.freedBytes/1GB),$receipt.protectedFiles)
