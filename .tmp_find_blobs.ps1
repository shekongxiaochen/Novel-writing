$blobs = git fsck --no-reflogs --full --unreachable | Select-String 'unreachable blob ' | ForEach-Object { ($_ -split ' ')[2] }
foreach ($b in $blobs) {
  $text = git show $b 2>$null
  if ($LASTEXITCODE -ne 0) { continue }
  if ($text -match 'id="chapter-hub-ai-studio"' -and $text -match 'aria-label="AI' -and $text -notmatch "chapter-hub__ai-studio--open': true") {
    Write-Output "NOVEL $b"
  }
  if ($text -match '\.chapter-hub__ai-studio \{' -and $text -match 'opacity: 0;' -and $text -match 'pointer-events: none;' -and $text -match 'transform: translateX\(16px\);' -and $text -match '\.chapter-hub__ai-studio--open \{') {
    Write-Output "STYLE $b"
  }
}
