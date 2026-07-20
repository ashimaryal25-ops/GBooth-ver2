param(
  [Parameter(Mandatory = $true)]
  [string]$ImagePath,

  [string]$PrinterName = "",

  [string]$JobName = "CardifyBooth card",

  [ValidateSet("FitPage", "Fill4x6", "RollWidth4", "DoubleStrip4x6")]
  [string]$Mode = "FitPage",

  [double]$RollWidthInches = 4.0,

  [double]$HorizontalOffset = 0.0,

  [double]$VerticalOffset = 0.0
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ImagePath -PathType Leaf)) {
  throw "Print image not found: $ImagePath"
}

Add-Type -AssemblyName System.Drawing

$resolvedImagePath = (Resolve-Path -LiteralPath $ImagePath).Path
$image = $null
$document = $null

try {
  $image = [System.Drawing.Image]::FromFile($resolvedImagePath)
  $document = New-Object System.Drawing.Printing.PrintDocument
  $document.DocumentName = $JobName
  $document.OriginAtMargins = $false
  $document.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins 0, 0, 0, 0

  # The 2-inch cut is a property of a dedicated DNP queue, not of this script.
  # Collage sheets only come out pre-cut when the job is sent to that queue, so
  # every way of missing it is reported loudly here — silently printing an uncut
  # sheet is what makes this look like a code bug when it is a queue problem.
  if ($PrinterName.Trim().Length -gt 0) {
    $selectedPrinter = $PrinterName

    if ($Mode -eq "DoubleStrip4x6") {
      $stripPrinterName = $env:CARDIFYBOOTH_STRIP_PRINTER_NAME
      if ([string]::IsNullOrWhiteSpace($stripPrinterName)) {
        $stripPrinterName = "$PrinterName-Strips"
      }

      if (Get-Printer -Name $stripPrinterName -ErrorAction SilentlyContinue) {
        Write-Output "Collage mode: using strip queue '$stripPrinterName' (this is the queue that cuts)."
        $selectedPrinter = $stripPrinterName
      } else {
        Write-Warning "Collage mode: strip queue '$stripPrinterName' NOT FOUND. Printing to '$PrinterName' instead, so THE SHEET WILL NOT BE CUT."
        Write-Warning "Fix: create a printer queue named '$stripPrinterName' with the DNP 2 inch cut enabled, or set CARDIFYBOOTH_STRIP_PRINTER_NAME to the queue that cuts."
        Write-Warning "Queues available: $((Get-Printer | Select-Object -ExpandProperty Name) -join ', ')"
      }
    }

    $document.PrinterSettings.PrinterName = $selectedPrinter
  } elseif ($Mode -eq "DoubleStrip4x6") {
    # The strip-queue lookup above is built from $PrinterName, so with no printer
    # configured there is nothing to append "-Strips" to and the job goes to the
    # Windows default queue uncut.
    Write-Warning "Collage mode: CARDIFYBOOTH_PRINTER_NAME is not set, so the strip queue cannot be found and THE SHEET WILL NOT BE CUT."
    Write-Warning "Fix: set CARDIFYBOOTH_PRINTER_NAME in .env.local to the DNP printer name."
  }

  if (-not $document.PrinterSettings.IsValid) {
    if ($PrinterName.Trim().Length -gt 0) {
      throw "Printer is not available: $PrinterName"
    }

    throw "Windows does not have a valid default printer configured."
  }

  if ($Mode -eq "RollWidth4") {
    $imageRatio = $image.Width / $image.Height
    $paperWidthHundredths = [Math]::Max(1, [int][Math]::Round($RollWidthInches * 100))
    $paperHeightHundredths = [Math]::Max(1, [int][Math]::Round(($RollWidthInches / $imageRatio) * 100))
    $paperName = "CardifyBooth roll $($RollWidthInches.ToString('0.##'))x$(($RollWidthInches / $imageRatio).ToString('0.##'))"

    $document.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize $paperName, $paperWidthHundredths, $paperHeightHundredths
  } elseif ($Mode -eq "DoubleStrip4x6" -or $Mode -eq "Fill4x6") {
    Write-Output "Supported paper sizes for printer '$($document.PrinterSettings.PrinterName)':"
    $paperSizes = @($document.PrinterSettings.PaperSizes)
    foreach ($ps in $paperSizes) {
      Write-Output "  Name: $($ps.PaperName), Width: $($ps.Width), Height: $($ps.Height)"
    }

    $targetPaperSize = $null
    $preferences = @("PR (4x6)", "4x6", "4x6 inch", "PR (4x6) x 2", "(6x4)")
    
    foreach ($pref in $preferences) {
      foreach ($ps in $paperSizes) {
        if ($ps.PaperName -eq $pref) {
          $targetPaperSize = $ps
          break
        }
      }
      if ($targetPaperSize -ne $null) { break }
    }

    # If no exact match by preference name, fallback to approximate dimensions check
    if ($targetPaperSize -eq $null) {
      foreach ($ps in $paperSizes) {
        $w = $ps.Width
        $h = $ps.Height
        if ((($w -ge 380 -and $w -le 430) -and ($h -ge 580 -and $h -le 630)) -or 
            (($w -ge 580 -and $w -le 630) -and ($h -ge 380 -and $h -le 430))) {
          $targetPaperSize = $ps
          break
        }
      }
    }

    if ($targetPaperSize -ne $null) {
      Write-Output "Selected paper size: $($targetPaperSize.PaperName) ($($targetPaperSize.Width)x$($targetPaperSize.Height))"
      $document.DefaultPageSettings.PaperSize = $targetPaperSize
      if ($targetPaperSize.Width -gt $targetPaperSize.Height) {
        Write-Output "Setting Landscape = True"
        $document.DefaultPageSettings.Landscape = $true
      } else {
        Write-Output "Setting Landscape = False"
        $document.DefaultPageSettings.Landscape = $false
      }
    } else {
      Write-Output "No native 4x6 paper size found. Falling back to custom paper size."
      $document.DefaultPageSettings.Landscape = $false
      $document.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize "CardifyBooth Fallback 4x6", 400, 600
    }
  }

  $document.add_PrintPage({
    param($sender, $eventArgs)

    if ($Mode -eq "RollWidth4") {
      $bounds = $eventArgs.PageBounds
      $eventArgs.Graphics.DrawImage($image, $bounds)
    } elseif ($Mode -eq "DoubleStrip4x6") {
      $bounds = $eventArgs.PageBounds
      $isLandscape = $eventArgs.PageSettings.Landscape -or ($bounds.Width -gt $bounds.Height)

      if ($isLandscape) {
        # Landscape 6x4: Top half and bottom half strips
        $halfHeight = $bounds.Height / 2
        
        $rotatedImage = $image.Clone()
        $rotatedImage.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone)

        try {
          $topTarget = New-Object System.Drawing.RectangleF ($bounds.X + $HorizontalOffset), ($bounds.Y + $VerticalOffset), $bounds.Width, $halfHeight
          $bottomTarget = New-Object System.Drawing.RectangleF ($bounds.X + $HorizontalOffset), ($bounds.Y + $halfHeight + $VerticalOffset), $bounds.Width, $halfHeight

          # Fill top half (cover), clipped to the half, so the strip bleeds to
          # every edge with no white paper and the centre cut stays symmetric.
          $scale1 = [Math]::Max($topTarget.Width / $rotatedImage.Width, $topTarget.Height / $rotatedImage.Height)
          $w1 = $rotatedImage.Width * $scale1
          $h1 = $rotatedImage.Height * $scale1
          $x1 = $topTarget.X + (($topTarget.Width - $w1) / 2)
          $y1 = $topTarget.Y + (($topTarget.Height - $h1) / 2)
          $eventArgs.Graphics.SetClip($topTarget)
          $eventArgs.Graphics.DrawImage($rotatedImage, $x1, $y1, $w1, $h1)
          $eventArgs.Graphics.ResetClip()

          # Fill bottom half (cover), clipped to the half.
          $scale2 = [Math]::Max($bottomTarget.Width / $rotatedImage.Width, $bottomTarget.Height / $rotatedImage.Height)
          $w2 = $rotatedImage.Width * $scale2
          $h2 = $rotatedImage.Height * $scale2
          $x2 = $bottomTarget.X + (($bottomTarget.Width - $w2) / 2)
          $y2 = $bottomTarget.Y + (($bottomTarget.Height - $h2) / 2)
          $eventArgs.Graphics.SetClip($bottomTarget)
          $eventArgs.Graphics.DrawImage($rotatedImage, $x2, $y2, $w2, $h2)
          $eventArgs.Graphics.ResetClip()
        } finally {
          $rotatedImage.Dispose()
        }
      } else {
        # Portrait 4x6 cut vertically down the centre into two 2x6 strips.
        $halfWidth = $bounds.Width / 2
        $imageAspect = $image.Width / $image.Height
        $halfAspect = $halfWidth / $bounds.Height  # ~0.333 for 4x6

        if ($imageAspect -gt ($halfAspect * 1.5)) {
          # The image is already composed with two strips at ~4:6 ratio
          # (the client handled gutter math). Just fill the whole page.
          $scale = [Math]::Max($bounds.Width / $image.Width, $bounds.Height / $image.Height)
          $w = $image.Width * $scale
          $h = $image.Height * $scale
          $x = $bounds.X + (($bounds.Width - $w) / 2) + $HorizontalOffset
          $y = $bounds.Y + (($bounds.Height - $h) / 2) + $VerticalOffset
          $eventArgs.Graphics.SetClip($bounds)
          $eventArgs.Graphics.DrawImage($image, $x, $y, $w, $h)
          $eventArgs.Graphics.ResetClip()
        } else {
          # Single strip — duplicate into left and right halves, filled (cover)
          # and clipped so neither bleeds into the other.
          $leftTarget = New-Object System.Drawing.RectangleF ($bounds.X + $HorizontalOffset), ($bounds.Y + $VerticalOffset), $halfWidth, $bounds.Height
          $rightTarget = New-Object System.Drawing.RectangleF ($bounds.X + $halfWidth + $HorizontalOffset), ($bounds.Y + $VerticalOffset), $halfWidth, $bounds.Height

          # Fill left half (cover), clipped to the half.
          $scale1 = [Math]::Max($leftTarget.Width / $image.Width, $leftTarget.Height / $image.Height)
          $w1 = $image.Width * $scale1
          $h1 = $image.Height * $scale1
          $x1 = $leftTarget.X + (($leftTarget.Width - $w1) / 2)
          $y1 = $leftTarget.Y + (($leftTarget.Height - $h1) / 2)
          $eventArgs.Graphics.SetClip($leftTarget)
          $eventArgs.Graphics.DrawImage($image, $x1, $y1, $w1, $h1)
          $eventArgs.Graphics.ResetClip()

          # Fill right half (cover), clipped to the half.
          $scale2 = [Math]::Max($rightTarget.Width / $image.Width, $rightTarget.Height / $image.Height)
          $w2 = $image.Width * $scale2
          $h2 = $image.Height * $scale2
          $x2 = $rightTarget.X + (($rightTarget.Width - $w2) / 2)
          $y2 = $rightTarget.Y + (($rightTarget.Height - $h2) / 2)
          $eventArgs.Graphics.SetClip($rightTarget)
          $eventArgs.Graphics.DrawImage($image, $x2, $y2, $w2, $h2)
          $eventArgs.Graphics.ResetClip()
        }
      }
    } elseif ($Mode -eq "Fill4x6") {
      # Fill the whole 4x6 page. The card renderer is slightly narrower than
      # 4x6, so "fit" creates white bars on the left and right. "Fill" uses a
      # small top/bottom bleed instead, matching borderless photo printing.
      $bounds = $eventArgs.PageBounds
      $scale = [Math]::Max($bounds.Width / $image.Width, $bounds.Height / $image.Height)
      $width = $image.Width * $scale
      $height = $image.Height * $scale
      $x = $bounds.X + (($bounds.Width - $width) / 2)
      $y = $bounds.Y + (($bounds.Height - $height) / 2)
      $target = New-Object System.Drawing.RectangleF $x, $y, $width, $height

      $eventArgs.Graphics.SetClip($bounds)
      $eventArgs.Graphics.DrawImage($image, $target)
      $eventArgs.Graphics.ResetClip()
    } else {
      $bounds = $eventArgs.PageSettings.PrintableArea
      if ($bounds.Width -le 0 -or $bounds.Height -le 0) {
        $bounds = $eventArgs.PageBounds
      }

      $scale = [Math]::Min($bounds.Width / $image.Width, $bounds.Height / $image.Height)
      $width = $image.Width * $scale
      $height = $image.Height * $scale
      $x = $bounds.X + (($bounds.Width - $width) / 2)
      $y = $bounds.Y + (($bounds.Height - $height) / 2)
      $target = New-Object System.Drawing.RectangleF $x, $y, $width, $height

      $eventArgs.Graphics.DrawImage($image, $target)
    }

    $eventArgs.HasMorePages = $false
  })

  $document.Print()
} finally {
  if ($document -ne $null) {
    $document.Dispose()
  }

  if ($image -ne $null) {
    $image.Dispose()
  }
}
