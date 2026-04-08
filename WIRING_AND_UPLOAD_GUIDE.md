# 📋 Pin Configuration Summary (Read Before Wiring)

| ESP32 Pin Name | Pin Number/Label | Function/Connection      | Notes                        |
| :------------: | :--------------: | :----------------------- | :--------------------------- |
|      3V3       |       3V3        | Power Output to MAX30102 | 3.3V, max 500mA              |
|      GND       |       GND        | Ground (to MAX30102 GND) | Use any GND pin              |
|    GPIO 21     |       D21        | I2C Data (SDA)           | Connect to MAX30102 SDA      |
|    GPIO 22     |       D22        | I2C Clock (SCL)          | Connect to MAX30102 SCL      |
|       EN       |        EN        | Reset/Enable (not used)  | Board reset button           |
|      VIN       |       VIN        | 5V Power (rarely needed) | Only for 5V MAX30102 modules |

| MAX30102 Pin | Connects To (ESP32) | Function           | Notes                       |
| :----------: | :-----------------: | :----------------- | :-------------------------- |
|   VIN/VCC    |     3V3 or VIN      | Power Input        | Use 3V3 for most modules    |
|     GND      |         GND         | Ground             | Common ground               |
|     SCL      |    GPIO 22 (D22)    | I2C Clock          |                             |
|     SDA      |    GPIO 21 (D21)    | I2C Data           |                             |
|     INT      |   (not connected)   | Interrupt (unused) | Not needed for this project |

**Always double-check your ESP32 board’s silkscreen and the MAX30102 module markings before wiring!**

# 🔧 Practical Wiring & Upload Guide - ESP32 + MAX30102

## 📦 What You Need

### Hardware:

- ✅ ESP32 Development Board (DevKit or similar)
- ✅ MAX30102 Pulse Oximeter Sensor Module
- ✅ 4 Female-to-Female Jumper Wires
- ✅ USB Cable (Type-C or Micro-USB, depending on your ESP32)
- ✅ Computer with PlatformIO installed

---

## 🔌 STEP 1: Understanding Your Hardware

### ESP32 DevKit - Key Features (38-pin):

```md
╔════════════════════════════════════╗
║ ESP32 DevKit (38-pin) ║
║ (ESP-32S) ║
║ ║
║ ║
║ ║
║ Left Side Right Side ║
║ ┌─ 3V3 GND ─┐ ║
║ ├─ EN D23 ─┤ ║
║ ├─ VP (GPIO36) D22 ─┤ ← SCL ║
║ ├─ VN (GPIO39) TX0 ─┤ (GPIO1)║
║ ├─ D34 (GPIO34) RX0 ─┤ (GPIO3)║
║ ├─ D35 (GPIO35) D21 ─┤ ← SDA ║
║ ├─ D32 (GPIO32) D19 ─┤ ║
║ ├─ D33 (GPIO33) D18 ─┤ ║
║ ├─ D25 (GPIO25) D5 ─┤ ║
║ ├─ D26 (GPIO26) D17 ─┤ ║
║ ├─ D27 (GPIO27) D16 ─┤ ║
║ ├─ D14 (GPIO14) D4 ─┤ ║
║ ├─ D12 (GPIO12) D2 ─┤ ║
║ ├─ GND D15 ─┤ ║
║ ├─ D13 (GPIO13) GND ─┤ ║
║ ├─ D9* (GPIO9) VIN ─┤ (5V) ║
║ ├─ D10* (GPIO10) ║
║ ├─ D11\* (GPIO11) ║
║ └─ 3V3 ║
║ ║
║ [ USB Port ] ║  
╚════════════════════════════════════╝
```

**Important ESP32 Pins:**

- **3V3** → 3.3V Power Output (500mA max)
- **GND** → Ground (multiple pins available)
- **GPIO 21** → I2C SDA (Data line)
- **GPIO 22** → I2C SCL (Clock line)
- **EN** → Reset button

### MAX30102 Sensor Module:

