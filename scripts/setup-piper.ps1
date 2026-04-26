param(
    [string]$ModelsDir = (Join-Path $PSScriptRoot '..\models'),
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$piperRuntimeUrl = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip'
$piperRuntimeSha256 = 'F3C58906402B24F3A96D92145F58ACBA6D86C9B5DB896D207F78DC80811EFCEA'

$voiceName = 'en_US-lessac-medium'
$voiceBaseUrl = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium'
$voiceFiles = @(
    @{
        Name = "$voiceName.onnx"
        Url = "$voiceBaseUrl/$voiceName.onnx"
        Sha256 = '5EFE09E69902187827AF646E1A6E9D269DEE769F9877D17B16B1B46EEAAF019F'
    },
    @{
        Name = "$voiceName.onnx.json"
        Url = "$voiceBaseUrl/$voiceName.onnx.json"
        Sha256 = 'EFE19C417BED055F2D69908248C6BA650FA135BC868B0E6ABB3DA181DAB690A0'
    },
    @{
        Name = "$voiceName.MODEL_CARD.md"
        Url = "$voiceBaseUrl/MODEL_CARD"
        Sha256 = 'CE49EB457742208166D399A40CDEC2C7FA9DB77960930031564AB56F12882645'
    }
)

function Get-Sha256([string]$Path) {
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToUpperInvariant()
}

function Save-Download {
    param(
        [string]$Url,
        [string]$Destination,
        [string]$Sha256
    )

    if ((Test-Path -LiteralPath $Destination) -and -not $Force) {
        if (Get-Sha256 $Destination -eq $Sha256) {
            Write-Host "[OK] $([IO.Path]::GetFileName($Destination)) already present"
            return
        }

        Write-Host "[WARN] Existing $([IO.Path]::GetFileName($Destination)) did not match the expected hash; redownloading"
    }

    $tempFile = "$Destination.download"
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
    Write-Host "[GET] $Url"
    Invoke-WebRequest -Uri $Url -OutFile $tempFile -UseBasicParsing

    $actual = Get-Sha256 $tempFile
    if ($actual -ne $Sha256) {
        Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
        throw "Hash check failed for $Destination. Expected $Sha256 but got $actual."
    }

    Move-Item -LiteralPath $tempFile -Destination $Destination -Force
    Write-Host "[OK] $([IO.Path]::GetFileName($Destination))"
}

New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null
$ModelsDir = (Resolve-Path -LiteralPath $ModelsDir).Path
$cacheDir = Join-Path $ModelsDir '.download'
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

if ((Test-Path -LiteralPath (Join-Path $ModelsDir 'piper.exe')) -and -not $Force) {
    Write-Host '[OK] Piper runtime already present'
} else {
    $runtimeZip = Join-Path $cacheDir 'piper_windows_amd64.zip'
    Save-Download -Url $piperRuntimeUrl -Destination $runtimeZip -Sha256 $piperRuntimeSha256

    $extractDir = Join-Path $cacheDir 'piper-runtime'
    Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
    Expand-Archive -LiteralPath $runtimeZip -DestinationPath $extractDir -Force

    $runtimeRoot = Join-Path $extractDir 'piper'
    if (-not (Test-Path -LiteralPath (Join-Path $runtimeRoot 'piper.exe'))) {
        throw "Piper runtime archive did not contain piper.exe where expected."
    }

    Copy-Item -Path (Join-Path $runtimeRoot '*') -Destination $ModelsDir -Recurse -Force
    Write-Host '[OK] Piper runtime installed'
}

foreach ($file in $voiceFiles) {
    Save-Download -Url $file.Url -Destination (Join-Path $ModelsDir $file.Name) -Sha256 $file.Sha256
}

Write-Host "[OK] Piper voice installed: $voiceName"
