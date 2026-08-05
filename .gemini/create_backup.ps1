$src = 'c:\Users\Dhanush\OneDrive\Desktop\PROJECTS\TutorBoard'
$dst = Join-Path $src 'TutorBoard_backup.zip'

# Remove old zip if exists
if (Test-Path $dst) { Remove-Item $dst -Force }

# Collect all files, then filter out gitignore patterns
$allFiles = Get-ChildItem -Path $src -Recurse -File -Force

$filtered = $allFiles | Where-Object {
    $rel = $_.FullName.Substring($src.Length + 1)
    $relFwd = $rel -replace '\\','/'
    $parts = $relFwd -split '/'

    # Skip node_modules anywhere in path
    if ($parts -contains 'node_modules') { return $false }
    # Skip dist anywhere in path
    if ($parts -contains 'dist') { return $false }
    # Skip .vscode
    if ($parts -contains '.vscode') { return $false }
    # Skip .idea
    if ($parts -contains '.idea') { return $false }
    # Skip .gemini
    if ($parts -contains '.gemini') { return $false }
    # Skip .git
    if ($parts -contains '.git') { return $false }
    # Skip .env files
    if ($_.Name -eq '.env' -or $_.Name -eq '.env.local' -or $_.Name -eq '.env.development.local' -or $_.Name -eq '.env.test.local' -or $_.Name -eq '.env.production.local') { return $false }
    # Skip log files
    if ($_.Name -match '^npm-debug\.log' -or $_.Name -match '^yarn-debug\.log' -or $_.Name -match '^yarn-error\.log') { return $false }
    if ($_.Extension -eq '.log') { return $false }
    # Skip .txt files except README.txt and LICENSE.txt
    if ($_.Extension -eq '.txt' -and $_.Name -ne 'README.txt' -and $_.Name -ne 'LICENSE.txt') { return $false }
    # Skip .DS_Store
    if ($_.Name -eq '.DS_Store') { return $false }
    # Skip editor files
    if ($_.Extension -eq '.suo') { return $false }
    if ($_.Name -match '\.ntvs') { return $false }
    if ($_.Extension -eq '.njsproj') { return $false }
    if ($_.Extension -eq '.sln') { return $false }
    if ($_.Name -match '\.sw.$') { return $false }
    # Skip zip files
    if ($_.Extension -eq '.zip') { return $false }
    # Skip server/uploads/
    if ($relFwd -match '^server/uploads/') { return $false }
    # Skip server/.local-storage/
    if ($relFwd -match '^server/\.local-storage/') { return $false }
    # Skip client/coverage/
    if ($relFwd -match '^client/coverage/') { return $false }
    # Skip graphify-out/
    if ($relFwd -match '^graphify-out/') { return $false }
    # Skip client/eslint-result.json
    if ($relFwd -eq 'client/eslint-result.json') { return $false }
    # Skip specific server debug scripts
    if ($relFwd -eq 'server/check_db.js') { return $false }
    if ($relFwd -eq 'server/test-req.cjs') { return $false }
    if ($relFwd -match '^server/test_.*\.js$') { return $false }
    if ($relFwd -eq 'server/verify_persistence.js') { return $false }
    if ($relFwd -match '^server/scratch/') { return $false }
    if ($relFwd -match '^server/scripts/test-.*\.js$') { return $false }
    if ($relFwd -match '^server/scripts/test_.*\.js$') { return $false }

    return $true
}

Write-Host "Files to include: $($filtered.Count)"

# Use System.IO.Compression to build the zip
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipStream = [System.IO.File]::Create($dst)
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

foreach ($f in $filtered) {
    $entryName = 'TutorBoard/' + ($f.FullName.Substring($src.Length + 1) -replace '\\','/')
    $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($f.FullName)
    $fileStream.CopyTo($entryStream)
    $fileStream.Close()
    $entryStream.Close()
}

$archive.Dispose()
$zipStream.Close()

$size = (Get-Item $dst).Length / 1MB
Write-Host "Zip created: $dst ($([math]::Round($size, 2)) MB)"
