param(
    [string]$RuntimeDir = (Join-Path $PSScriptRoot '..\runtime'),
    [switch]$CheckOnly,
    [switch]$Force,
    [switch]$SkipNode,
    [switch]$SkipPython
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$nodeVersion = '24.14.1'
$nodeArchiveName = "node-v$nodeVersion-win-x64.zip"
$nodeArchiveRoot = "node-v$nodeVersion-win-x64"
$nodeUrl = "https://nodejs.org/dist/v$nodeVersion/$nodeArchiveName"
$nodeSha256 = '6E50CE5498C0CEBC20FD39AB3FF5DF836ED2F8A31AA093CECAD8497CFF126D70'

$pythonVersion = '3.13.13'
$pythonArchiveName = "python-$pythonVersion-embed-amd64.zip"
$pythonUrl = "https://www.python.org/ftp/python/$pythonVersion/$pythonArchiveName"
$pythonSha256 = '8766A8775746235E23CF5AEE5027AB1060BB981D93110577ADCF3508AA0CBD55'

$getPipUrl = 'https://bootstrap.pypa.io/get-pip.py'
$getPipSha256 = '106AE019E371C7D8CB3699C75607A9B7A4D31E2B95C575362C8BCFE3D41353FD'

function Get-FullPath {
    param([string]$Path)
    return [IO.Path]::GetFullPath($Path)
}

function Assert-ChildPath {
    param(
        [string]$Path,
        [string]$Root
    )

    $fullPath = Get-FullPath $Path
    $fullRoot = Get-FullPath $Root
    $rootWithSlash = $fullRoot.TrimEnd('\') + '\'

    if (($fullPath -ne $fullRoot) -and (-not $fullPath.StartsWith($rootWithSlash, [StringComparison]::OrdinalIgnoreCase))) {
        throw "Refusing to modify a path outside the runtime directory: $fullPath"
    }

    return $fullPath
}

function Remove-RuntimeChild {
    param(
        [string]$Path,
        [string]$Root
    )

    $safePath = Assert-ChildPath -Path $Path -Root $Root
    if (Test-Path -LiteralPath $safePath) {
        Remove-Item -LiteralPath $safePath -Recurse -Force
    }
}

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToUpperInvariant()
}

function Save-Download {
    param(
        [string]$Url,
        [string]$Destination,
        [string]$Sha256
    )

    if ((Test-Path -LiteralPath $Destination) -and -not $Force) {
        if ((Get-Sha256 $Destination) -eq $Sha256) {
            Write-Host "[OK] $([IO.Path]::GetFileName($Destination)) already present"
            return
        }

        Write-Host "[WARN] Existing $([IO.Path]::GetFileName($Destination)) failed hash check; redownloading"
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

function Get-CommandOutput {
    param(
        [string]$Command,
        [string[]]$Arguments = @()
    )

    try {
        $output = & $Command @Arguments 2>$null
        if ($LASTEXITCODE -eq 0) {
            return (($output | Select-Object -First 1) -as [string])
        }
    } catch {
        return $null
    }

    return $null
}

function Test-NodeReady {
    param([string]$NodeDir)

    $nodeExe = Join-Path $NodeDir 'node.exe'
    $npmCmd = Join-Path $NodeDir 'npm.cmd'
    if ((-not (Test-Path -LiteralPath $nodeExe)) -or (-not (Test-Path -LiteralPath $npmCmd))) {
        return $false
    }

    $version = Get-CommandOutput -Command $nodeExe -Arguments @('--version')
    if ($version -ne "v$nodeVersion") {
        return $false
    }

    $npmVersion = Get-CommandOutput -Command $npmCmd -Arguments @('--version')
    return -not [string]::IsNullOrWhiteSpace($npmVersion)
}

function Install-Node {
    param(
        [string]$RuntimeRoot,
        [string]$CacheDir
    )

    $nodeDir = Join-Path $RuntimeRoot 'node'
    if ((Test-NodeReady $nodeDir) -and -not $Force) {
        Write-Host "[OK] Node.js v$nodeVersion already installed in runtime\node"
        return
    }

    $nodeArchive = Join-Path $CacheDir $nodeArchiveName
    Save-Download -Url $nodeUrl -Destination $nodeArchive -Sha256 $nodeSha256

    $extractDir = Join-Path $CacheDir 'node-extract'
    Remove-RuntimeChild -Path $extractDir -Root $RuntimeRoot
    New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
    Expand-Archive -LiteralPath $nodeArchive -DestinationPath $extractDir -Force

    $extractedRoot = Join-Path $extractDir $nodeArchiveRoot
    if (-not (Test-Path -LiteralPath (Join-Path $extractedRoot 'node.exe'))) {
        throw 'Node.js archive did not contain node.exe where expected.'
    }

    Remove-RuntimeChild -Path $nodeDir -Root $RuntimeRoot
    [void](Assert-ChildPath -Path $extractedRoot -Root $RuntimeRoot)
    [void](Assert-ChildPath -Path $nodeDir -Root $RuntimeRoot)
    Move-Item -LiteralPath $extractedRoot -Destination $nodeDir

    $installedVersion = Get-CommandOutput -Command (Join-Path $nodeDir 'node.exe') -Arguments @('--version')
    $npmVersion = Get-CommandOutput -Command (Join-Path $nodeDir 'npm.cmd') -Arguments @('--version')
    Write-Host "[OK] Node.js $installedVersion installed with npm $npmVersion"
}

function Get-PythonVersion {
    param([string]$PythonExe)
    return Get-CommandOutput -Command $PythonExe -Arguments @('-c', 'import sys; print(sys.version.split()[0])')
}

function Enable-PythonSite {
    param([string]$PythonDir)

    $pthFile = Get-ChildItem -LiteralPath $PythonDir -Filter 'python*._pth' | Select-Object -First 1
    if (-not $pthFile) {
        throw 'Python embeddable package did not include a python*._pth file.'
    }

    $content = Get-Content -LiteralPath $pthFile.FullName
    if ($content -contains 'import site') {
        return
    }

    $updated = $false
    $newContent = foreach ($line in $content) {
        if ($line -eq '#import site') {
            $updated = $true
            'import site'
        } else {
            $line
        }
    }

    if (-not $updated) {
        $newContent += 'import site'
    }

    Set-Content -LiteralPath $pthFile.FullName -Value $newContent -Encoding ascii
}

function Test-PythonReady {
    param([string]$PythonDir)

    $pythonExe = Join-Path $PythonDir 'python.exe'
    if (-not (Test-Path -LiteralPath $pythonExe)) {
        return $false
    }

    $installedVersion = Get-PythonVersion $pythonExe
    if ($installedVersion -ne $pythonVersion) {
        return $false
    }

    $pipVersion = Get-CommandOutput -Command $pythonExe -Arguments @('-m', 'pip', '--version')
    return -not [string]::IsNullOrWhiteSpace($pipVersion)
}

function Install-Pip {
    param(
        [string]$PythonExe,
        [string]$CacheDir
    )

    $pipVersion = Get-CommandOutput -Command $PythonExe -Arguments @('-m', 'pip', '--version')
    if ((-not [string]::IsNullOrWhiteSpace($pipVersion)) -and -not $Force) {
        Write-Host "[OK] $pipVersion"
        return
    }

    $getPipScript = Join-Path $CacheDir 'get-pip.py'
    Save-Download -Url $getPipUrl -Destination $getPipScript -Sha256 $getPipSha256
    Write-Host '[INFO] Installing pip into runtime\python'
    & $PythonExe $getPipScript --no-warn-script-location
    if ($LASTEXITCODE -ne 0) {
        throw 'pip bootstrap failed.'
    }
}

function Install-Python {
    param(
        [string]$RuntimeRoot,
        [string]$CacheDir
    )

    $pythonDir = Join-Path $RuntimeRoot 'python'
    $pythonExe = Join-Path $pythonDir 'python.exe'

    if ((Test-PythonReady $pythonDir) -and -not $Force) {
        Write-Host "[OK] Python $pythonVersion already installed in runtime\python"
        return
    }

    $needsExtract = $Force -or (-not (Test-Path -LiteralPath $pythonExe)) -or ((Get-PythonVersion $pythonExe) -ne $pythonVersion)
    if ($needsExtract) {
        $pythonArchive = Join-Path $CacheDir $pythonArchiveName
        Save-Download -Url $pythonUrl -Destination $pythonArchive -Sha256 $pythonSha256

        $extractDir = Join-Path $CacheDir 'python-extract'
        Remove-RuntimeChild -Path $extractDir -Root $RuntimeRoot
        New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
        Expand-Archive -LiteralPath $pythonArchive -DestinationPath $extractDir -Force

        if (-not (Test-Path -LiteralPath (Join-Path $extractDir 'python.exe'))) {
            throw 'Python archive did not contain python.exe where expected.'
        }

        Remove-RuntimeChild -Path $pythonDir -Root $RuntimeRoot
        New-Item -ItemType Directory -Force -Path $pythonDir | Out-Null
        Copy-Item -Path (Join-Path $extractDir '*') -Destination $pythonDir -Recurse -Force
    }

    Enable-PythonSite -PythonDir $pythonDir
    Install-Pip -PythonExe $pythonExe -CacheDir $CacheDir

    $installedVersion = Get-PythonVersion $pythonExe
    $pipVersion = Get-CommandOutput -Command $pythonExe -Arguments @('-m', 'pip', '--version')
    Write-Host "[OK] Python $installedVersion installed"
    Write-Host "[OK] $pipVersion"
}

$runtimeRoot = Get-FullPath $RuntimeDir
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
$cacheDir = Join-Path $runtimeRoot '.download'
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

if ($CheckOnly) {
    if (-not $SkipNode) {
        if (Test-NodeReady (Join-Path $runtimeRoot 'node')) {
            Write-Host "[OK] Node.js v$nodeVersion runtime is ready"
        } else {
            Write-Host "[WARN] Node.js runtime is missing or not v$nodeVersion"
        }
    }

    if (-not $SkipPython) {
        if (Test-PythonReady (Join-Path $runtimeRoot 'python')) {
            Write-Host "[OK] Python $pythonVersion runtime with pip is ready"
        } else {
            Write-Host "[WARN] Python runtime is missing, not $pythonVersion, or lacks pip"
        }
    }

    exit 0
}

if (-not $SkipNode) {
    Install-Node -RuntimeRoot $runtimeRoot -CacheDir $cacheDir
}

if (-not $SkipPython) {
    Install-Python -RuntimeRoot $runtimeRoot -CacheDir $cacheDir
}
