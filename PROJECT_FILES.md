# 🩺 Hemoglobin & Anemia Detection System - Project Files

## 📁 Project Structure

```
hemoglobin_detector/
├── src/
│   └── main.cpp                    # Main application code
├── lib/                            # Project libraries
├── include/                        # Header files
├── platformio.ini                  # Project configuration
│
├── README.md                       # Project overview & features
├── WIRING_AND_UPLOAD_GUIDE.md     # Practical setup guide
├── HARDWARE_DATASHEET.md          # Hardware technical reference
│
├── ESP32_Datasheet.pdf            # ESP32 official datasheet
└── MAX30102_Datasheet.pdf         # MAX30102 sensor datasheet
```

## 📖 Documentation Guide

### Quick Start

1. Read [README.md](README.md) - Project overview
2. Follow [WIRING_AND_UPLOAD_GUIDE.md](WIRING_AND_UPLOAD_GUIDE.md) - Step-by-step setup
3. Reference [HARDWARE_DATASHEET.md](HARDWARE_DATASHEET.md) - Technical details

### Hardware References

- [ESP32_Datasheet.pdf](ESP32_Datasheet.pdf) - Official ESP32 chip documentation
- [MAX30102_Datasheet.pdf](MAX30102_Datasheet.pdf) - Official MAX30102 sensor documentation

## 🚀 Quick Commands

### Upload & Monitor:

```bash
cd /home/hz/workspace/learning/platformio/hemoglobin_detector
pio run --target upload && pio device monitor --baud 115200
```

### Just Monitor:

```bash
pio device monitor --baud 115200
```

### Check Connection:

```bash
pio device list
```

## ✅ Project Status: **WORKING** ✨

- ✅ ESP32 configured and running
- ✅ MAX30102 sensor detected
- ✅ Heart rate measurement functional
- ✅ SpO2 calculation working
- ✅ Hemoglobin estimation operational
- ✅ Anemia detection active

## 📊 Sample Output

```
========================================
IR Value: 105514 | Red Value: 14568
Heart Rate (BPM): 62 bpm
SpO2: 96.2%
Estimated Hemoglobin: 15.1 g/dL
Status: NORMAL (No Anemia)
========================================
```

## 🎯 Features Implemented

- [x] Non-invasive measurement
- [x] Real-time heart rate detection
- [x] Blood oxygen (SpO2) monitoring
- [x] Hemoglobin level estimation
- [x] Anemia classification (Normal, Mild, Moderate, Severe)
- [x] Serial output monitoring
- [x] Finger detection

## 🔧 Hardware Setup

**Connections:**

```
MAX30102  →  ESP32 (38-pin)
VCC       →  3V3
GND       →  GND
SCL       →  P22 (GPIO 22)
SDA       →  P21 (GPIO 21)
```

## 📝 Notes

- Keep finger still for accurate readings
- Wait 10-15 seconds for heart rate stabilization
- SpO2 > 95% is normal
- Hemoglobin 13-17 g/dL is normal range

---

**Project by:** Dikra Grine  
**Date:** February 19-20, 2026  
**Status:** ✅ Fully Operational