```
╔═════════════════════════╗
║   MAX30102 Module       ║
║                         ║
║   ┌─────────┐           ║
║   │  [LED]  │ ← Sensor  ║
║   └─────────┘   Window  ║
║                         ║
║   VIN  ─┐               ║
║   GND  ─┤  Connection   ║
║   SCL  ─┤  Pins         ║
║   SDA  ─┤               ║
║   INT  ─┘ (Optional)    ║
╚═════════════════════════╝
```

**MAX30102 Pin Description:**

- **VIN/VCC** → Power input (3.3V or 5V depending on module)
- **GND** → Ground
- **SCL** → I2C Clock line
- **SDA** → I2C Data line
- **INT** → Interrupt pin (not used in our project)

**I2C Address:** 0x57 (factory default)

---

## 🔗 STEP 2: Wiring - The Super Simple Way

### Connection Table:

```
MAX30102        Wire Color      ESP32
─────────────────────────────────────────
VCC/VIN    ──→  [RED]      ──→  3V3
GND        ──→  [BLACK]    ──→  GND
SCL        ──→  [YELLOW]   ──→  GPIO 22
SDA        ──→  [GREEN]    ──→  GPIO 21
```

### Visual Wiring Diagram:

```
     ESP32                              MAX30102
   ┌────────┐                          ┌─────────┐
   │        │                          │         │
   │  3V3   ├─────[RED WIRE]──────────┤  VCC    │
   │        │                          │         │
   │  GND   ├─────[BLACK WIRE]────────┤  GND    │
   │        │                          │         │
   │  G22   ├─────[YELLOW WIRE]───────┤  SCL    │
   │ (SCL)  │                          │         │
   │        │                          │         │
   │  G21   ├─────[GREEN WIRE]────────┤  SDA    │
   │ (SDA)  │                          │         │
   │        │                          │         │
   │  USB   │◄──── TO COMPUTER         └─────────┘
   └────────┘
```

### 🛠️ Hands-On Wiring Steps:

1. **Unplug Everything First!** ⚠️
   - Make sure ESP32 is NOT connected to USB
   - Safety first!

2. **Connect Power (RED wire):**
   - MAX30102 VCC → ESP32 3V3 pin
   - This powers the sensor

3. **Connect Ground (BLACK wire):**
   - MAX30102 GND → ESP32 GND pin
   - Common ground is essential

4. **Connect Clock (YELLOW wire):**
   - MAX30102 SCL → ESP32 GPIO 22
   - This is the I2C clock signal

5. **Connect Data (GREEN wire):**
   - MAX30102 SDA → ESP32 GPIO 21
   - This is the I2C data line

6. **Double Check:**
   - ✅ VCC to 3V3 (or 5V/VIN if your module needs 5V)
   - ✅ GND to GND
   - ✅ SCL to GPIO 22
   - ✅ SDA to GPIO 21
   - ✅ No loose connections

---

## ⚠️ Important Notes on MAX30102 Modules

### Two Types of Modules:

**Type 1: 3.3V Module (Most Common)**

```
MAX30102 Module with onboard regulator
VIN: 3.3V - 5V accepted
```

→ Connect to ESP32 **3V3** pin

**Type 2: 5V Module (Less Common)**

```
MAX30102 Module requiring 5V
VIN: 5V only
```

→ Connect to ESP32 **VIN/5V** pin (USB power)

**How to Tell?**

- Check module markings or datasheet
- Most breakout boards have onboard regulators (use 3V3)
- When in doubt, start with 3V3 - it's safer!

---

## 💻 STEP 3: Upload the Code

### Method 1: Using Terminal (You're here!)

**Current Directory:** `/home/hz/workspace/learning/platformio/hemoglobin_detector`

#### Step-by-Step Upload:

**1. Connect ESP32 to Computer:**

```bash
# Plug in USB cable to ESP32 and computer
# Wait for device to be recognized
```

**2. Check if ESP32 is Detected:**

```bash
ls /dev/ttyUSB* /dev/ttyACM*
# You should see something like /dev/ttyUSB0 or /dev/ttyACM0
```

