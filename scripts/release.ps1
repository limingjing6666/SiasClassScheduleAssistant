<#
.SYNOPSIS
    一键发布 APK：创建 GitHub Release 并上传 APK，自动触发服务器部署。

.DESCRIPTION
    使用前提：
    1. 安装 GitHub CLI: winget install GitHub.cli
    2. 登录: gh auth login
    3. 在 HBuilderX 中完成云打包，得到 APK 文件

.EXAMPLE
    # 自动查找最新 APK 并发布（版本号自动递增）
    .\release.ps1

    # 指定版本号
    .\release.ps1 -Version "1.0.2"

    # 指定 APK 路径
    .\release.ps1 -ApkPath "D:\path\to\app.apk" -Version "1.0.2"
#>

param(
    [string]$Version,
    [string]$ApkPath,
    [string]$Notes
)

$ErrorActionPreference = "Stop"

# ═══════════════════════════════════════════════
# 1. 检查 gh CLI 是否可用
# ═══════════════════════════════════════════════
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未安装 GitHub CLI。请运行: winget install GitHub.cli" -ForegroundColor Red
    exit 1
}

# 检查是否已登录
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 未登录 GitHub CLI。请运行: gh auth login" -ForegroundColor Red
    exit 1
}

# ═══════════════════════════════════════════════
# 2. 查找 APK 文件
# ═══════════════════════════════════════════════
if (-not $ApkPath) {
    Write-Host "🔍 正在查找最新的 APK 文件..." -ForegroundColor Cyan

    # HBuilderX 常见的 APK 输出路径
    $searchPaths = @(
        # HBuilderX 默认输出目录（相对于项目根目录的 frontend）
        (Join-Path $PSScriptRoot "..\frontend\unpackage\release\apk"),
        (Join-Path $PSScriptRoot "..\frontend\unpackage\debug\apk"),
        # HBuilderX 全局输出目录
        "$env:APPDATA\HBuilder X\apps",
        "$env:LOCALAPPDATA\HBuilder X\apps",
        # 用户桌面（有时手动放在桌面）
        [Environment]::GetFolderPath("Desktop"),
        # 用户下载目录
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
        Write-Host "❌ 未找到 APK 文件！请先在 HBuilderX 中完成打包，或使用 -ApkPath 参数指定路径。" -ForegroundColor Red
        exit 1
    }

    $ApkPath = $latestApk.FullName
    Write-Host "✅ 找到 APK: $ApkPath" -ForegroundColor Green
    Write-Host "   大小: $([math]::Round($latestApk.Length / 1MB, 2)) MB" -ForegroundColor Gray
    Write-Host "   修改时间: $($latestApk.LastWriteTime)" -ForegroundColor Gray

    # 如果 APK 超过 1 小时前生成，提醒用户确认
    if ($latestApk.LastWriteTime -lt (Get-Date).AddHours(-1)) {
        Write-Host "⚠️  该 APK 是 $([math]::Round(((Get-Date) - $latestApk.LastWriteTime).TotalHours, 1)) 小时前生成的，确定使用？(Y/n)" -ForegroundColor Yellow
        $confirm = Read-Host
        if ($confirm -eq 'n' -or $confirm -eq 'N') {
            Write-Host "已取消。" -ForegroundColor Gray
            exit 0
        }
    }
} else {
    if (-not (Test-Path $ApkPath)) {
        Write-Host "❌ APK 文件不存在: $ApkPath" -ForegroundColor Red
        exit 1
    }
}

# ═══════════════════════════════════════════════
# 3. 确定版本号
# ═══════════════════════════════════════════════
if (-not $Version) {
    # 从已有的 Release 中获取最新版本号并自动递增
    $latestTag = gh release list --limit 1 --json tagName --jq ".[0].tagName" 2>$null
    if ($latestTag -match "v?(\d+)\.(\d+)\.(\d+)") {
        $major = [int]$Matches[1]
        $minor = [int]$Matches[2]
        $patch = [int]$Matches[3] + 1
        $Version = "$major.$minor.$patch"
        Write-Host "📌 上一版本: $latestTag → 新版本: v$Version" -ForegroundColor Cyan
    } else {
        # 从 manifest.json 读取版本号
        $manifestPath = Join-Path $PSScriptRoot "..\frontend\src\manifest.json"
        if (Test-Path $manifestPath) {
            $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
            $Version = $manifest.versionName
            Write-Host "📌 从 manifest.json 读取版本: v$Version" -ForegroundColor Cyan
        } else {
            $Version = "1.0.0"
        }
    }
}

