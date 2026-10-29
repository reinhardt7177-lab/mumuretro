[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$kiroCommand = Get-Command 'kiro-cli' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
$kiroExecutable = if ($kiroCommand) { $kiroCommand.Source } else { $null }

if (-not $kiroExecutable) {
    $installedPaths = @(
        (Join-Path $env:LOCALAPPDATA 'Kiro-Cli\kiro-cli.exe'),
        'C:\Program Files\Kiro-Cli\kiro-cli.exe'
    )
    foreach ($installedPath in $installedPaths) {
        if (Test-Path -LiteralPath $installedPath -PathType Leaf) {
            $kiroExecutable = $installedPath
            break
        }
    }
}

if (-not $kiroExecutable) {
    throw 'Kiro CLI를 찾지 못했습니다. 설치 후 새 PowerShell 창에서 다시 실행해 주세요.'
}

Push-Location -LiteralPath $projectRoot
try {
    & $kiroExecutable chat --model 'claude-opus-5.5' --effort 'max' --trust-all-tools
    $kiroExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

exit $kiroExitCode
