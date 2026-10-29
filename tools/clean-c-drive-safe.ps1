param(
    [switch]$Apply,
    [switch]$UsePlan,
    [switch]$IncludeExtendedCaches,
    [switch]$IncludeBrowserRemainderCaches,
    [switch]$IncludeScopedBrowserCaches,
    [string]$ReportDirectory='D:\mumumetro\reports\2026-10-25\c-drive-cleanup'
)
$ErrorActionPreference='Stop'
$workspace=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$report=[IO.Path]::GetFullPath($ReportDirectory)
if(!$report.StartsWith((Join-Path $workspace 'reports')+'\',[StringComparison]::OrdinalIgnoreCase)){
    throw 'Cleanup reports must remain inside the project reports directory'
}
$inventory=Get-Content -LiteralPath (Join-Path $report 'inventory.json') -Raw|ConvertFrom-Json
$tempRoot=(Get-Item -LiteralPath $env:TEMP).FullName.TrimEnd('\')
$npmRoot=(Get-Item -LiteralPath (Join-Path $env:LOCALAPPDATA 'npm-cache')).FullName.TrimEnd('\')
$pipRoot=(Get-Item -LiteralPath (Join-Path $env:LOCALAPPDATA 'pip\Cache')).FullName.TrimEnd('\')
$allowedRoots=@($tempRoot,$npmRoot,$pipRoot)
$processes=@(Get-CimInstance Win32_Process)
$processCommands=($processes|ForEach-Object {$_.CommandLine}) -join "`n"
$cutoff=[DateTime]::UtcNow.AddHours(-1);$old=[DateTime]::UtcNow.AddDays(-1)
$browserCacheCutoff=[DateTime]::UtcNow.AddHours(-4)
if($IncludeBrowserRemainderCaches -and !$IncludeExtendedCaches){throw 'Browser remainder caches require IncludeExtendedCaches'}
if($IncludeScopedBrowserCaches -and !$IncludeExtendedCaches){throw 'Scoped browser caches require IncludeExtendedCaches'}
$targets=[Collections.Generic.List[object]]::new();$skipped=[Collections.Generic.List[object]]::new()
function Check-Path([string]$Path) {
    $full=[IO.Path]::GetFullPath($Path)
    $root=$allowedRoots|Where-Object {$full.StartsWith($_+'\',[StringComparison]::OrdinalIgnoreCase)}|Select-Object -First 1
    if(!$root -or $full -notlike 'C:\*'){throw 'Deletion target is outside the explicit C-drive cache roots'}
    $resolved=(Resolve-Path -LiteralPath $full).ProviderPath
    if(![string]::Equals($resolved,$full,[StringComparison]::OrdinalIgnoreCase)){throw 'Resolved target differs from the inspected path'}
    $parent=Get-Item -LiteralPath $resolved -Force
    while($parent.FullName -ne $root){if($parent.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse path rejected'};$parent=Get-Item -LiteralPath ([IO.Directory]::GetParent($parent.FullName).FullName) -Force}
    return $resolved
}
function Is-Active([string]$Path) {
    $leaf=[IO.Path]::GetFileName($Path)
    return $processCommands.IndexOf($Path,[StringComparison]::OrdinalIgnoreCase) -ge 0 -or ($leaf.Length -gt 6 -and $processCommands.IndexOf($leaf,[StringComparison]::OrdinalIgnoreCase) -ge 0)
}
function Target-Stats([string]$Path) {
    $first=[IO.FileInfo]::new($Path);if([IO.Directory]::Exists($Path)){$first=[IO.DirectoryInfo]::new($Path)}
    $stack=[Collections.Generic.Stack[IO.FileSystemInfo]]::new();$stack.Push($first)
    $bytes=[long]0;$files=0;$reparse=0;$errors=0;$newest=$first.LastWriteTimeUtc
    while($stack.Count){
        $item=$stack.Pop()
        if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){$reparse++;continue}
        if($item.LastWriteTimeUtc -gt $newest){$newest=$item.LastWriteTimeUtc}
        if($item -is [IO.DirectoryInfo]){try{foreach($child in $item.EnumerateFileSystemInfos()){$stack.Push($child)}}catch{$errors++}}
        else{$bytes+=$item.Length;$files++}
    }
    [pscustomobject]@{bytes=$bytes;files=$files;newest=$newest;reparse=$reparse;errors=$errors}
}
function Add-Target([string]$Path,[string]$Reason,[DateTime]$AgeLimit) {
    if(!(Test-Path -LiteralPath $Path)){return}
    $resolved=Check-Path $Path;$item=Get-Item -LiteralPath $resolved -Force
    if(Is-Active $resolved){$skipped.Add([pscustomobject]@{path=$resolved;reason='active process'});return}
    if($item.LastWriteTimeUtc -gt $AgeLimit){$skipped.Add([pscustomobject]@{path=$resolved;reason='recently modified root'});return}
    $stats=Target-Stats $resolved
    if($stats.reparse -or $stats.errors){$skipped.Add([pscustomobject]@{path=$resolved;reason='reparse or inaccessible entry'});return}
    if($stats.newest -gt $AgeLimit){$skipped.Add([pscustomobject]@{path=$resolved;reason='recently modified contents'});return}
    $targets.Add([pscustomobject]@{path=$resolved;reason=$Reason;directory=[bool]$item.PSIsContainer;files=$stats.files;bytes=$stats.bytes;newestUtc=$stats.newest.ToString('o')})
}
if($UsePlan){
    if(!$Apply){throw 'UsePlan requires Apply'}
    $plan=Get-Content -LiteralPath (Join-Path $report 'plan.json') -Raw|ConvertFrom-Json
    if(([DateTime]$plan.createdUtc).ToUniversalTime() -lt [DateTime]::UtcNow.AddHours(-1)){throw 'Cleanup plan expired'}
    foreach($entry in $plan.targets){$targets.Add($entry)}
    foreach($entry in $plan.skipped){$skipped.Add($entry)}
}else{
foreach($row in $inventory.entries){
    if($row.reparse -or $row.errors){continue};$name=[IO.Path]::GetFileName($row.path)
    if($row.kind -eq 'npm-download-cache' -and $name -in @('_cacache','_prebuilds')){Add-Target $row.path 'Regenerable npm download cache; installed node_modules preserved' $cutoff}
    if($row.kind -eq 'pip-download-cache' -and $name -in @('http-v2','wheels','selfcheck')){Add-Target $row.path 'Regenerable pip download cache; installed environments preserved' $cutoff}
    if($row.kind -eq 'temp'){
        if($name -match '^playwright_(?:chromiumdev_profile|firefoxdev_profile|webkitdev_profile|artifacts)-'){Add-Target $row.path 'Inactive temporary Playwright test profile/artifacts' $cutoff}
        elseif($row.directory -and $name -match '^\.tmp[A-Za-z0-9]{6}$' -and $row.files -eq 0){Add-Target $row.path 'Old empty generated temporary directory; no contents to preserve' $old}
        elseif(!$row.directory -and $name -match '^[a-f0-9-]{36}\.tmp\.js$'){Add-Target $row.path 'Old generated JavaScript helper, not referenced by a running process' $old}
        elseif($name -match '^blender_[a-z0-9]+$'){
            $items=@(Get-ChildItem -LiteralPath $row.path -Recurse -File -Force)
            if($items.Count -and !@($items|Where-Object {$_.Name -notmatch '^cycles-tile-buffer-[a-z0-9-]+\.exr$'}).Count){Add-Target $row.path 'Old Blender Cycles intermediate tile buffers; no blend source or final render' $old}
        }
        if($IncludeExtendedCaches -and $row.directory -and !(Is-Active $row.path)){
            $isScopedBrowser=$IncludeScopedBrowserCaches -and $name -match '^scoped_dir[0-9]+_[0-9]+$'
            if($name -match '^Headless(?:Chrome|Edge)[0-9]+$' -or ($IncludeBrowserRemainderCaches -and $name -match '^(?:mumu-agent-ui|mumu-valley-app|mumu-cloud)-[A-Za-z0-9]{6}$') -or $isScopedBrowser){
                # Remove only downloaded spelling dictionaries. These remnants
                # do not contain browser history, login or application storage.
                $dictionaryCutoff=$old
                if($IncludeBrowserRemainderCaches -or $isScopedBrowser){$dictionaryCutoff=$browserCacheCutoff}
                foreach($file in (Get-ChildItem -LiteralPath $row.path -File -Force)){
                    if($file.Extension -eq '.bdic'){Add-Target $file.FullName 'Old headless-browser downloaded spelling dictionary' $dictionaryCutoff}
                }
                if($IncludeBrowserRemainderCaches -or $isScopedBrowser){
                    # Only allow known reproducible cache subtrees. Preserve the
                    # profile, history, cookies, credentials, Local Storage and
                    # IndexedDB even when the temporary profile appears unused.
                    foreach($cache in @('ShaderCache','GrShaderCache','GPUPersistentCache','DawnCache','component_crx_cache','Default\Cache\Cache_Data','Default\Code Cache','Default\GPUCache','Default\DawnGraphiteCache','Default\DawnWebGPUCache')){
                        Add-Target (Join-Path $row.path $cache) 'Inactive temporary-browser rendering/download cache; profile storage preserved' $browserCacheCutoff
                    }
                }
            }
            elseif($name -match '^msedge_chrome_Unpacker_[A-Za-z0-9_]+$|^msedge_url_fetcher_[0-9]+_[0-9]+$'){
                Add-Target $row.path 'Old Edge component download/unpacking staging cache; installed components preserved' $old
            }
            elseif($name -eq 'playwright-transform-cache'){
                Add-Target $row.path 'Regenerable Playwright compiled-test cache; original tests preserved' $cutoff
            }
            elseif($name -eq 'node-compile-cache'){
                foreach($directory in (Get-ChildItem -LiteralPath $row.path -Directory -Force)){
                    if($directory.Name -match '^v[0-9]+\.[0-9]+\.[0-9]+-[A-Za-z0-9-]+$'){
                        Add-Target $directory.FullName 'Inactive Node compiled-code cache; installed packages and source preserved' $cutoff
                    }
                }
            }
        }
    }
}
Write-Output 'PLANNED top-level temporary files and download caches'
$npx=Join-Path $npmRoot '_npx'
if(Test-Path -LiteralPath $npx){foreach($dir in (Get-ChildItem -LiteralPath $npx -Directory -Force)){if($dir.Name -match '^[a-f0-9]+$'){Add-Target $dir.FullName 'Unused npx downloaded package environment; active CLI processes excluded' $old}}}
Write-Output 'PLANNED inactive npx caches'
# Other projects' scratchpads contain source, research and recent work. Preserve
# them in full; the current cleanup does not establish that they are disposable.
$plan=[ordered]@{createdUtc=[DateTime]::UtcNow.ToString('o');apply=[bool]$Apply;extendedCaches=[bool]$IncludeExtendedCaches;browserRemainderCaches=[bool]$IncludeBrowserRemainderCaches;scopedBrowserCaches=[bool]$IncludeScopedBrowserCaches;targets=@($targets.ToArray());skipped=@($skipped.ToArray());count=$targets.Count;files=($targets|Measure-Object files -Sum).Sum;bytes=($targets|Measure-Object bytes -Sum).Sum;preserved=@('D:\mumumetro source/assets/art/reports/saves','actual browser profiles and login/storage','Codex runtimes and model caches','other scratchpad work and downloaded artifacts','active npx package environments')}
$plan|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $report 'plan.json') -Encoding utf8
}
Write-Output ('PLAN {0} targets / {1} files / {2:N2} GiB; {3} active or recent targets skipped' -f $plan.count,$plan.files,($plan.bytes/1GB),$skipped.Count)
$targets|Group-Object reason|ForEach-Object {[pscustomobject]@{Reason=$_.Name;Targets=$_.Count;MiB=[math]::Round((($_.Group|Measure-Object bytes -Sum).Sum/1MB),2)}}|ConvertTo-Json -Depth 3
if(!$Apply){return}
function Runtime-Hashes {
    $hashes=[ordered]@{}
    $files=@(Get-Item -LiteralPath (Join-Path $workspace 'index.html'),(Join-Path $workspace 'fire-trial.html'))
    foreach($directory in @('src','assets','vendor')){
        $files+=@(Get-ChildItem -LiteralPath (Join-Path $workspace $directory) -File -Recurse -Force)
    }
    foreach($file in ($files|Sort-Object FullName)){
        $relative=[IO.Path]::GetRelativePath($workspace,$file.FullName).Replace('\','/')
        $hashes[$relative]=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    }
    return $hashes
}
$before=Runtime-Hashes;$freeBefore=(Get-PSDrive -Name C).Free
$deleted=[Collections.Generic.List[object]]::new();$failed=[Collections.Generic.List[object]]::new()
$targetNumber=0
foreach($target in $targets){
    try{
        $resolved=Check-Path $target.path
        # Refresh process inventory in bounded batches; recheck path/tree/times
        # immediately before each native deletion, including empty directories.
        if(($targetNumber++ % 50) -eq 0){$processes=@(Get-CimInstance Win32_Process);$processCommands=($processes|ForEach-Object {$_.CommandLine}) -join "`n"}
        if(Is-Active $resolved){throw 'Target became active'}
        $stats=Target-Stats $resolved
        if($stats.reparse -or $stats.errors){throw 'Target now contains a reparse or inaccessible entry'}
        $newest=$stats.newest;$bytes=$stats.bytes
        $expectedTime=([DateTime]$target.newestUtc).ToUniversalTime()
        if($newest.ToUniversalTime().Ticks -ne $expectedTime.Ticks -or $bytes -ne $target.bytes){throw 'Target changed since inspection'}
        if($target.directory -and $target.files -eq 0){
            # Never recurse through a formerly empty directory. A new file or
            # subdirectory makes this atomic empty-directory removal fail.
            [IO.Directory]::Delete($resolved,$false)
        }elseif($target.directory){Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction Stop}else{Remove-Item -LiteralPath $resolved -Force -ErrorAction Stop}
        if(Test-Path -LiteralPath $resolved){throw 'Target remains after deletion'}
        $deleted.Add($target)
    }catch{$failed.Add([pscustomobject]@{path=$target.path;reason=$_.Exception.Message})}
}
$after=Runtime-Hashes
$allRuntimeKeys=@(@($before.Keys)+@($after.Keys)|Sort-Object -Unique)
$changed=@($allRuntimeKeys|Where-Object {$before[$_] -ne $after[$_]});$freeAfter=(Get-PSDrive -Name C).Free
$receipt=[ordered]@{finishedUtc=[DateTime]::UtcNow.ToString('o');pass=($changed.Count -eq 0 -and $deleted.Count -gt 0);deletedTargets=$deleted.Count;deletedFiles=($deleted|Measure-Object files -Sum).Sum;deletedLogicalBytes=($deleted|Measure-Object bytes -Sum).Sum;freeBefore=$freeBefore;freeAfter=$freeAfter;freeIncrease=($freeAfter-$freeBefore);protectedRuntimeFiles=$before.Count;changedRuntimeFiles=$changed;deleted=@($deleted.ToArray());skippedOrFailed=@($failed.ToArray());scope='Only explicit C-drive temporary/cache roots; no user app or game/server process terminated; project source/save/browser storage untouched'}
$receipt|ConvertTo-Json -Depth 7|Set-Content -LiteralPath (Join-Path $report 'result.json') -Encoding utf8
Write-Output ('RESULT {0} files / {1:N2} GiB logical removed; C free {2:N2} -> {3:N2} GiB; runtime changed {4}; skipped/failed {5}' -f $receipt.deletedFiles,($receipt.deletedLogicalBytes/1GB),($freeBefore/1GB),($freeAfter/1GB),$changed.Count,$failed.Count)
if($changed.Count){throw 'Protected runtime changed during cleanup'}
if(!$deleted.Count){throw 'No target deleted; inspect skippedOrFailed before reporting cleanup complete'}