$Tag = "v$Version"

# ═══════════════════════════════════════════════
# 4. 同步更新 manifest.json 版本号
# ═══════════════════════════════════════════════
$manifestPath = Join-Path $PSScriptRoot "..\frontend\src\manifest.json"
if (Test-Path $manifestPath) {
    $manifestContent = Get-Content $manifestPath -Raw
    $manifest = $manifestContent | ConvertFrom-Json

    $oldVersion = $manifest.versionName
    if ($oldVersion -ne $Version) {
        # 计算 versionCode（去掉点号，如 1.0.2 → 102）
        $versionParts = $Version -split "\."
        $versionCode = [int]$versionParts[0] * 100 + [int]$versionParts[1] * 10 + [int]$versionParts[2]

        $manifestContent = $manifestContent -replace '"versionName"\s*:\s*"[^"]*"', "`"versionName`" : `"$Version`""
        $manifestContent = $manifestContent -replace '"versionCode"\s*:\s*"[^"]*"', "`"versionCode`" : `"$versionCode`""
        Set-Content -Path $manifestPath -Value $manifestContent -Encoding UTF8

        Write-Host "📝 已更新 manifest.json: $oldVersion → $Version (code: $versionCode)" -ForegroundColor Green
    }
}

# ═══════════════════════════════════════════════
# 5. 重命名 APK（HBuilderX 生成的文件名含特殊字符，会导致上传失败）
# ═══════════════════════════════════════════════
$CleanApkName = "西亚斯课表助手_v${Version}.apk"
$CleanApkPath = Join-Path (Split-Path $ApkPath) $CleanApkName
if ($ApkPath -ne $CleanApkPath) {
    Copy-Item -Path $ApkPath -Destination $CleanApkPath -Force
    Write-Host "📎 已复制 APK 为: $CleanApkName" -ForegroundColor Green
    $ApkPath = $CleanApkPath
}

# ═══════════════════════════════════════════════
# 6. 创建 Release 并上传 APK
# ═══════════════════════════════════════════════
if (-not $Notes) {
    $Notes = "西亚斯课表助手 $Tag`n`n发布于 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

Write-Host ""
Write-Host "🚀 正在创建 Release $Tag 并上传 APK..." -ForegroundColor Cyan

# 检查 tag 是否已存在
$existingRelease = gh release view $Tag 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "⚠️  Release $Tag 已存在，是否覆盖上传？(Y/n)" -ForegroundColor Yellow
    $confirm = Read-Host
    if ($confirm -eq 'n' -or $confirm -eq 'N') {
        exit 0
    }
    # 删除旧的 APK 资源然后重新上传
    gh release upload $Tag "$ApkPath" --clobber
    Write-Host "✅ 已覆盖上传 APK 到 Release $Tag" -ForegroundColor Green
} else {
    # 创建新 Release
    gh release create $Tag "$ApkPath" `
        --title "西亚斯课表助手 $Tag" `
        --notes $Notes

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Release $Tag 创建成功！APK 已上传。" -ForegroundColor Green
        Write-Host "🔄 GitHub Actions 将自动部署 APK 到服务器..." -ForegroundColor Cyan
    } else {
        Write-Host "❌ 创建 Release 失败！" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  📱 APK: $(Split-Path $ApkPath -Leaf)" -ForegroundColor White
Write-Host "  🏷️  版本: $Tag" -ForegroundColor White
Write-Host "  🔄 部署: GitHub Actions 自动执行中..." -ForegroundColor White
Write-Host "════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "查看部署进度: gh run watch" -ForegroundColor Gray
