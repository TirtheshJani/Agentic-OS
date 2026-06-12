# Generates the PWA icons and the shortcut .ico (monogram "A" on dark).
# Rerun after changing colors: powershell -File dashboard/scripts/make-icons.ps1
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$iconsDir = Join-Path $PSScriptRoot "..\public\icons"
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

function New-MonogramBitmap([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(255, 11, 11, 13))
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 96, 165, 250))
    $font = New-Object System.Drawing.Font("Segoe UI", [float]($size * 0.45), [System.Drawing.FontStyle]::Bold)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $g.DrawString("A", $font, $brush, $rect, $fmt)
    $g.Dispose()
    return $bmp
}

foreach ($size in 192, 512) {
    $bmp = New-MonogramBitmap $size
    $out = Join-Path $iconsDir "icon-$size.png"
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "wrote $out"
}

# Shortcut icon: GetHicon round-trip produces a valid single-image .ico.
$bmp = New-MonogramBitmap 64
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$icoPath = Join-Path $iconsDir "app.ico"
$stream = [System.IO.File]::Create($icoPath)
$icon.Save($stream)
$stream.Close()
$icon.Dispose()
$bmp.Dispose()
Write-Host "wrote $icoPath"
