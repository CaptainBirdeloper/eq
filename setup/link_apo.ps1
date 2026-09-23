# Link Equalizer APO config with py_equalizer.txt
$candidatePaths = @(
    "C:\Program Files\EqualizerAPO\config\config.txt",
    "C:\Program Files (x86)\EqualizerAPO\config\config.txt"
)

$found = $false
foreach ($path in $candidatePaths) {
    if (Test-Path $path) {
        $found = $true
        $content = Get-Content -Path $path -Raw -ErrorAction SilentlyContinue
        if ($content -notmatch "py_equalizer\.txt") {
            try {
                Add-Content -Path $path -Value "`r`nInclude: py_equalizer.txt"
                Write-Host "[OK] Linked py_equalizer.txt in $path" -ForegroundColor Green
            } catch {
                Write-Host "[!] Note: Could not auto-edit $path (requires admin). Open $path in Notepad and add 'Include: py_equalizer.txt'" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[OK] Equalizer APO config is already linked to py_equalizer.txt." -ForegroundColor Green
        }
        break
    }
}

if (-not $found) {
    Write-Host "[!] Equalizer APO was not found in Program Files." -ForegroundColor Yellow
    Write-Host "    Download it free from: https://sourceforge.net/projects/equalizerapo/" -ForegroundColor Yellow
}
