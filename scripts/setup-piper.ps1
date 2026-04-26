param(
    [string]$ModelsDir = (Join-Path $PSScriptRoot '..\models'),
    [ValidateSet('minimal', 'starter', 'all')]
    [string]$VoiceSet = 'starter',
    [string[]]$Voices = @(),
    [switch]$List,
    [switch]$CheckOnly,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$piperRuntimeUrl = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip'
$piperRuntimeSha256 = 'F3C58906402B24F3A96D92145F58ACBA6D86C9B5DB896D207F78DC80811EFCEA'
$voiceRepoBaseUrl = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0'

$voiceCatalog = @(
    @{
        Id = 'en_US-lessac-medium'
        Path = 'en/en_US/lessac/medium'
        Label = 'US English - Lessac - medium - female'
        Sets = @('minimal', 'starter', 'all')
        OnnxSha256 = '5EFE09E69902187827AF646E1A6E9D269DEE769F9877D17B16B1B46EEAAF019F'
        ConfigSha256 = 'EFE19C417BED055F2D69908248C6BA650FA135BC868B0E6ABB3DA181DAB690A0'
    },
    @{
        Id = 'en_US-ryan-medium'
        Path = 'en/en_US/ryan/medium'
        Label = 'US English - Ryan - medium - male'
        Sets = @('starter', 'all')
        OnnxSha256 = 'ABF4C274862564ED647BA0D2C47F8EE7C9B717D27BDAD9219100EB310DB4047A'
        ConfigSha256 = '44034C056CB15681B2AD494307C7F3F2E4499D1253C700C711FA0A4607FFE78D'
    },
    @{
        Id = 'en_US-amy-low'
        Path = 'en/en_US/amy/low'
        Label = 'US English - Amy - low - female'
        Sets = @('starter', 'all')
        OnnxSha256 = 'A5A91ABB7DE0F104358A25ADED480DDACF1FF0762886325886EC406A2E86AAB3'
        ConfigSha256 = '2250A9A605B8DC35A116717FADC5056695DD809E34A15D02F72A0F52D53D3EBB'
    },
    @{
        Id = 'en_GB-alan-medium'
        Path = 'en/en_GB/alan/medium'
        Label = 'UK English - Alan - medium - male'
        Sets = @('starter', 'all')
        OnnxSha256 = '0A309668932205E762801F1EFC2736CD4B0120329622ADF62BE09E56339D3330'
        ConfigSha256 = 'C0F0D124E5895C00E7C03B35DCC8287F319A6998A365B182DEB5C8E752EE8C1E'
    },
    @{
        Id = 'en_GB-alba-medium'
        Path = 'en/en_GB/alba/medium'
        Label = 'UK English - Alba - medium - female'
        Sets = @('starter', 'all')
        OnnxSha256 = '401369C4A81D09FDD86C32C5C864440811DBDCC66466CDE2D64F7133A66AD03B'
        ConfigSha256 = 'AA965A2F02ECCED632C2694E1FC72BBFF6D65F265FAB567CA945918C73DD89F4'
    },
    @{
        Id = 'en_GB-cori-medium'
        Path = 'en/en_GB/cori/medium'
        Label = 'UK English - Cori - medium - female'
        Sets = @('starter', 'all')
        OnnxSha256 = '1899F98E5FB8310154F3C2973F4B8A929BA7245E722B3D3A85680B833D95F10D'
        ConfigSha256 = 'E262C16D7F192F69D4EDD6B4EF8A5915379E67495FCC402F1AB15EEB33DA3D36'
    },
    @{
        Id = 'en_GB-jenny_dioco-medium'
        Path = 'en/en_GB/jenny_dioco/medium'
        Label = 'UK English - Jenny Dioco - medium - female'
        Sets = @('all')
        OnnxSha256 = '469C630D209E139DD392A66BF4ABDE4AB86390A0269C1E47B4E5D7CE81526B01'
        ConfigSha256 = 'A9A7A93A317C9A3CB6563E37EB057DF9EF09C06188A8A4341B0FCB58CBA54DD4'
    },
    @{
        Id = 'en_GB-northern_english_male-medium'
        Path = 'en/en_GB/northern_english_male/medium'
        Label = 'UK English - Northern English Male - medium - male'
        Sets = @('all')
        OnnxSha256 = '57A219AE8E638873DB7D18893304BE5069C42868F392BB95C3FF17F0690D0689'
        ConfigSha256 = '69557ED3D974463453E9B0C09DD99A7ED0E52B8B87B64B357DBEEB2540A97D47'
    },
    @{
        Id = 'en_GB-aru-medium'
        Path = 'en/en_GB/aru/medium'
        Label = 'UK English - Aru - medium - female'
        Sets = @('all')
        OnnxSha256 = '9E74D089A8563F8B2446426D01BECB046CD3C3BFBAFE1A20FD03A9A79BD82619'
        ConfigSha256 = '00529FABF0E79F29A9CB10FDA5B60F9B7CF80671FAAC2B316E13AF20E7816D5E'
    },
    @{
        Id = 'de_DE-thorsten-medium'
        Path = 'de/de_DE/thorsten/medium'
        Label = 'German - Thorsten - medium - male'
        Sets = @('all')
        OnnxSha256 = '7E64762D8E5118BB578F2EEA6207E1A35A8E0C30595010B666F983FC87BB7819'
        ConfigSha256 = '974ADEE790533ADB273A1AC88F49027D2A1B8F0F2CF4905954A4791E79264E85'
    },
    @{
        Id = 'de_DE-kerstin-low'
        Path = 'de/de_DE/kerstin/low'
        Label = 'German - Kerstin - low - female'
        Sets = @('all')
        OnnxSha256 = 'D352A7641892CEBF2903859AF94E9BA81A141110215FE3943BCDA7F7DA401B7A'
        ConfigSha256 = '56E708556B7B9B7A53C4F8957E021421E69F11A600962BBA554CFFBE72CF2D47'
    }
)

function Get-Sha256([string]$Path) {
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToUpperInvariant()
}

function Test-Hash {
    param(
        [string]$Path,
        [string]$Sha256
    )

    return (Test-Path -LiteralPath $Path) -and ((Get-Sha256 $Path) -eq $Sha256)
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

function Get-SelectedVoices {
    $requested = @()
    foreach ($voice in $Voices) {
        if (-not [string]::IsNullOrWhiteSpace($voice)) {
            $requested += ($voice -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        }
    }

    if ($requested.Count -gt 0) {
        $selected = foreach ($voiceId in $requested) {
            $match = $voiceCatalog | Where-Object { $_.Id -eq $voiceId } | Select-Object -First 1
            if (-not $match) {
                throw "Unknown Piper voice '$voiceId'. Run scripts\setup-piper.ps1 -List to see available voices."
            }
            $match
        }
        return @($selected)
    }

    return @($voiceCatalog | Where-Object { $_.Sets -contains $VoiceSet })
}

if ($List) {
    Write-Host 'Available Piper voices:'
    foreach ($voice in $voiceCatalog) {
        Write-Host ("  {0,-40} {1,-8} {2}" -f $voice.Id, ($voice.Sets -join ','), $voice.Label)
    }
    exit 0
}

New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null
$ModelsDir = (Resolve-Path -LiteralPath $ModelsDir).Path
$cacheDir = Join-Path $ModelsDir '.download'

[array]$selectedVoices = @(Get-SelectedVoices)
$selectionLabel = if (($Voices | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count -gt 0) { 'custom' } else { $VoiceSet }

if ($CheckOnly) {
    if (Test-Path -LiteralPath (Join-Path $ModelsDir 'piper.exe')) {
        Write-Host '[OK] Piper runtime found'
    } else {
        Write-Host '[WARN] Piper runtime is missing. Run setup.bat to download it.'
    }

    $missing = 0
    foreach ($voice in $selectedVoices) {
        $onnxPath = Join-Path $ModelsDir "$($voice.Id).onnx"
        $configPath = Join-Path $ModelsDir "$($voice.Id).onnx.json"

        if ((Test-Hash -Path $onnxPath -Sha256 $voice.OnnxSha256) -and (Test-Hash -Path $configPath -Sha256 $voice.ConfigSha256)) {
            Write-Host "[OK] $($voice.Id)"
        } else {
            $missing++
            Write-Host "[WARN] $($voice.Id) missing or hash mismatch"
        }
    }

    if ($missing -eq 0) {
        Write-Host "[OK] Piper voice set '$selectionLabel' is ready ($($selectedVoices.Count) voices)"
    } else {
        Write-Host "[WARN] Piper voice set '$selectionLabel' needs $missing voice(s). Run setup.bat to download them."
    }
    exit 0
}

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

Write-Host "[INFO] Installing Piper voice set '$selectionLabel' ($($selectedVoices.Count) voices)"
foreach ($voice in $selectedVoices) {
    $voiceBaseUrl = "$voiceRepoBaseUrl/$($voice.Path)"
    Save-Download -Url "$voiceBaseUrl/$($voice.Id).onnx" -Destination (Join-Path $ModelsDir "$($voice.Id).onnx") -Sha256 $voice.OnnxSha256
    Save-Download -Url "$voiceBaseUrl/$($voice.Id).onnx.json" -Destination (Join-Path $ModelsDir "$($voice.Id).onnx.json") -Sha256 $voice.ConfigSha256
}

Write-Host "[OK] Piper voice set installed: $selectionLabel"