**3. Build the Project (Already done!):**

```bash
pio run
# ✅ Already built successfully!
```

**4. Upload to ESP32:**

```bash
pio run --target upload
```

**5. Monitor Serial Output:**

```bash
pio device monitor
# Or press Ctrl+C to exit when done
```

**One-Line Upload & Monitor:**

```bash
pio run --target upload && pio device monitor
```

### Common Upload Issues & Solutions:

#### Issue 1: Permission Denied

```bash
# Error: Could not open /dev/ttyUSB0
# Solution: Add user to dialout group
sudo usermod -a -G dialout $USER
# Then logout and login again
```

#### Issue 2: Port Not Found

```bash
# Check connected devices
ls -l /dev/ttyUSB* /dev/ttyACM*

# If nothing shows, try:
dmesg | grep -i tty
# Look for recently connected devices
```

#### Issue 3: Upload Failed

```
# Hold BOOT button on ESP32 while uploading
# Some ESP32 boards require this
```

#### Issue 4: Wrong Permissions

```bash
# Quick fix (temporary):
sudo chmod 666 /dev/ttyUSB0  # Replace with your port

# Permanent fix:
sudo usermod -a -G dialout $USER
```

---

## 📊 STEP 4: Testing Your Setup

### What You Should See:

**1. After Upload:**

```
Writing at 0x00010000... (100%)
Wrote XXXXX bytes
Hash of data verified.

Leaving...
Hard resetting via RTS pin...
```

**2. Serial Monitor Output:**

```
=== Hemoglobin & Anemia Detection System ===
Initializing MAX30102...
MAX30102 initialized successfully!

Place your finger on the sensor...
Hold steady for accurate readings!

========================================
IR Value: 0 | Red Value: 0
No finger detected. Please place your finger on the sensor.
========================================
```

**3. With Finger Placed:**

```
========================================
IR Value: 98532 | Red Value: 87654
Heart Rate (BPM): 72 bpm
SpO2: 97.3%
Estimated Hemoglobin: 14.6 g/dL
Status: NORMAL (No Anemia)
========================================
```

---

## 🧪 Quick Test Checklist

### Before Powering On:

- [ ] All 4 wires connected correctly
- [ ] No short circuits (wires not touching)
- [ ] MAX30102 sensor is clean
- [ ] USB cable is good quality

### After Powering On:

- [ ] ESP32 LED lights up
- [ ] No burning smell (!)
- [ ] Serial monitor opens successfully
- [ ] "Initializing MAX30102..." appears

### With Finger on Sensor:

- [ ] IR value > 50000
- [ ] Heart rate detected (60-100 bpm typical)
- [ ] SpO2 reading 90-100%
- [ ] Values update every second

---

## 🔧 Troubleshooting Guide

### Problem: "MAX30102 was not found"

**Possible Causes:**

1. **Loose connections** → Check all 4 wires
2. **Wrong I2C pins** → Verify GPIO 21 (SDA) and 22 (SCL)
3. **No power** → Check 3V3 connection
4. **Bad sensor** → Try another MAX30102 module

**Debug Steps:**

```cpp
// Add this to setup() to scan I2C devices:
Wire.begin(21, 22);
for(byte i = 1; i < 127; i++) {
  Wire.beginTransmission(i);
  if(Wire.endTransmission() == 0) {
    Serial.printf("Found I2C device at 0x%02X\n", i);
  }
}
// Should find device at 0x57
```

### Problem: "No finger detected"

**Solutions:**

1. Press finger firmly on sensor
2. Keep finger still
3. Clean sensor window
4. Try different finger
5. Check if sensor LED is glowing red

### Problem: Erratic Readings

**Solutions:**

1. Hold finger very still
2. Don't press too hard (blocks blood flow)
3. Warm up cold fingers
4. Remove nail polish
5. Wait 10-15 seconds for stabilization

---

## 🎯 Quick Reference Commands

### From Project Directory:

