Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\public\images\logo-chess-club-sorowako.png"
$resDir = Join-Path $PSScriptRoot "..\android\app\src\main\res"

$sizes = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}

$srcImage = [System.Drawing.Image]::FromFile($srcPath)

foreach ($folder in $sizes.Keys) {
    $dim = $sizes[$folder]
    $destFolder = Join-Path $resDir $folder
    if (-not (Test-Path $destFolder)) {
        New-Item -ItemType Directory -Force -Path $destFolder | Out-Null
    }

    $bmp = New-Object System.Drawing.Bitmap $dim, $dim
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($srcImage, 0, 0, $dim, $dim)
    $graphics.Dispose()

    $launcherPath = Join-Path $destFolder "ic_launcher.png"
    $roundPath = Join-Path $destFolder "ic_launcher_round.png"
    $bmp.Save($launcherPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated $folder (${dim}x${dim})"
}

# Also generate a foreground icon for adaptive icon
$fgDim = 432
$fgBmp = New-Object System.Drawing.Bitmap $fgDim, $fgDim
$fgGraphics = [System.Drawing.Graphics]::FromImage($fgBmp)
$fgGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$fgGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$fgGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
# Draw centered with padding for adaptive icon safe zone (66% of 432 is ~288)
$pad = 72
$innerSize = $fgDim - (2 * $pad)
$fgGraphics.DrawImage($srcImage, $pad, $pad, $innerSize, $innerSize)
$fgGraphics.Dispose()

$drawableDir = Join-Path $resDir "drawable"
if (-not (Test-Path $drawableDir)) {
    New-Item -ItemType Directory -Force -Path $drawableDir | Out-Null
}
$fgPath = Join-Path $drawableDir "ic_launcher_foreground.png"
$fgBmp.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
$fgBmp.Dispose()
Write-Host "Generated drawable/ic_launcher_foreground.png (${fgDim}x${fgDim})"

$srcImage.Dispose()
Write-Host "All icons generated successfully!"

