[CmdletBinding()]
param(
  [string]$VaultPath = 'D:\ExamDataVault',
  [string]$CloudPath = 'G:\My Drive\ExamVaultBackups',
  [string]$RepoRoot,
  [switch]$Verify,
  [switch]$RestoreLatest,
  [switch]$SkipCloud,
  [switch]$SkipHistory,
  [switch]$SkipBundle,
  [switch]$NoAcl,
  [string]$DecryptFile,
  [string]$OutFile
)

$ErrorActionPreference = 'Stop'

try { Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null } catch { }
try { Add-Type -AssemblyName System.Security | Out-Null } catch { }

if (-not $RepoRoot) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path

function Write-Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "    OK  $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "    !   $Message" -ForegroundColor Yellow }
function Fail([string]$Message) { Write-Host "`n[ERROR] $Message" -ForegroundColor Red; exit 1 }

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Get-RelativePath([string]$Base, [string]$Full) {
  $baseFull = [IO.Path]::GetFullPath($Base).TrimEnd('\') + '\'
  $fullPath = [IO.Path]::GetFullPath($Full)
  if (-not $fullPath.StartsWith($baseFull, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Path is outside base: $Full"
  }
  return $fullPath.Substring($baseFull.Length)
}

function Get-Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-DataRelativePath([string]$Relative) {
  $p = $Relative.Replace('\', '/')
  if ($p -eq 'knowledge_structure.csv') { return $false }
  if ($p -match '\.(csv|xlsx|xls|xlsm|tsv|parquet|sqlite|sqlite3|db|pdf|zip|7z|aes)$') { return $true }
  if ($p -match '(^|/)(response|api_data|question_texts)\.json$') { return $true }
  if ($p -match '^(public|dist)/data/') { return $true }
  if ($p -match '(^|/)raw_[^/]+$') { return $true }
  return $false
}

function Get-DataFiles {
  $list = New-Object System.Collections.Generic.List[System.IO.FileInfo]
  $seen = New-Object System.Collections.Generic.HashSet[string]

  foreach ($file in (Get-ChildItem -LiteralPath $RepoRoot -File -Force)) {
    $rel = $file.Name
    if (Test-DataRelativePath $rel) {
      if ($seen.Add($file.FullName)) { $list.Add($file) }
    }
  }

  foreach ($sub in @('public\data', 'dist\data')) {
    $dir = Join-Path $RepoRoot $sub
    if (Test-Path -LiteralPath $dir) {
      foreach ($file in (Get-ChildItem -LiteralPath $dir -File -Recurse -Force)) {
        $rel = Get-RelativePath $RepoRoot $file.FullName
        if (Test-DataRelativePath $rel) {
          if ($seen.Add($file.FullName)) { $list.Add($file) }
        }
      }
    }
  }

  foreach ($file in (Get-ChildItem -LiteralPath (Join-Path $RepoRoot 'public') -File -Filter '*.pdf' -Force -ErrorAction SilentlyContinue)) {
    $rel = Get-RelativePath $RepoRoot $file.FullName
    if (Test-DataRelativePath $rel) {
      if ($seen.Add($file.FullName)) { $list.Add($file) }
    }
  }

  return $list.ToArray()
}

function Get-KeyBytes {
  Add-Type -AssemblyName System.Security | Out-Null
  $keyDir = Join-Path $env:APPDATA 'ExamVault'
  Ensure-Dir $keyDir
  $keyFile = Join-Path $keyDir 'backup.key'

  if (-not (Test-Path -LiteralPath $keyFile)) {
    $newKey = New-Object byte[] 64
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($newKey)
    $rng.Dispose()

    $protected = [System.Security.Cryptography.ProtectedData]::Protect(
      $newKey,
      $null,
      [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    [IO.File]::WriteAllBytes($keyFile, $protected)

    # Recovery copy outside the vault (different drive), so losing D: does not lose the key.
    $recovery = Join-Path $env:USERPROFILE 'ExamVault-RECOVERY-KEY.txt'
    $content = @(
      'EXAM DATA VAULT - RECOVERY KEY',
      'Store this file in a password manager. Without it, encrypted Google Drive backups cannot be restored on another machine.',
      ('Created: ' + (Get-Date).ToString('o')),
      '',
      [Convert]::ToBase64String($newKey)
    ) -join "`r`n"
    [IO.File]::WriteAllText($recovery, $content, (New-Object System.Text.UTF8Encoding($false)))

    try {
      $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
      $acl = New-Object System.Security.AccessControl.FileSecurity
      $acl.SetAccessRuleProtection($true, $false)
      $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $identity,
        [System.Security.AccessControl.FileSystemRights]::FullControl,
        [System.Security.AccessControl.AccessControlType]::Allow
      )
      $acl.AddAccessRule($rule)
      Set-Acl -LiteralPath $recovery -AclObject $acl
    } catch {
      Write-Warn "Could not restrict ACL on recovery key: $($_.Exception.Message)"
    }

    Write-Warn "New recovery key: $recovery"
    Write-Warn 'Copy it to a password manager, then you may delete the file.'
  }

  $protectedBytes = [IO.File]::ReadAllBytes($keyFile)
  $key = [System.Security.Cryptography.ProtectedData]::Unprotect(
    $protectedBytes,
    $null,
    [System.Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  return ,([byte[]]$key)
}

function Protect-Bytes([byte[]]$Plain, [byte[]]$Key) {
  $iv = New-Object byte[] 16
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($iv)
  $rng.Dispose()

  $aes = [System.Security.Cryptography.Aes]::Create()
  $aes.Key = [byte[]]($Key[0..31])
  $aes.IV = $iv
  $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
  $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
  $encryptor = $aes.CreateEncryptor()
  $cipher = $encryptor.TransformFinalBlock($Plain, 0, $Plain.Length)
  $encryptor.Dispose()
  $aes.Dispose()

  $macKey = [byte[]]($Key[32..63])
  $hmac = New-Object System.Security.Cryptography.HMACSHA256 -ArgumentList (, $macKey)
  $mac = $hmac.ComputeHash([byte[]]($iv + $cipher))
  $hmac.Dispose()

  $magic = [Text.Encoding]::ASCII.GetBytes('EVLT1')
  return ,([byte[]]($magic + $iv + $mac + $cipher))
}

function Unprotect-Bytes([byte[]]$Blob, [byte[]]$Key) {
  if ($Blob.Length -lt (5 + 16 + 32 + 16)) { throw 'Encrypted file is too short.' }
  $magic = [Text.Encoding]::ASCII.GetString($Blob, 0, 5)
  if ($magic -ne 'EVLT1') { throw 'Unknown encrypted file format.' }

  $iv = [byte[]]$Blob[5..20]
  $mac = [byte[]]$Blob[21..52]
  $cipher = [byte[]]$Blob[53..($Blob.Length - 1)]

  $macKey = [byte[]]($Key[32..63])
  $hmac = New-Object System.Security.Cryptography.HMACSHA256 -ArgumentList (, $macKey)
  $calc = $hmac.ComputeHash([byte[]]($iv + $cipher))
  $hmac.Dispose()

  $diff = 0
  for ($i = 0; $i -lt $mac.Length; $i++) { $diff = $diff -bor ($calc[$i] -bxor $mac[$i]) }
  if ($diff -ne 0) { throw 'HMAC verification failed: file is corrupted or wrong key.' }

  $aes = [System.Security.Cryptography.Aes]::Create()
  $aes.Key = [byte[]]($Key[0..31])
  $aes.IV = $iv
  $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
  $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
  $decryptor = $aes.CreateDecryptor()
  $plain = $decryptor.TransformFinalBlock($cipher, 0, $cipher.Length)
  $decryptor.Dispose()
  $aes.Dispose()
  return ,([byte[]]$plain)
}

function Compress-Directory([string]$Directory, [string]$ZipPath) {
  if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $Directory,
    $ZipPath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )
}

function New-Snapshot {
  $stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
  $snap = Join-Path $VaultPath "snapshots\$stamp"
  $suffix = 1
  while (Test-Path -LiteralPath $snap) {
    $snap = Join-Path $VaultPath "snapshots\$($stamp)_$suffix"
    $suffix++
  }
  Ensure-Dir $snap

  $files = Get-DataFiles
  if ($files.Count -eq 0) { Fail 'No exam data files found in the repository.' }

  $entries = @()
  foreach ($file in $files) {
    $rel = Get-RelativePath $RepoRoot $file.FullName
    $dest = Join-Path $snap $rel
    Ensure-Dir (Split-Path -Parent $dest)
    Copy-Item -LiteralPath $file.FullName -Destination $dest -Force
    $hash = Get-Sha256 $dest
    $entries += [pscustomobject]@{
      path = $rel.Replace('\', '/')
      sha256 = $hash
      bytes = $file.Length
    }
  }

  $gitHead = ''
  try { $gitHead = (& git -C $RepoRoot rev-parse --short HEAD 2>$null) } catch { }

  $meta = [ordered]@{
    createdAt = (Get-Date).ToString('o')
    repoRoot = $RepoRoot
    gitHead = $gitHead
    fileCount = $entries.Count
    totalBytes = ($entries | Measure-Object -Property bytes -Sum).Sum
    files = $entries
  }
  $meta | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $snap 'snapshot.json') -Encoding UTF8

  $manifest = $entries | ForEach-Object { "$($_.sha256) *$($_.path)" }
  [IO.File]::WriteAllLines(
    (Join-Path $snap 'manifest.sha256'),
    [string[]]$manifest,
    (New-Object System.Text.UTF8Encoding($false))
  )

  Get-ChildItem -LiteralPath $snap -Recurse -File | ForEach-Object { $_.IsReadOnly = $true }

  $snapName = Split-Path $snap -Leaf
  Set-Content -LiteralPath (Join-Path $VaultPath 'LATEST.txt') -Value $snapName -Encoding ASCII

  Write-Ok "$($entries.Count) files, $([math]::Round((($entries | Measure-Object -Property bytes -Sum).Sum / 1MB), 2)) MB -> $snap"
  return [pscustomobject]@{ Path = $snap; Name = $snapName; Entries = $entries }
}

function Get-LatestSnapshot {
  $snapRoot = Join-Path $VaultPath 'snapshots'
  if (-not (Test-Path -LiteralPath $snapRoot)) { return $null }
  return (Get-ChildItem -LiteralPath $snapRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1)
}

function Verify-Snapshot([string]$SnapshotPath) {
  $manifestPath = Join-Path $SnapshotPath 'manifest.sha256'
  if (-not (Test-Path -LiteralPath $manifestPath)) { Fail "Manifest not found: $manifestPath" }

  $count = 0
  $bad = 0
  foreach ($line in (Get-Content -LiteralPath $manifestPath -Encoding UTF8)) {
    if ($line -match '^([0-9a-fA-F]{64}) \*(.+)$') {
      $expected = $matches[1].ToLowerInvariant()
      $rel = $matches[2].Replace('/', '\')
      $path = Join-Path $SnapshotPath $rel
      $count++
      if (-not (Test-Path -LiteralPath $path)) {
        Write-Warn "Missing: $rel"
        $bad++
      } else {
        $actual = Get-Sha256 $path
        if ($actual -ne $expected) {
          Write-Warn "Hash mismatch: $rel"
          $bad++
        }
      }
    }
  }

  if ($bad -gt 0) { Fail "$bad file(s) failed verification." }
  Write-Ok "$count file(s) match SHA-256."
}

function Export-History {
  $historyDir = Join-Path $VaultPath 'history'
  $marker = Join-Path $historyDir 'COMPLETE.txt'
  if (Test-Path -LiteralPath $marker) {
    Write-Ok 'Git history blobs were already exported.'
    return
  }
  Ensure-Dir $historyDir

  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $node) { Fail 'node is required to export Git history blobs.' }

  Write-Step 'Export every historical version of exam data from Git'
  & $node (Join-Path $RepoRoot 'scripts\export-history-blobs.mjs') $RepoRoot (Join-Path $historyDir 'git-blobs')
  if ($LASTEXITCODE -ne 0) { Fail 'export-history-blobs.mjs failed.' }

  "Completed: $((Get-Date).ToString('o'))" | Set-Content -LiteralPath $marker -Encoding UTF8
  Write-Ok "History archive: $(Join-Path $historyDir 'git-blobs')"
}

function Create-Bundle {
  $bundleDir = Join-Path $VaultPath 'repo-history'
  Ensure-Dir $bundleDir
  $existing = Get-ChildItem -LiteralPath $bundleDir -Filter '*.bundle' -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existing) {
    Write-Ok "Git bundle already exists: $($existing.Name)"
    return
  }

  Write-Step 'Create a full Git bundle (all refs) before rewriting history'
  $name = "exam-analytics-dashboard-$(Get-Date -Format 'yyyy-MM-dd_HHmmss').bundle"
  $bundle = Join-Path $bundleDir $name
  & git -C $RepoRoot bundle create $bundle --all
  if ($LASTEXITCODE -ne 0) { Fail 'git bundle create failed.' }

  Set-Content -LiteralPath "$bundle.sha256" -Value (Get-Sha256 $bundle) -Encoding ASCII
  Write-Ok "Bundle: $bundle"
}

function New-CloudBackup([string]$SnapshotPath, [string]$SnapshotName) {
  if ($SkipCloud) { return }
  if (-not (Test-Path -LiteralPath 'G:\')) {
    Write-Warn 'Drive G: not found; skipping encrypted Google Drive backup.'
    return
  }
  Ensure-Dir $CloudPath

  $zip = Join-Path $env:TEMP "examvault-$SnapshotName.zip"
  $aesFile = Join-Path $CloudPath "examvault-$SnapshotName.zip.aes"
  $roundZip = Join-Path $env:TEMP "examvault-$SnapshotName.round.zip"

  try {
    Compress-Directory $SnapshotPath $zip
    $key = Get-KeyBytes
    $plain = [IO.File]::ReadAllBytes($zip)
    $blob = Protect-Bytes $plain $key

    $written = $false
    for ($attempt = 1; $attempt -le 5; $attempt++) {
      try {
        [IO.File]::WriteAllBytes($aesFile, $blob)
        $written = $true
        break
      } catch {
        Start-Sleep -Seconds 2
      }
    }
    if (-not $written) { Fail "Could not write cloud backup: $aesFile" }

    # Verify by decrypting and comparing the ZIP hash.
    $round = Unprotect-Bytes $blob $key
    [IO.File]::WriteAllBytes($roundZip, $round)
    $zipHash = Get-Sha256 $zip
    $roundHash = Get-Sha256 $roundZip
    if ($zipHash -ne $roundHash) { Fail 'Encrypted backup verification failed.' }

    $record = [ordered]@{
      createdAt = (Get-Date).ToString('o')
      snapshot = $SnapshotName
      file = (Split-Path $aesFile -Leaf)
      zipSha256 = $zipHash
      aesSha256 = (Get-Sha256 $aesFile)
      bytes = $blob.Length
    }
    $line = ($record | ConvertTo-Json -Compress) + "`r`n"
    [IO.File]::AppendAllText(
      (Join-Path $CloudPath 'cloud-manifest.jsonl'),
      $line,
      (New-Object System.Text.UTF8Encoding($false))
    )

    $readme = Join-Path $CloudPath 'README.txt'
    if (-not (Test-Path -LiteralPath $readme)) {
      $text = @(
        'EXAM DATA VAULT - ENCRYPTED BACKUP',
        '',
        'These .zip.aes files are AES-256-CBC + HMAC-SHA256 encrypted snapshots.',
        'They cannot be opened without the recovery key.',
        '',
        'Restore on this machine:',
        '  powershell -ExecutionPolicy Bypass -File scripts\vault-backup.ps1 -DecryptFile <file.zip.aes> -OutFile <file.zip>',
        '',
        'Recovery key (on the original machine):',
        '  %USERPROFILE%\ExamVault-RECOVERY-KEY.txt',
        '',
        'Store that key in a password manager. Losing it makes off-site backups unrecoverable.',
        '',
        'Source of truth: D:\ExamDataVault (local, ACL-protected).'
      ) -join "`r`n"
      [IO.File]::WriteAllText($readme, $text, (New-Object System.Text.UTF8Encoding($false)))
    }

    Write-Ok "Encrypted cloud backup: $aesFile"
  } finally {
    if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $roundZip) { Remove-Item -LiteralPath $roundZip -Force -ErrorAction SilentlyContinue }
  }
}

function Protect-Vault {
  if ($NoAcl) { return }
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $rights = [System.Security.AccessControl.FileSystemRights]::Delete -bor [System.Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles

  foreach ($path in @($VaultPath, (Join-Path $VaultPath 'snapshots'), (Join-Path $VaultPath 'history'), (Join-Path $VaultPath 'repo-history'))) {
    if (-not (Test-Path -LiteralPath $path)) { continue }
    try {
      $acl = Get-Acl -LiteralPath $path
      $denyRules = @($acl.Access | Where-Object {
        $_.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Deny -and
        $_.IdentityReference.Value -ieq $identity
      })
      foreach ($rule in $denyRules) { $acl.RemoveAccessRule($rule) | Out-Null }

      $newRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $identity,
        $rights,
        ([System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit),
        [System.Security.AccessControl.PropagationFlags]::None,
        [System.Security.AccessControl.AccessControlType]::Deny
      )
      $acl.AddAccessRule($newRule)
      Set-Acl -LiteralPath $path -AclObject $acl
    } catch {
      Write-Warn "Could not set delete-protection ACL on ${path}: $($_.Exception.Message)"
    }
  }
  Write-Ok 'Delete-protection ACL applied.'
}

function Restore-Latest {
  $snap = Get-LatestSnapshot
  if (-not $snap) { Fail 'No snapshot found.' }
  $dest = Join-Path $RepoRoot ("restored-data-" + $snap.Name)
  Ensure-Dir $dest
  $count = 0
  Get-ChildItem -LiteralPath $snap.FullName -Recurse -File | Where-Object {
    $_.Name -notin @('manifest.sha256', 'snapshot.json')
  } | ForEach-Object {
    $rel = Get-RelativePath $snap.FullName $_.FullName
    $out = Join-Path $dest $rel
    Ensure-Dir (Split-Path -Parent $out)
    Copy-Item -LiteralPath $_.FullName -Destination $out -Force
    $count++
  }
  Write-Ok "Restored $count file(s) to: $dest"
}

function Decrypt-Backup {
  if (-not (Test-Path -LiteralPath $DecryptFile)) { Fail "File not found: $DecryptFile" }
  $key = Get-KeyBytes
  if (-not $OutFile) {
    if ($DecryptFile -match '\.aes$') {
      $OutFile = $DecryptFile -replace '\.aes$', ''
    } else {
      $OutFile = "$DecryptFile.out"
    }
  }
  $outFull = [IO.Path]::GetFullPath($OutFile)
  Ensure-Dir (Split-Path -Parent $outFull)
  $blob = [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $DecryptFile).Path)
  $plain = Unprotect-Bytes $blob $key
  [IO.File]::WriteAllBytes($outFull, $plain)
  Write-Ok "Decrypted: $outFull"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

Write-Host '=====================================================' -ForegroundColor DarkCyan
Write-Host ' EXAM DATA VAULT - exam data protection' -ForegroundColor DarkCyan
Write-Host '=====================================================' -ForegroundColor DarkCyan
Write-Host "Repo:  $RepoRoot"
Write-Host "Vault: $VaultPath"

if ($DecryptFile) { Decrypt-Backup; exit 0 }

if ($Verify) {
  $snap = Get-LatestSnapshot
  if (-not $snap) { Fail 'No snapshot found.' }
  Write-Step "Verify snapshot $($snap.Name)"
  Verify-Snapshot $snap.FullName
  exit 0
}

if ($RestoreLatest) {
  Write-Step 'Restore latest snapshot'
  Restore-Latest
  exit 0
}

Ensure-Dir $VaultPath
Ensure-Dir (Join-Path $VaultPath 'snapshots')
Ensure-Dir (Join-Path $VaultPath 'repo-history')

$readmePath = Join-Path $VaultPath 'README.txt'
if (-not (Test-Path -LiteralPath $readmePath)) {
  $readme = @(
    'EXAM DATA VAULT',
    ('Created: ' + (Get-Date).ToString('o')),
    '',
    'This folder is OUTSIDE the Git repository. It stores exam data / student PII.',
    '',
    'Layout:',
    '  snapshots\<timestamp>\   immutable snapshots with SHA-256 manifest',
    '  history\git-blobs\       every historical version of exam data from Git',
    '  repo-history\*.bundle    full Git bundle before history rewrite',
    '  LATEST.txt               latest snapshot name',
    '',
    'Do NOT delete this folder. A deny-Delete ACL and read-only files are applied.',
    'To remove it intentionally, first remove the deny rule in Explorer > Properties > Security.',
    '',
    'Backup:  powershell -ExecutionPolicy Bypass -File scripts\vault-backup.ps1',
    'Verify:  powershell -ExecutionPolicy Bypass -File scripts\vault-backup.ps1 -Verify',
    'Restore: powershell -ExecutionPolicy Bypass -File scripts\vault-backup.ps1 -RestoreLatest',
    '',
    'Encrypted off-site copy: G:\My Drive\ExamVaultBackups',
    'Recovery key: %USERPROFILE%\ExamVault-RECOVERY-KEY.txt (store it in a password manager).'
  ) -join "`r`n"
  [IO.File]::WriteAllText($readmePath, $readme, (New-Object System.Text.UTF8Encoding($false)))
}

if (-not $SkipBundle) {
  Write-Step 'Git bundle backup'
  Create-Bundle
}

if (-not $SkipHistory) {
  Write-Step 'Git history data archive'
  Export-History
}

Write-Step 'Create immutable snapshot'
$snapshot = New-Snapshot

Write-Step 'Protect vault from accidental deletion'
Protect-Vault

Write-Step 'Verify snapshot integrity'
Verify-Snapshot $snapshot.Path

Write-Step 'Encrypted Google Drive backup'
New-CloudBackup $snapshot.Path $snapshot.Name

$totalMb = [math]::Round((($snapshot.Entries | Measure-Object -Property bytes -Sum).Sum / 1MB), 2)
Write-Host ''
Write-Host '-----------------------------------------------------' -ForegroundColor DarkCyan
Write-Host " DONE: $($snapshot.Name)  ($($snapshot.Entries.Count) files, $totalMb MB)" -ForegroundColor Green
Write-Host " Vault: $VaultPath"
Write-Host " Cloud: $CloudPath"
Write-Host '-----------------------------------------------------' -ForegroundColor DarkCyan
