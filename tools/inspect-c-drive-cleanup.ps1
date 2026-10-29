param([string]$ReportDirectory='D:\mumumetro\reports\2026-10-25\c-drive-cleanup')
$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Force -Path $ReportDirectory | Out-Null
function Measure-Tree([IO.FileSystemInfo]$Entry) {
    $bytes=[long]0; $files=0; $directories=0; $reparse=0; $errors=0; $newest=$Entry.LastWriteTimeUtc
    $stack=[Collections.Generic.Stack[IO.FileSystemInfo]]::new(); $stack.Push($Entry)
    while($stack.Count) {
        $item=$stack.Pop()
        if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){$reparse++;continue}
        if($item.LastWriteTimeUtc -gt $newest){$newest=$item.LastWriteTimeUtc}
        if($item -is [IO.DirectoryInfo]) {
            $directories++
            try {foreach($child in $item.EnumerateFileSystemInfos()){$stack.Push($child)}} catch {$errors++}
        } else {$bytes+=$item.Length;$files++}
    }
    [pscustomobject]@{path=$Entry.FullName;directory=($Entry -is [IO.DirectoryInfo]);bytes=$bytes;files=$files;directories=$directories;reparse=$reparse;errors=$errors;newestUtc=$newest.ToString('o')}
}
$roots=@(
    [pscustomobject]@{kind='temp';path=$env:TEMP},
    [pscustomobject]@{kind='npm-download-cache';path=(Join-Path $env:LOCALAPPDATA 'npm-cache')},
    [pscustomobject]@{kind='pip-download-cache';path=(Join-Path $env:LOCALAPPDATA 'pip\Cache')},
    [pscustomobject]@{kind='protected-runtime-model-cache';path=(Join-Path $env:USERPROFILE '.cache')}
)
$rows=[Collections.Generic.List[object]]::new()
foreach($root in $roots){
    if(!(Test-Path -LiteralPath $root.path)){continue}
    $resolved=(Resolve-Path -LiteralPath $root.path).ProviderPath
    foreach($entry in (Get-Item -LiteralPath $resolved).EnumerateFileSystemInfos()){
        $stats=Measure-Tree $entry;$stats|Add-Member -NotePropertyName kind -NotePropertyValue $root.kind;$rows.Add($stats)
    }
    Write-Output ('SCANNED '+$root.kind)
}
$processes=@(Get-CimInstance Win32_Process)
$active=@($processes | Where-Object {$_.CommandLine -match 'playwright_(?:chromiumdev_profile|artifacts)|playwright[-_]profile|scoped_dir'} | ForEach-Object {
    $cmd=$_.CommandLine
    foreach($row in $rows){if($cmd -and $cmd.IndexOf($row.path,[StringComparison]::OrdinalIgnoreCase) -ge 0){[pscustomobject]@{pid=$_.ProcessId;name=$_.Name;path=$row.path}}}
})
$out=[ordered]@{createdUtc=[DateTime]::UtcNow.ToString('o');freeC=(Get-PSDrive -Name C).Free;entries=@($rows.ToArray());active=$active}
$out|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $ReportDirectory 'inventory.json') -Encoding utf8
foreach($group in ($rows|Group-Object kind)){
    Write-Output ('TOTAL {0}: {1} entries / {2:N2} GiB' -f $group.Name,$group.Count,(($group.Group|Measure-Object bytes -Sum).Sum/1GB))
    $group.Group|Sort-Object bytes -Descending|Select-Object -First 12 path,bytes,files,newestUtc,reparse,errors|ConvertTo-Json -Depth 3
}
Write-Output ('ACTIVE_TEMP_PATHS '+$active.Count)
