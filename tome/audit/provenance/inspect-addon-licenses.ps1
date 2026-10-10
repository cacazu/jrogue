param(
    [Parameter(Mandatory = $true)][string]$ArchiveRoot,
    [Parameter(Mandatory = $true)][string]$OutputFile
)

# Reads source/license text from official release ZIP packages without executing it.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$addonDirectory = Join-Path $ArchiveRoot 'game\addons'
$records = foreach ($package in (Get-ChildItem -LiteralPath $addonDirectory -Filter '*.teaa' -File | Sort-Object Name)) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($package.FullName)
    try {
        $notices = foreach ($entry in ($zip.Entries | Where-Object {
            $_.FullName -eq 'init.lua' -or $_.FullName -match '(^|/)(COPYING(?:-[^/]*)?|LICENSE(?:\.[^/]*)?)$'
        } | Sort-Object FullName)) {
            if ($entry.Length -gt 4194304) { throw "Unexpectedly large notice $($entry.FullName)" }
            $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8, $true)
            try { $contents = $reader.ReadToEnd() } finally { $reader.Dispose() }
            [PSCustomObject]@{ entry = $entry.FullName; bytes = $entry.Length; contents = $contents }
        }
        [PSCustomObject]@{
            package = $package.Name
            sourcePath = $package.FullName
            bytes = $package.Length
            sha256 = (Get-FileHash -LiteralPath $package.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            notices = @($notices)
        }
    } finally { $zip.Dispose() }
}
$result = [PSCustomObject]@{
    schemaVersion = 1
    method = 'Read init.lua and explicit license notices from official addon ZIP containers; do not execute package code.'
    packages = @($records)
}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputFile -Encoding utf8
$result | ConvertTo-Json -Depth 8
