<#
.SYNOPSIS
    One-click release APK: Create GitHub Release, upload APK, and trigger server deployment.

.DESCRIPTION
    Prerequisites:
    1. Install GitHub CLI: winget install GitHub.cli
    2. Login: gh auth login
    3. Complete cloud build in HBuilderX to get the APK file.

.EXAMPLE
    # Auto-find latest APK and release (auto-increment version)
    .\release.ps1

    # Specify version
    .\release.ps1 -Version "1.0.2"
#>

param(
    [string]$Version,
    [string]$ApkPath,
    [string]$Notes
)

$ErrorActionPreference = "Stop"

# -----------------------------------------------------------------------------
# 1. Check gh CLI availability
# -----------------------------------------------------------------------------
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] GitHub CLI not installed. Run: winget install GitHub.cli" -ForegroundColor Red
    exit 1
}

# Check login status
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Not logged in to GitHub CLI. Run: gh auth login" -ForegroundColor Red
    exit 1
}

# -----------------------------------------------------------------------------
# 2. Find APK File
# -----------------------------------------------------------------------------
if (-not $ApkPath) {
    Write-Host "[SEARCH] Looking for latest APK file..." -ForegroundColor Cyan

    $searchPaths = @(
        (Join-Path $PSScriptRoot "..\frontend\dist\release\apk"),
        (Join-Path $PSScriptRoot "..\frontend\dist\debug\apk"),
        (Join-Path $PSScriptRoot "..\frontend\unpackage\release\apk"),
        (Join-Path $PSScriptRoot "..\frontend\unpackage\debug\apk"),
        "$env:APPDATA\HBuilder X\apps",
        "$env:LOCALAPPDATA\HBuilder X\apps",
        [Environment]::GetFolderPath("Desktop"),
        (Join-Path $env:USERPROFILE "Downloads")
    )

    $latestApk = $null
    $latestTime = [DateTime]::MinValue

    foreach ($dir in $searchPaths) {
        if (Test-Path $dir) {
            $apks = Get-ChildItem -Path $dir -Filter "*.apk" -Recurse -ErrorAction SilentlyContinue
            foreach ($apk in $apks) {
                if ($apk.LastWriteTime -gt $latestTime) {
                    $latestTime = $apk.LastWriteTime
                    $latestApk = $apk
                }
            }
        }
    }

    if (-not $latestApk) {
        Write-Host "[ERROR] APK not found! Build in HBuilderX first, or use -ApkPath." -ForegroundColor Red
        exit 1
    }

    $ApkPath = $latestApk.FullName
    Write-Host "[OK] Found APK: $ApkPath" -ForegroundColor Green
    Write-Host "   Size: $([math]::Round($latestApk.Length / 1MB, 2)) MB" -ForegroundColor Gray
    Write-Host "   Modified: $($latestApk.LastWriteTime)" -ForegroundColor Gray

    if ($latestApk.LastWriteTime -lt (Get-Date).AddHours(-1)) {
        Write-Host "[WARN] APK was generated $([math]::Round(((Get-Date) - $latestApk.LastWriteTime).TotalHours, 1)) hours ago. Continue? (Y/n)" -ForegroundColor Yellow
        $confirm = Read-Host
        if ($confirm -eq 'n' -or $confirm -eq 'N') {
            Write-Host "Cancelled." -ForegroundColor Gray
            exit 0
        }
    }
} else {
    if (-not (Test-Path $ApkPath)) {
        Write-Host "[ERROR] APK file not found at: $ApkPath" -ForegroundColor Red
        exit 1
    }
}

