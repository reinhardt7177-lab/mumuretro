param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$prefix = $root + '\'
$report = Join-Path $root 'reports\2026-10-24\cleanup-verification'
$plan = @(Get-Content -LiteralPath (Join-Path $report 'candidates.json') -Raw | ConvertFrom-Json)
$tracked = @(git -C $root ls-files)
$targets = @()
foreach ($entry in $plan) {
    $path = [IO.Path]::GetFullPath((Join-Path $root $entry.relative))
    if (!$path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path outside workspace' }
    if ($entry.relative -notmatch '^reports/[^/]+/evidence/.+\.(log|png)$|^tools/(.+/)?__pycache__/[^/]+\.pyc$') { throw "Unexpected candidate: $($entry.relative)" }
    if ($tracked -contains $entry.relative) { throw "Tracked candidate: $($entry.relative)" }
    $item = Get-Item -LiteralPath $path
    if ($item.PSIsContainer) { throw 'Only individual files are allowed' }
    $parent = $item
    while ($parent.FullName -ne $root) {
        if ($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse point rejected' }
        $parent = Get-Item -LiteralPath ([IO.Directory]::GetParent($parent.FullName).FullName)
    }
    if ($item.LastWriteTime -gt (Get-Date).AddHours(-1)) { continue }
    if ($item.Length -ne $entry.bytes) { throw "File changed: $($entry.relative)" }
    $targets += [pscustomobject]@{path=$path; relative=$entry.relative; bytes=$item.Length; reason=$entry.reason; sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash}
}
$targets | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $report 'selected.json') -Encoding utf8
Write-Output ("SELECTED {0} files / {1:N2} MiB" -f $targets.Count,(($targets | Measure-Object bytes -Sum).Sum / 1MB))
if (!$Apply) { return }
function Get-ProtectedHashes {
    $hashes = @{}
    foreach ($dir in @('src','assets','vendor','art','server','tools')) {
        Get-ChildItem -LiteralPath (Join-Path $root $dir) -Recurse -File | Where-Object { $_.FullName -notmatch '\\__pycache__\\' } | ForEach-Object {
            $hashes[$_.FullName] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        }
    }
    return $hashes
}
$before = Get-ProtectedHashes
$deleted = @()
foreach ($target in $targets) {
    if ((Get-FileHash -LiteralPath $target.path -Algorithm SHA256).Hash -ne $target.sha256) { throw 'Candidate changed before deletion' }
    Remove-Item -LiteralPath $target.path -Force
    $deleted += $target
    $deleted | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $report 'deleted.json') -Encoding utf8
}
$after = Get-ProtectedHashes
$changes = @($before.Keys | Where-Object { $after[$_] -ne $before[$_] })
$result = [ordered]@{createdAt=(Get-Date).ToString('o');files=$deleted.Count;bytes=($deleted | Measure-Object bytes -Sum).Sum;protectedFiles=$before.Count;changedProtectedFiles=$changes;remainingDeletedPaths=@($deleted | Where-Object { Test-Path -LiteralPath $_.path } | ForEach-Object { $_.relative })}
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $report 'result.json') -Encoding utf8
$result | ConvertTo-Json -Depth 4
if ($changes.Count -or $result.remainingDeletedPaths.Count) { throw 'Post-cleanup verification failed' }
