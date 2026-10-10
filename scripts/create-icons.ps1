Add-Type -AssemblyName System.Drawing
foreach ($size in @(192,512,180)) {
  $bitmap = New-Object System.Drawing.Bitmap($size,$size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#214c39'))
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#d9e5a8'))
  $pen = New-Object System.Drawing.Pen($brush,($size*0.035))
  $graphics.DrawLine($pen,($size*0.5),($size*0.71),($size*0.5),($size*0.38))
  $graphics.FillEllipse($brush,($size*0.27),($size*0.30),($size*0.23),($size*0.23))
  $graphics.FillEllipse($brush,($size*0.48),($size*0.21),($size*0.25),($size*0.23))
  $graphics.DrawLine($pen,($size*0.26),($size*0.74),($size*0.74),($size*0.74))
  $name = if ($size -eq 180) {'apple-touch-icon.png'} else {"icon-$size.png"}
  $path = Join-Path (Get-Location) "public\$name"
  $bitmap.Save($path,[System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose(); $brush.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