```bash
cd /home/hz/workspace/learning/platformio/hemoglobin_detector

# Build only
pio run

# Upload only
pio run --target upload

# Clean build
pio run --target clean

# Monitor serial
pio device monitor

# Upload and monitor
pio run -t upload && pio device monitor

# Check connected devices
pio device list
```

### Serial Monitor Controls:

- **Exit:** Ctrl + C
- **Clear:** Ctrl + L (in some terminals)
- **Baud rate:** 115200 (already configured)

---

## 📚 Understanding I2C Communication

### What is I2C?

```
Master (ESP32)         Slave (MAX30102)
      │                      │
      ├──── SDA (Data) ──────┤
      │                      │
      ├──── SCL (Clock) ─────┤
      │                      │
```

**Key Points:**

- **2-wire protocol** (SDA + SCL)
- **Multiple devices** can share same bus
- **7-bit addressing** (MAX30102 = 0x57)
- **Pull-up resistors** (usually onboard module)
- **3.3V logic level** on ESP32

### MAX30102 I2C Speed:

- Standard Mode: 100 kHz ✅
- Fast Mode: 400 kHz ✅ (we use this)
- Fast Mode Plus: 1 MHz

---

## 🎓 Learning Tips

### Understanding the Readings:

**IR Value (Infrared):**

- No finger: < 50,000
- Finger detected: > 50,000
- Good signal: 80,000 - 120,000

**Red Value:**

- Similar range to IR
- Used for SpO2 calculation
- Ratio of Red/IR matters

**Heart Rate (BPM):**

- Normal: 60-100 bpm
- During exercise: higher
- Variations normal

**SpO2 (Blood Oxygen):**

- Normal: 95-100%
- Healthy minimum: 90%
- Below 90%: concerning

---

## 🚀 Next Steps After First Success

1. **Experiment:**
   - Try before and after exercise
   - Compare different fingers
   - Test on family members

2. **Improve:**
   - Add LCD display
   - Save data to SD card
   - Send data via WiFi

3. **Calibrate:**
   - Compare with medical pulse oximeter
   - Adjust estimation formulas
   - Fine-tune thresholds

4. **Learn More:**
   - Study PPG (Photoplethysmography)
   - Understand signal processing
   - Explore SpO2 algorithms

---

## 📖 Quick Reference Tables

### ESP32 I2C Pins:

| Function | Default Pin | Alternative |
| -------- | ----------- | ----------- |
| SDA      | GPIO 21     | Any GPIO    |
| SCL      | GPIO 22     | Any GPIO    |

### MAX30102 Registers (Advanced):

| Register    | Address | Function       |
| ----------- | ------- | -------------- |
| MODE_CONFIG | 0x09    | Operation mode |
| SPO2_CONFIG | 0x0A    | SpO2 settings  |
| LED1_PA     | 0x0C    | Red LED power  |
| LED2_PA     | 0x0D    | IR LED power   |

### PlatformIO Commands:

| Command              | Purpose          |
| -------------------- | ---------------- |
| `pio run`            | Build project    |
| `pio run -t upload`  | Upload firmware  |
| `pio device monitor` | Serial monitor   |
| `pio device list`    | List devices     |
| `pio lib search`     | Search libraries |

---

## ✅ Final Checklist

Before asking for help, verify:

- [ ] Wiring is correct (VCC, GND, SDA, SCL)
- [ ] ESP32 is powered and detected by computer
- [ ] Code compiled without errors
- [ ] Upload completed successfully
- [ ] Serial monitor shows initialization message
- [ ] Tried different fingers
- [ ] Sensor surface is clean
- [ ] Finger pressed firmly but not too hard

---

## 🆘 Still Having Issues?

1. **Post photos** of your wiring
2. **Copy/paste** error messages
3. **Share** serial monitor output
4. **Mention** your ESP32 board model
5. **Check** if sensor LED glows

Remember: Most issues are simple wiring problems! Double-check your connections! 🔍

---

Good luck with your first ESP32 + MAX30102 project! 🎉
