# Groundwork H0 host scan for native Windows (PowerShell 5.1+). Same JSON shape as scan.sh.
# Usage: powershell -ExecutionPolicy Bypass -File scan.ps1 [-Out path]
param([string]$Out)
$ErrorActionPreference = 'SilentlyContinue'

# -CommandType: a miss would otherwise search every module for a cmdlet of that name (about 1.5 s per tool)
function Has($c) { [bool](Get-Command $c -CommandType Application, ExternalScript -ErrorAction SilentlyContinue) }
function Ver($cmd, $arg) {
  if (-not (Has $cmd)) { return $null }
  $o = (& $cmd $arg 2>&1 | Out-String)
  # no version and a failing exit: a stub such as the WindowsApps python.exe (exit 9009, "Python was not found")
  if ($o -match '\d+(\.\d+)+') { $Matches[0] } elseif ($LASTEXITCODE -eq 0) { 'present' } else { $null }
}

$os   = Get-CimInstance Win32_OperatingSystem
$cpu  = Get-CimInstance Win32_Processor | Select-Object -First 1
$cs   = Get-CimInstance Win32_ComputerSystem
$gpu  = Get-CimInstance Win32_VideoController | Select-Object -First 1
$drive = (Get-Location).Drive
$freeGb = if ($drive) { [int]($drive.Free / 1GB) } else { $null }
$battery = [bool](Get-CimInstance Win32_Battery)

$arch = switch ($env:PROCESSOR_ARCHITECTURE) { 'AMD64' {'x86_64'} 'ARM64' {'arm64'} default {$env:PROCESSOR_ARCHITECTURE} }
$isVm = $cs.Model -match 'Virtual|VMware|KVM|QEMU|HVM' -or $cs.Manufacturer -match 'QEMU|Xen|innotek|Parallels'
$kind = if ($isVm) {'vm'} elseif ($battery) {'laptop'} else {'desktop'}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
# Feature queries need admin; when not admin these stay $false and are reported as unknown via *_checked.
$hyperv = $false; $wsl2 = $false; $featChecked = $false
if ($isAdmin) {
  $featChecked = $true
  $hyperv = (Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All).State -eq 'Enabled'
  $wsl2   = (Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform).State -eq 'Enabled'
}
# wsl.exe is an inbox stub on Windows 11: it exists without WSL installed, and prints UTF-16 unless WSL_UTF8 is set
$env:WSL_UTF8 = '1'; $wslVer = $null
if (Has 'wsl') { $o = (wsl --version 2>&1 | Out-String); if ($LASTEXITCODE -eq 0 -and $o -match '\d+(\.\d+)+') { $wslVer = $Matches[0] } }
if (-not $wsl2 -and $wslVer) { $wsl2 = ((wsl --status 2>&1 | Out-String) -match '\b2\b') }

$dockerOk = $false; $dockerWhy = ''
if (Has 'docker') { docker info *> $null; $dockerOk = ($LASTEXITCODE -eq 0); if (-not $dockerOk) { $dockerWhy = 'daemon not running (start Docker Desktop)' } }

$pkg = @('winget','choco','scoop') | Where-Object { Has $_ }

$tools = [ordered]@{}
$probe = [ordered]@{ git='--version'; gh='--version'; node='--version'; npm='--version'; pnpm='--version'; bun='--version';
  python='--version'; uv='--version'; java='-version'; gradle='--version'; adb='version'; flutter='--version'; dart='--version';
  dotnet='--version'; go='version'; rustc='--version'; cargo='--version'; cmake='--version'; 'qemu-system-x86_64'='--version';
  playwright='--version'; appium='--version'; maestro='--version'; mise='--version'; claude='--version'; skillspector='--version'; rea='--version'; scrapling='--version'; godot='--version' }
foreach ($k in $probe.Keys) { $v = Ver $k $probe[$k]; if ($v) { $tools[$k -replace '-system-x86_64',''] = $v } }
if ($wslVer) { $tools['wsl'] = $wslVer }
if (Test-Path "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe") { $tools['msvc'] = 'present' }

$hp = [ordered]@{
  schema = 'groundwork.host-profile.v1'; scanned_at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); scanner = 'scan.ps1'
  os = [ordered]@{ family='windows'; distro=$os.Caption; version=$os.Version; kernel=$os.BuildNumber; wsl=$false; wsl2_available=$wsl2; package_managers=($pkg -join ' ') }
  cpu = [ordered]@{ arch=$arch; model=$cpu.Name.Trim(); threads=[int]$cpu.NumberOfLogicalProcessors; virt_extensions=[bool]$cpu.VirtualizationFirmwareEnabled }
  memory = [ordered]@{ total_gb = [int]($cs.TotalPhysicalMemory / 1GB) }
  disk = [ordered]@{ free_gb_workdir = $freeGb }
  gpu = [ordered]@{ model = $gpu.Name }
  machine = [ordered]@{ kind=$kind; hypervisor= $(if ($isVm) {$cs.Model} else {''}); battery=$battery }
  virtualization = [ordered]@{ kvm_usable=$false; apple_vz=$false; hyperv_enabled=$hyperv; hypervisor_present=[bool]$cs.HypervisorPresent; features_checked=$featChecked }
  containers = [ordered]@{ docker_installed=(Has 'docker'); docker_daemon_ok=$dockerOk; docker_problem=$dockerWhy; compose=$dockerOk; podman_ok=$false }
  display = [ordered]@{ gui = [Environment]::UserInteractive }
  user = [ordered]@{ admin_noninteractive=$isAdmin; proxy=[bool]($env:HTTPS_PROXY) }
  toolchains = $tools
}
$json = $hp | ConvertTo-Json -Depth 5
if ($Out) {   # UTF-8 without a BOM: Set-Content -Encoding UTF8 in PowerShell 5.1 adds one, and JSON parsers reject it
  $Out = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Out)
  New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null; [IO.File]::WriteAllText($Out, $json, [Text.UTF8Encoding]::new($false)); Write-Host "wrote $Out" }
else { $json }
