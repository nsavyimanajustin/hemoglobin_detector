# Web Dashboard & REST API Implementation

This document describes the Phase 1 web integration for the Hemoglobin Detector project.

## Overview

The device now includes:

- **WiFi Connectivity** via WiFiManager with captive portal setup
- **REST API** for measurement data, history, and settings
- **Responsive Web Dashboard** hosted on the ESP32
- **Real-time Charts** using Chart.js for trend visualization
- **mDNS** for easy device discovery (http://hemoglobin-detector.local)

## Architecture

```
┌─────────────────────────────────────┐
│   Web Browser / Mobile Device       │
│   (http://hemoglobin-detector.local)│
└────────────┬────────────────────────┘
             │ HTTPS/JSON
             ↓
┌─────────────────────────────────────┐
│   AsyncWebServer (Port 80)          │
│   ├─ REST API Endpoints             │
│   ├─ WebSocket (Phase 2)            │
│   └─ Static Files (HTML/CSS/JS)     │
└────────────┬────────────────────────┘
             │
┌─────────────────────────────────────┐
│   ESP32 Measurement Engine          │
│   ├─ MAX30102 Sensor                │
│   ├─ SpO2 Calculation               │
│   ├─ Hemoglobin Estimation          │
│   └─ Status Classification          │
└─────────────────────────────────────┘
```

## New Dependencies

Added to `platformio.ini`:

```ini
lib_deps =
    sparkfun/SparkFun MAX3010x Pulse and Proximity Sensor Library@^1.1.2
    marcoschwartz/LiquidCrystal_I2C@^1.1.4
    me-no-dev/ESP Async WebServer@^1.2.3
    bblanchon/ArduinoJson@^6.21.2
    tzapu/WiFiManager@^0.16.0
```

## REST API Endpoints

### GET /api/measurements

Returns the latest single measurement

**Response:**

```json
{
  "timestamp": 45234,
  "heartRate": 72,
  "spO2": 98.5,
  "hemoglobin": 14.2,
  "status": "NORMAL (No Anemia)",
  "irValue": 87654,
  "redValue": 45321
}
```

### GET /api/history

Returns last N measurements (currently 1, expandable to full history)

**Response:**

```json
{
  "measurements": [
    {
      "timestamp": 45234,
      "heartRate": 72,
      "spO2": 98.5,
      "hemoglobin": 14.2,
      "status": "NORMAL (No Anemia)"
    }
  ]
}
```

### GET /api/settings

Returns device settings and thresholds

**Response:**

```json
{
  "displayFormat": 1,
  "sampleSize": 100,
  "spO2Min": 90,
  "spO2Max": 100,
  "hbMin": 12.0,
  "hbMax": 17.0
}
```

### GET /api/status

Device health check endpoint

**Response:**

```json
{
  "device": "Hemoglobin Detector v1.0",
  "wifiStatus": "connected",
  "uptime": 234567,
  "measuring": true
}
```

## Web Dashboard Features

### Current Implementation

- **Real-time Gauges**: Heart Rate, SpO2, Hemoglobin (large numeric display)
- **Mini Charts**: Small sparkline-style charts for each measurement
- **Status Card**: Large display of anemia status with color coding
- **Trend Chart**: Multi-axis chart showing all measurements over time
- **Sensor Details**: Raw IR/Red values, measurement status, last update time
- **Responsive Design**: Mobile-friendly layout for phones/tablets
- **Online Indicator**: Shows WiFi connection status

### Color Scheme

- **Normal**: Green (#2ecc71)
- **Mild Anemia**: Orange (#f39c12)
- **Moderate Anemia**: Red (#e67e22)
- **Severe Anemia**: Dark Red (#c0392b)

## Setup Instructions

### 1. Build & Upload Firmware

```bash
cd /home/hz/workspace/learning/platformio/hemoglobin_detector
pio run -t upload
```

The PlatformIO build system will:

- Download AsyncWebServer, WiFiManager, and ArduinoJson libraries
- Compile the firmware with web server support
- Upload to ESP32

### 2. Upload Web Files to SPIFFS

```bash
pio run -t uploadfs
```

This uploads the `data/` folder contents (HTML, CSS, JS) to ESP32's SPIFFS filesystem.

### 3. First Boot - WiFi Setup

1. Power on the ESP32
2. Connect to WiFi AP: **`Hemoglobin_Detector`** (password: `password`)
3. A captive portal should open automatically
4. Select your home WiFi SSID and enter password
5. Device will reboot and connect to your network

### 4. Access the Dashboard

Once connected to WiFi:

- Open browser: `http://hemoglobin-detector.local`
- Or use device IP address: `http://192.168.x.x`

## File Structure

```
hemoglobin_detector/
├── src/
│   └── main.cpp              # Firmware with web server code
├── data/                      # SPIFFS web files
│   ├── index.html            # Main dashboard HTML
│   ├── style.css             # Responsive styling
│   └── app.js                # Real-time update logic
└── platformio.ini            # Project configuration
```

## Key Functions in main.cpp

### WiFi Management

- `initializeWiFi()`: Sets up WiFiManager with captive portal
- `initializeSPIFFS()`: Mounts flash filesystem
- `initializeWebServer()`: Starts AsyncWebServer

### REST API

- `setupRestAPI()`: Registers all API endpoints
- `setupWebDashboard()`: Serves HTML/CSS/JS files

## JavaScript Dashboard

### Files: `data/app.js`

**Key Functions:**

- `initializeCharts()`: Creates Chart.js instances for visualization
- `fetchMeasurements()`: Polls `/api/measurements` every 2 seconds
- `updateDashboard(data)`: Updates UI with new measurements
- `updateCharts(history)`: Renders trend data on charts

**Update Interval:** 2 seconds (configurable)
**History Size:** Last 60 measurements

## Phase 2 Enhancements (Future)

These improvements are planned for future releases:

### WebSocket Real-Time Streaming

Replace polling with push updates:

```cpp
server.on("/ws", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (ws.canHandle(request)) {
        ws.handleClient(request);
    }
});
```

### CSV Export & Data Logging

```cpp
server.on("/api/export", HTTP_GET, [](AsyncWebServerRequest *request) {
    // Generate CSV from measurement history
    String csv = "timestamp,heartRate,spO2,hemoglobin,status\n";
    // ... populate from buffer
    request->send(200, "text/csv", csv);
});
```

### EEPROM Configuration Persistence

```cpp
server.on("/api/settings", HTTP_POST, [](AsyncWebServerRequest *request) {
    // Parse JSON, save to EEPROM, apply settings
});
```

### Multi-Device Support

- Store multiple device profiles
- Support for family/clinic scenarios
- User authentication layer

### Cloud Integration

- MQTT publisher to Adafruit IO or AWS IoT
- Firebase Realtime Database sync
- Secure API key management

## Troubleshooting

### Device not accessible via http://hemoglobin-detector.local

1. Check WiFi connection on ESP32 (serial monitor)
2. Verify mDNS is working (try IP address directly)
3. Some networks block mDNS; use IP address instead

### Web server not starting

1. Check that WiFi is connected (online status LED)
2. Verify SPIFFS files were uploaded (`pio run -t uploadfs`)
3. Check serial monitor for error messages

### Charts not updating

1. Open browser DevTools (F12) → Console
2. Check for network errors in Network tab
3. Verify API endpoints are returning JSON
4. Check that `/api/measurements` is accessible

### WiFiManager not appearing

1. Reset WiFi settings: Press reset button while powered
2. Check that AP `Hemoglobin_Detector` is visible
3. Try connecting with password: `password`
4. If captive portal doesn't open, navigate to `192.168.4.1`

## Testing the API

### Using curl:

```bash
# Get latest measurement
curl http://hemoglobin-detector.local/api/measurements

# Get history
curl http://hemoglobin-detector.local/api/history

# Get device status
curl http://hemoglobin-detector.local/api/status

# Get settings
curl http://hemoglobin-detector.local/api/settings
```

### Using Postman:

1. Create a new Request
2. Set method to GET
3. URL: `http://hemoglobin-detector.local/api/measurements`
4. Send

## Performance Considerations

- **Update Interval**: 2 seconds (balance between responsiveness and load)
- **History Buffer**: 60 measurements (≈2 minutes of data at 2s interval)
- **Chart Render**: ~50ms per update on modern browsers
- **API Response**: <50ms latency on local network

To adjust intervals, modify in `data/app.js`:

```javascript
const UPDATE_INTERVAL = 2000; // Change to 1000 for 1-second updates
const HISTORY_SIZE = 60; // Change to 180 for 6 minutes
```

## Security Notes

This implementation is suitable for **local network use only**:

- No HTTPS (self-signed certs can be added in Phase 2)
- Default WiFi password (`password`) should be changed in production
- API has no authentication (add in Phase 2)
- Credentials stored in plaintext on ESP32 (encrypted storage in Phase 2)

For production/cloud deployment, implement:

- HTTPS with TLS certificates
- JWT or OAuth2 authentication
- Rate limiting
- Input validation
- Secure credential storage

## Next Steps

1. **Test on your network**: Verify WiFi connection and dashboard access
2. **Optimize UI**: Collect user feedback and improve layouts
3. **Implement WebSocket** (Phase 2): For real-time push updates
4. **Add data persistence** (Phase 2): CSV logging to SPIFFS
5. **Cloud integration** (Phase 3): MQTT or HTTP cloud sync

---

**Questions or Issues?**
Check the serial monitor output for diagnostics. Enable debug logging by uncommenting debug prints in `setupRestAPI()`.
