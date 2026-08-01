param(
    [string]$Version = "latest",
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$packageName = "@logbookfordevs/afk"
$minimumNodeMajor = 20

function Write-AfkInfo {
    param([string]$Message)
    Write-Host "afk $Message" -ForegroundColor Cyan
}

function Stop-AfkInstall {
    param([string]$Message)
    [Console]::Error.WriteLine("afk $Message")
    exit 1
}

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
}
if (-not $nodeCommand) {
    Stop-AfkInstall "node >=20 is required to install and run AFK."
}

$nodeMajorText = & $nodeCommand.Source -p "Number(process.versions.node.split('.')[0])" 2>$null
$nodeMajor = 0
if (-not [int]::TryParse("$nodeMajorText", [ref]$nodeMajor) -or $nodeMajor -lt $minimumNodeMajor) {
    $nodeVersion = & $nodeCommand.Source --version 2>$null
    Stop-AfkInstall "node >=20 is required to run AFK; found $nodeVersion at $($nodeCommand.Source)."
}

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
    $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
}
if (-not $npmCommand) {
    Stop-AfkInstall "npm is required to install AFK."
}

if ($Uninstall) {
    Write-AfkInfo "removing $packageName"
    & $npmCommand.Source uninstall --global $packageName
    if ($LASTEXITCODE -ne 0) {
        Stop-AfkInstall "npm could not remove AFK."
    }
    Write-AfkInfo "removed"
    exit 0
}

if ($env:AFK_INSTALL_PACKAGE_SPEC) {
    $packageSpec = $env:AFK_INSTALL_PACKAGE_SPEC
} elseif ($Version -eq "latest") {
    $packageSpec = "$packageName@latest"
} else {
    $normalizedVersion = $Version.TrimStart("v")
    if ($normalizedVersion -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') {
        Stop-AfkInstall "invalid version: $Version"
    }
    $packageSpec = "$packageName@$normalizedVersion"
}

Write-AfkInfo "installing $packageSpec"
& $npmCommand.Source install --global --ignore-scripts $packageSpec
if ($LASTEXITCODE -ne 0) {
    Stop-AfkInstall "npm could not install AFK."
}

$npmPrefix = (& $npmCommand.Source prefix --global).Trim()
$afkCommand = Get-Command afk.cmd -ErrorAction SilentlyContinue
if (-not $afkCommand -and $npmPrefix) {
    $candidate = Join-Path $npmPrefix "afk.cmd"
    if (Test-Path $candidate) {
        $afkCommand = Get-Item $candidate
    }
}
if (-not $afkCommand) {
    Stop-AfkInstall "AFK installed, but afk.cmd could not be found. Ensure the npm global prefix is on PATH: $npmPrefix"
}

$afkPath = if ($afkCommand.Path) { $afkCommand.Path } elseif ($afkCommand.FullName) { $afkCommand.FullName } else { $afkCommand.Source }
$installedVersion = & $afkPath --version
if ($LASTEXITCODE -ne 0) {
    Stop-AfkInstall "AFK installed, but the command verification failed."
}

Write-AfkInfo "installed $installedVersion"
Write-AfkInfo "ready: $afkPath"
