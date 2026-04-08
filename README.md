# Non-Invasive Hemoglobin and Anemia Detection System

## Quick Navigation

📚 **Complete Documentation:**

- **[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)** - Hardware and software components overview
- **[DATA_PROPAGATION.md](DATA_PROPAGATION.md)** - Complete real-time data flow through entire system
- **[DATA_FLOW_FIXES.md](DATA_FLOW_FIXES.md)** - Bug fixes and improvements log

🚀 **Quick Start:** Patient registration → Queue → Diagnosis → Results auto-saved and displayed

## Mobile Sharing

The dashboard, registration page, and queue page are responsive and can be opened on phones or tablets.

- Open the registration page on the ESP32 web server.
- Use the built-in Share or Copy link buttons.
- Send that link to anyone on the same Wi-Fi network.
- They can register patients directly from their own device.

If you want internet-wide access beyond the local network, publish the code publicly on GitHub and use a tunnel or hosting layer in front of the ESP32 web server.

---

## Real-Time Data Flow System

This system implements **complete real-time synchronization** between hardware and dashboard:

### What This Means:

✅ **Register a patient** → Appears on dashboard immediately  
✅ **Place finger on sensor** → Dashboard shows "Measuring" in real-time  
✅ **Remove finger halfway** → System detects and notifies all components  
✅ **Measurements complete** → Results saved AND displayed on dashboard instantly  
✅ **Serial monitor logs** → Every state change for debugging  
✅ **LCD display updates** → Shows current state locally  
✅ **Auto-advance queue** → Next patient called automatically

### How It Works (High-Level):

```
Patient Registration (Web Form)
        ↓
    Hardware Saves Patient Data
        ↓
    Patient Added to Queue
        ↓
    System Calls Patient (LCD + Dashboard Notified)
        ↓
    Patient Places Finger (Detected within 100ms)
        ↓
    Real-Time Measurement Streaming to Dashboard
        ↓
    Results Obtained (Saved to Patient Record)
        ↓
    Dashboard Shows Results + Next Patient Auto-Called
```

**See [DATA_PROPAGATION.md](DATA_PROPAGATION.md) for complete step-by-step data flow with examples.**

---

## Project Overview

This project implements a non-invasive hemoglobin and anemia detection system using optical sensing technology. The system measures blood oxygen levels (SpO2) and heart rate to estimate hemoglobin levels without requiring a blood sample.

## Team

- **By:** Dikra Grine

## Hardware Components

### Main Components:

1. **ESP32 Microcontroller**
   - Dual-core 32-bit processor
   - High processing power
   - WiFi & Bluetooth capable
   - Low power consumption
   - Ideal for biomedical & IoT projects

2. **MAX30102 Pulse Oximeter Sensor**
   - Integrated Red LED
   - Integrated Infrared LED
   - Built-in Photodiode
   - I2C Communication
   - Measures reflected light signals

## Wiring Connections

```
MAX30102 Sensor -> ESP32
-----------------------
VCC  -> 3.3V
GND  -> GND
SDA  -> GPIO 21
SCL  -> GPIO 22
```

## How It Works

### Principle of Operation

The system uses optical sensing to measure blood properties:

1. **Light Absorption:**
   - Blood absorbs light differently based on oxygen level
   - Oxygenated hemoglobin absorbs less red light
   - Deoxygenated hemoglobin absorbs more red light

2. **Sensor Operation:**
   - Red and Infrared LEDs emit light into the finger
   - Photodiode detects reflected light
   - System analyzes the absorption patterns

3. **SpO2 Calculation:**
   - Uses ratio of Red to IR signal
   - Formula: SpO2 = 110 - 25\*R
   - R = (RMS_RED/avg_red) / (RMS_IR/avg_ir)

4. **Heart Rate Detection:**
   - Peak detection in IR signal
   - Time between peaks = heart period
   - BPM = 60 / time_between_beats

5. **Hemoglobin Estimation:**
   - Correlates SpO2 levels with hemoglobin
   - SpO2 >= 95%: Normal hemoglobin (13-17 g/dL)
   - SpO2 90-95%: Mild anemia (11-13 g/dL)
   - SpO2 < 90%: Moderate to severe anemia

## Normal Values

### Hemoglobin Levels:

- **Men:** 13 - 17 g/dL
- **Women:** 12 - 15 g/dL

### Blood Oxygen (SpO2):

- **Normal:** 95% - 100%
- **Borderline:** 90% - 94%
- **Low:** < 90% (requires medical attention)

## Anemia Classification