# -----------------------------------------------------------------------------
# 3. Determine Version
# -----------------------------------------------------------------------------
if (-not $Version) {
    # 优先从 manifest.json 读取当前打包版本
    $manifestPath = Join-Path $PSScriptRoot "..\frontend\src\manifest.json"
    if (Test-Path $manifestPath) {
        $manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $Version = $manifest.versionName
        Write-Host "[VERSION] Source: manifest.json (v$Version)" -ForegroundColor Cyan
    } else {
        # 如果没有 manifest.json，则尝试从 GitHub Tag 递增
        $latestTag = gh release list --limit 1 --json tagName --jq ".[0].tagName" 2>$null
        if ($latestTag -match "v?(\d+)\.(\d+)\.(\d+)") {
            $major = [int]$Matches[1]
            $minor = [int]$Matches[2]
            $patch = [int]$Matches[3] + 1
            $Version = "$major.$minor.$patch"
            Write-Host "[VERSION] Auto-increment from $latestTag -> v$Version" -ForegroundColor Cyan
        } else {
            $Version = "1.0.0"
            Write-Host "[VERSION] Default: v$Version" -ForegroundColor Cyan
        }
    }
}

$Tag = "v$Version"

# -----------------------------------------------------------------------------
# 4. Update manifest.json
# -----------------------------------------------------------------------------
$manifestPath = Join-Path $PSScriptRoot "..\frontend\src\manifest.json"
if (Test-Path $manifestPath) {
    $manifestContent = Get-Content $manifestPath -Raw -Encoding UTF8
    $manifest = $manifestContent | ConvertFrom-Json

    $oldVersion = $manifest.versionName
    if ($oldVersion -ne $Version) {
        $versionParts = $Version -split "\."
        $versionCode = [int]$versionParts[0] * 10000 + [int]$versionParts[1] * 100 + [int]$versionParts[2]

        $manifestContent = $manifestContent -replace '"versionName"\s*:\s*"[^"]*"', "`"versionName`" : `"$Version`""
        $manifestContent = $manifestContent -replace '"versionCode"\s*:\s*"?(\d+)"?', "`"versionCode`" : $versionCode"
        Set-Content -Path $manifestPath -Value $manifestContent -Encoding UTF8

        Write-Host "[UPDATE] Updated manifest.json: $oldVersion -> $Version (code: $versionCode)" -ForegroundColor Green
    }
}

# -----------------------------------------------------------------------------
# 5. Rename APK (Clean name for upload)
# -----------------------------------------------------------------------------
$CleanApkName = "SiasSchedule_v${Version}.apk"
$CleanApkPath = Join-Path (Split-Path $ApkPath) $CleanApkName
if ($ApkPath -ne $CleanApkPath) {
    Copy-Item -Path $ApkPath -Destination $CleanApkPath -Force
    Write-Host "[RENAME] Copied APK to: $CleanApkName" -ForegroundColor Green
    $ApkPath = $CleanApkPath
}

# -----------------------------------------------------------------------------
# 6. GitHub Release
# -----------------------------------------------------------------------------
if (-not $Notes) {
    $Notes = "Sias Class Schedule Assistant $Tag`n`nReleased at $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

Write-Host ""
Write-Host "[RELEASE] Creating/Updating Release $Tag..." -ForegroundColor Cyan

$ErrorActionPreference = "Continue"
gh release view $Tag 2>&1 | Out-Null
$releaseExists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = "Stop"

if ($releaseExists) {
    Write-Host "[WARN] Release $Tag already exists. Overwrite APK? (Y/n)" -ForegroundColor Yellow
    $confirm = Read-Host
    if ($confirm -eq 'n' -or $confirm -eq 'N') {
        exit 0
    }
    gh release upload $Tag "$ApkPath" --clobber
    Write-Host "[OK] APK uploaded to existing Release $Tag" -ForegroundColor Green
} else {
    gh release create $Tag "$ApkPath" --title "Sias Schedule $Tag" --notes $Notes
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Release $Tag created successfully!" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Failed to create Release!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor DarkGray
Write-Host "  [APK]    $(Split-Path $ApkPath -Leaf)" -ForegroundColor White
Write-Host "  [VERSION]   $Tag" -ForegroundColor White
Write-Host "  [DEPLOY] GitHub Actions auto-deploying..." -ForegroundColor White
Write-Host "========================================" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Track progress: gh run watch" -ForegroundColor Gray
