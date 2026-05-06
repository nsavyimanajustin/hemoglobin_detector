# Setup For New Clone (Copilot-Assisted)

Use this guide when a collaborator clones the repo and needs to adapt it to their own Wi-Fi/network/serial resources.

## What Must Be Customized

1. `include/config.h`
- `WIFI_SSID`
- `WIFI_PASSWORD`
- Optional fallback AP:
  - `WIFI_AP_SSID`
  - `WIFI_AP_PASSWORD`

2. `test-server.js` runtime env vars
- `ESP32_BASE_URL` (IP of the ESP32 on their network)
- `SERIAL_PORT_PATH` (`/dev/ttyUSB0` on Linux or `COMx` on Windows)
- `ENABLE_SERIAL_BRIDGE` (`0` while flashing, `1` for serial logs)

3. PlatformIO upload target (if needed)
- `platformio.ini` board/port if their hardware differs

## Copy-Paste Prompt For Copilot

Paste this entire prompt into Copilot Chat in VS Code:

```text
You are helping me set up this cloned ESP32 project for my local machine.

Task:
1) Detect my OS (Windows/Linux/macOS).
2) Ask me for these values before changing anything:
   - Wi-Fi SSID
   - Wi-Fi password
   - Fallback AP SSID (or keep default)
   - Fallback AP password (or keep default)
   - ESP32 base URL (for example http://192.168.1.50)
   - Serial port path (Linux: /dev/ttyUSB0, Windows: COM4, etc.)
3) After I answer, update only the required values in:
   - include/config.h (WIFI_SSID, WIFI_PASSWORD, optional AP values)
4) Do not hardcode my machine-specific bridge settings in source code.
   Instead, create a local env file named `.env.local` with:
   - ESP32_BASE_URL=...
   - SERIAL_PORT_PATH=...
   - ENABLE_SERIAL_BRIDGE=0
5) Then run a quick validation sequence:
   - PlatformIO build command
   - Node syntax check for test-server.js
6) Show me exact commands to start backend with my env values loaded.
7) Warn me that serial bridge must be disabled while flashing firmware.

Important:
- Never print my Wi-Fi password in logs after capture.
- Ask for confirmation before writing files.
- Keep all edits minimal and focused only on setup.
```

## Recommended Run Commands

### Linux/macOS

```bash
cd /path/to/hemoglobin_detector
set -a
source .env.local
set +a
pio run
ENABLE_SERIAL_BRIDGE=0 pio run -t upload
npm run dev
```

### Windows PowerShell

```powershell
Set-Location C:\path\to\hemoglobin_detector
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^(.*?)=(.*)$') {
    [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
pio run
$env:ENABLE_SERIAL_BRIDGE='0'; pio run -t upload
npm run dev
```

## Notes

- If upload fails with port lock errors, stop Node backend first (`npm run dev` terminal) and flash again.
- If a collaborator uses only browser testing (no serial), keep `ENABLE_SERIAL_BRIDGE=0`.
- Share this file directly with collaborators and ask them to attach it in Copilot Chat for guided setup.