| Hemoglobin Level | Status             |
| ---------------- | ------------------ |
| >= 13 g/dL       | Normal (No Anemia) |
| 11-13 g/dL       | Mild Anemia        |
| 9-11 g/dL        | Moderate Anemia    |
| < 9 g/dL         | Severe Anemia      |

## Features

✓ Non-invasive measurement (no needles, no blood)  
✓ Real-time SpO2 monitoring  
✓ Heart rate (BPM) calculation  
✓ Hemoglobin level estimation  
✓ Anemia status detection  
✓ Serial output for monitoring  
✓ Easy to use - just place finger on sensor

## System Architecture

```
┌─────────────────┐
│   MAX30102      │
│   Sensor        │
│  (Red + IR LED) │
└────────┬────────┘
         │ I2C
         │
    ┌────▼─────┐
    │  ESP32   │
    │  Brain   │
    └────┬─────┘
         │
         ▼
    Serial Output
    (115200 baud)
```

## Building the Project

### Prerequisites:

- PlatformIO installed
- USB cable for ESP32
- MAX30102 sensor module

### Build Steps:

1. Navigate to project directory:

```bash
cd /home/hz/workspace/learning/platformio/hemoglobin_detector
```

2. Install dependencies (automatic):

```bash
pio lib install
```

3. Build the project:

```bash
pio run
```

4. Upload to ESP32:

```bash
pio run --target upload
```

5. Monitor serial output:

```bash
pio device monitor
```

6. Upload dashboard files to SPIFFS:

```bash
pio run --target uploadfs
```

7. Optional local web test (without ESP32):

```bash
npm install
npm run dev
```

## Public GitHub Readiness

Before publishing the repository publicly:

1. Keep generated files out of version control with [`.gitignore`](.gitignore).
2. Commit the firmware, web dashboard, and documentation.
3. Create a GitHub repository and push the project.
4. Mark the repository public.
5. Share the ESP32 dashboard link with users on the same network.

For true public internet access, the ESP32 web server needs a public URL via a tunnel, reverse proxy, or separate hosted frontend.

## Usage Instructions

1. **Power On:**
   - Connect ESP32 via USB
   - Wait for initialization message

2. **Place Finger:**
   - Put your finger on the MAX30102 sensor
   - Press gently but firmly
   - Keep finger still during measurement

3. **Wait for Readings:**
   - System takes ~10 seconds to stabilize
   - Readings update every second

4. **Interpret Results:**
   - Check SpO2 level (should be > 95%)
   - Review heart rate (normal: 60-100 bpm)
   - Check estimated hemoglobin level
   - Read anemia status

## Sample Output

```
========================================
IR Value: 98532 | Red Value: 87654
Heart Rate (BPM): 72 bpm
SpO2: 97.3%
Estimated Hemoglobin: 14.6 g/dL
Status: NORMAL (No Anemia)
========================================
```

## Applications

- Home health monitoring
- Screening for anemia
- Pre-surgery assessment
- Blood donation screening
- Remote patient monitoring
- Educational demonstrations
- Research projects

## Advantages

### Traditional Method (Invasive):

❌ Requires blood sample with needle  
❌ Laboratory analysis needed  
❌ Painful procedure  
❌ Slow results  
❌ Requires medical staff

### Our System (Non-Invasive):

✅ No needles, no blood  
✅ Instant results  
✅ Painless measurement  
✅ Can be used at home  
✅ No medical staff needed  
✅ Continuous monitoring possible

## Technical Details

### Signal Processing:

- RMS (Root Mean Square) calculation
- Exponential filtering (α = 0.7)
- Peak detection algorithm
- Moving average for heart rate

### Sampling:

- 100 samples for SpO2 calculation
- 4-sample moving average for BPM
- 1-second display update rate

## Safety Notes

⚠️ **Important:**

- This is a demonstration/educational project
- NOT a medical device
- Should NOT replace professional medical diagnosis
- For screening and monitoring purposes only
- Consult healthcare provider for medical decisions

## Limitations

- Accuracy depends on proper finger placement
- Affected by finger motion
- Cold fingers may affect readings
- Nail polish can interfere with measurements
- Hemoglobin estimation is approximate

## Future Enhancements

- [ ] LCD display for standalone operation
- [ ] WiFi data logging
- [ ] Mobile app integration
- [ ] Battery power operation
- [ ] 3D printed enclosure
- [ ] Calibration against lab results
- [ ] Temperature compensation
- [ ] Machine learning for better accuracy

## References

- SpO2 measurement principles
- MAX30102 datasheet
- Maxim Integrated algorithms
- Pulse oximetry theory
- Hemoglobin spectroscopy

## License

Educational project for learning purposes.

---

**Built with ESP32 + MAX30102**  
**Making healthcare more accessible** ❤️
