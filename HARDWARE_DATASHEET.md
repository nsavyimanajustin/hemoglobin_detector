# 📘 Hardware Datasheets & Technical Reference

## ESP32 Microcontroller - Complete Overview

### 🔧 Technical Specifications

#### CPU & Memory:
- **Processor:** Xtensa® dual-core 32-bit LX6 microprocessor
- **Clock Frequency:** Up to 240 MHz
- **SRAM:** 520 KB
- **Flash:** 4 MB (typical, varies by module)
- **ROM:** 448 KB
- **RTC Memory:** 16 KB SRAM

#### Connectivity:
- **WiFi:** 802.11 b/g/n (2.4 GHz)
- **Bluetooth:** v4.2 BR/EDR and BLE
- **Range:** Up to 100m (line of sight)

#### Peripherals:
- **GPIO Pins:** 34 programmable GPIOs
- **ADC:** 18 channels, 12-bit SAR ADC
- **DAC:** 2 channels, 8-bit DAC
- **Touch Sensors:** 10 capacitive touch GPIOs
- **SPI:** 4 controllers
- **I2C:** 2 controllers ← **We use this!**
- **I2S:** 2 controllers
- **UART:** 3 controllers
- **PWM:** 16 channels
- **LED PWM:** 16 channels

#### Power:
- **Operating Voltage:** 2.2V - 3.6V
- **Operating Current:**
  - Active mode: 80-240 mA (WiFi on)
  - Modem sleep: ~20-70 mA
  - Deep sleep: 10 μA - 150 μA
- **Input Voltage (USB):** 5V
- **3V3 Pin Output:** Up to 500 mA

---

### 📌 ESP32 DevKit Pinout Reference (38-pin)

```
          ESP32 DevKit (38 pins)
    
  Left Side                          Right Side
  ─────────                          ──────────
    
  EN         ← Reset                 3V3       ← 3.3V output
  VP (36)    ← Input only            GND       ← Ground
  VN (39)    ← Input only            D15       ↔ GPIO (boot)
  D34        ← Input only            D2        ↔ GPIO (LED)
  D35        ← Input only            D4        ↔ GPIO
  D32        ↔ GPIO                  D16       ↔ UART2 RX
  D33        ↔ GPIO                  D17       ↔ UART2 TX
  D25        ↔ GPIO, DAC1            D5        ↔ GPIO (boot)
  D26        ↔ GPIO, DAC2            D18       ↔ SPI CLK
  D27        ↔ GPIO                  D19       ↔ SPI MISO
  D14        ↔ GPIO                  D21       → I2C SDA ★
  D12        ↔ GPIO (boot)           RX0 (3)   → UART RX
  GND        ← Ground                TX0 (1)   → UART TX
  D13        ↔ GPIO                  D22       → I2C SCL ★
  D9         ⚠ Flash                 D23       ↔ GPIO
  D10        ⚠ Flash                 GND       ← Ground
  D11        ⚠ Flash                 VIN (5V)  ← USB 5V input
  3V3        ← 3.3V output           3V3       ← 3.3V output
```

**Legend:**
- ★ = Used in our project
- ↔ = Input/Output
- ← = Input only
- → = Output capable
- ⚠ = Connected to flash, avoid using

---

### 🎯 I2C on ESP32 - Deep Dive

#### Default I2C Pins:
```
I2C Bus 0 (default):
  - SDA: GPIO 21
  - SCL: GPIO 22
  
I2C Bus 1 (alternative):
  - Can use any GPIO pins
  - Configured in software
```

#### I2C Configuration in Arduino:
```cpp
// Default initialization
Wire.begin();  // Uses GPIO 21 (SDA) and GPIO 22 (SCL)

// Custom pins
Wire.begin(SDA_PIN, SCL_PIN);  // e.g., Wire.begin(21, 22)

// Set I2C speed
Wire.setClock(400000);  // 400 kHz (Fast Mode)
Wire.setClock(100000);  // 100 kHz (Standard Mode)
```

#### I2C Characteristics:
- **Pull-up Resistors:** Required (usually 4.7kΩ - 10kΩ)
- **Voltage Level:** 3.3V logic
- **Speed Modes:**
  - Standard: 100 kHz
  - Fast: 400 kHz ← **We use this**
  - Fast Plus: 1 MHz (supported)
- **Multi-master:** Supported
- **7-bit Addressing:** Standard
- **10-bit Addressing:** Supported

---

### ⚡ GPIO Specifications

#### Safe GPIO Pins (No boot issues):
```
✅ Safe to use anytime:
GPIO: 0, 2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33

⚠️ Input only (no pull-up/down):
GPIO: 34, 35, 36, 39

❌ Avoid (used by flash):
GPIO: 6, 7, 8, 9, 10, 11

⚠️ Special (boot mode pins):
GPIO 0:  Boot button, pull HIGH at boot
GPIO 2:  Must be LOW at boot (has pull-down)
GPIO 5:  Must be HIGH at boot
GPIO 12: Controls flash voltage, LOW for 3.3V
GPIO 15: Must be HIGH at boot
```

#### GPIO Characteristics:
- **Maximum Current:** 40 mA per pin
- **Input Voltage:** 3.3V (NOT 5V tolerant!)
- **Output Voltage:** 3.3V
- **Internal Pull-up/down:** 45 kΩ typical

---

### 📊 ADC (Analog to Digital Converter)

Our project doesn't use ADC, but good to know:

```
ADC1 Channels (WiFi compatible):
- GPIO 32-39, 36, 37, 38, 39

ADC2 Channels (conflicts with WiFi):
- GPIO 0, 2, 4, 12-15, 25-27

Resolution: 12-bit (0-4095)
Voltage Range: 0-3.3V (with attenuation settings)
```

---

## MAX30102 Sensor - Complete Overview

### 🔬 Technical Specifications

#### Sensor Type:
- **Technology:** Pulse Oximetry and Heart-Rate Monitor
- **Method:** Photoplethysmography (PPG)
- **Measurement:** Optical (non-invasive)

#### Optical System:
```
┌─────────────────────────────┐
│   MAX30102 Internal Block   │
│                             │
│  ┌──────┐      ┌─────────┐ │
│  │ Red  │      │         │ │
│  │ LED  ├──┐   │  Photo- │ │
│  └──────┘  │   │  diode  │ │
│            ↓   │         │ │
│  ┌──────┐ Skin │  ADC    │ │
│  │  IR  │      │         │ │
│  │ LED  ├──┘   └─────────┘ │
│  └──────┘                  │
│                             │
│     I2C Interface           │
└─────────────────────────────┘
```

#### LED Specifications:
- **Red LED:** 660 nm wavelength
- **Infrared LED:** 880 nm wavelength
- **Programmable Intensity:** 0-255 (8-bit)
- **Max LED Current:** 50 mA per LED
- **Pulse Width:** 69-411 μs (programmable)

#### Photodetector:
- **Type:** High-sensitivity photodiode
- **ADC Resolution:** 18-bit
- **Dynamic Range:** Up to 92 dB
- **Ambient Light Rejection:** Yes

---

### 📡 Electrical Characteristics

#### Power Supply:
- **VDD (Supply Voltage):** 1.8V (internal, from 3.3V regulator)
- **IR/R LED Supply:** 3.3V or 5.0V
- **Input Voltage (Module):** 3.3V - 5V (depends on module)
- **Supply Current:**
  - Active mode: ~1.2 mA
  - With LEDs: Up to 50 mA per LED
  - Shutdown mode: 0.7 μA

#### I2C Interface:
- **I2C Address:** 0x57 (factory default, 7-bit)
- **I2C Speed:** 
  - Standard Mode: 100 kHz
  - Fast Mode: 400 kHz ← **We use this**
  - Fast Mode Plus: 1 MHz
- **Logic Levels:** 3.3V compatible
- **SCL/SDA Pins:** Open-drain with pull-up resistors

---

### 📝 Register Map (Key Registers)

#### Status Registers:
```
Register Name        Address    Function
───────────────────────────────────────────────
Interrupt Status 1   0x00       FIFO, data ready
Interrupt Status 2   0x01       Temp ready
Interrupt Enable 1   0x02       Enable interrupts
Interrupt Enable 2   0x03       Enable temp interrupt
```

#### FIFO Registers:
```
FIFO Write Pointer   0x04       Write position
FIFO Overflow        0x05       Overflow counter
FIFO Read Pointer    0x06       Read position
FIFO Data Register   0x07       Read/Write FIFO data
```

#### Configuration Registers:
```
FIFO Configuration   0x08       Sample averaging, rollover
Mode Configuration   0x09       Mode selection, reset
SpO2 Configuration   0x0A       ADC range, sample rate
LED1 (Red) PA        0x0C       Red LED pulse amplitude
LED2 (IR) PA         0x0D       IR LED pulse amplitude
```

#### Data Registers:
```
Temperature Integer  0x1F       Temp data (integer)
Temperature Fraction 0x20       Temp data (fraction)
```

---

### ⚙️ Operating Modes

#### Mode 1: Heart Rate Mode
```cpp
// Only IR LED active
particleSensor.setup(
  60,     // LED brightness (0-255)
  4,      // Sample average (1, 2, 4, 8, 16, 32)
  3,      // LED mode (1=Red only, 2=IR only, 3=Both)
  100,    // Sample rate (50, 100, 200, 400, 800, 1000, 1600, 3200)
  411,    // Pulse width (69, 118, 215, 411 μs)
  4096    // ADC range (2048, 4096, 8192, 16384)
);
```

#### Mode 2: SpO2 Mode (Our Mode!)
```cpp
// Both Red and IR LEDs active
// Used for oxygen saturation measurement
// Alternates between Red and IR pulses
```

#### Mode 3: Multi-LED Mode
```cpp
// Up to 4 time slots
// Configurable LED combinations
// For advanced applications
```

---

### 📏 Measurement Specifications

#### Sample Rate:
- **Range:** 50 - 3200 samples per second
- **Typical:** 100 sps (our project uses this)
- **Resolution:** Configurable

#### Measurement Range:
- **SpO2:** 70% - 100%
- **Heart Rate:** 30 - 240 bpm
- **Resolution:**
  - SpO2: ±1%
  - Heart Rate: ±1 bpm

#### Accuracy:
- **SpO2:** ±2% typical (70-100% range)
- **Heart Rate:** ±5 bpm typical
- **Note:** Depends on calibration and conditions

---

### 🌡️ Temperature Sensor (Bonus Feature!)

The MAX30102 includes an internal temperature sensor:

```cpp
// Read temperature
float temperature = particleSensor.readTemperature();
// Returns degrees Celsius

// Accuracy: ±1°C
// Range: -40°C to +85°C
// Resolution: 0.0625°C
```

**Uses:**
- Compensate LED efficiency vs temperature
- Monitor device temperature
- Environmental sensing

---

### 🔬 How MAX30102 Measures Blood

#### Photoplethysmography (PPG) Principle:

```
1. LED emits light → Skin
2. Light penetrates skin (1-2mm depth)
3. Blood absorbs some light
4. Reflected light → Photodiode
5. ADC converts to digital signal
6. MCU processes the signal

Blood Volume Changes:
  Systole (heart contracts) → More blood → Less light
  Diastole (heart relaxes) → Less blood → More light
  
  Result: Pulsating signal ← Heartbeat!
```

#### Why Two Wavelengths?

**Red Light (660 nm):**
- Absorbed more by deoxygenated hemoglobin (HHb)
- Passes through oxygenated hemoglobin (O2Hb)

**Infrared Light (880 nm):**
- Absorbed more by oxygenated hemoglobin (O2Hb)
- Passes through deoxygenated hemoglobin (HHb)

**SpO2 Calculation:**
```
R = (AC_Red / DC_Red) / (AC_IR / DC_IR)

Where:
  AC = Pulsating signal (heartbeat)
  DC = Non-pulsating signal (baseline)
  
SpO2 = 110 - 25*R  (empirical formula)
```

---

### 🎨 Signal Processing Pipeline

```
Raw LED Signal
    ↓
[DC Removal] ← Remove baseline
    ↓
[Band-Pass Filter] ← 0.5-4 Hz (heart rate range)
    ↓
[Peak Detection] ← Find heartbeats
    ↓
[RMS Calculation] ← For SpO2
    ↓
[Ratio Calculation] ← R value
    ↓
[SpO2 Formula] ← Final result
```

---

### 📊 FIFO Buffer System

The MAX30102 has a 32-sample FIFO buffer:

```
FIFO Characteristics:
- Depth: 32 samples
- Width: 18 bits per sample
- Channels: 2 (Red + IR in SpO2 mode)
- Interrupt: Triggers when almost full

Benefits:
- Reduces MCU interrupt frequency
- Batch processing
- Lower power consumption
```

**In our code:**
```cpp
// Library handles FIFO automatically
long irValue = particleSensor.getIR();
long redValue = particleSensor.getRed();
```

---

### ⚠️ Important Design Considerations

#### Finger Placement:
```
✅ Good placement:
- Finger rests gently on sensor
- Covers entire LED and photodiode area
- Firm but not too tight
- Finger is warm

❌ Poor placement:
- Finger too loose (air gaps)
- Too much pressure (blocks blood flow)
- Partial coverage
- Cold finger (poor circulation)
```

#### Environmental Factors:
- **Ambient Light:** Sensor has rejection, but very bright light can interfere
- **Motion:** Movement causes artifacts in signal
- **Temperature:** Cold fingers reduce signal quality
- **Skin Tone:** Darker skin may need higher LED power
- **Nail Polish:** Blocks light, especially dark colors

---

### 🔧 Hardware Module Variants

#### Common MAX30102 Modules:

**Type 1: GY-MAX30102 (Most Common)**
```
- Voltage: 3.3V - 5V
- Onboard 3.3V regulator: Yes
- Pull-up resistors: 4.7kΩ (onboard)
- Size: ~15mm x 15mm
- Cost: ~$5-10
```

**Type 2: Adafruit MAX30102**
```
- Voltage: 3.3V - 5V
- Level shifting: Built-in
- Pull-up resistors: Onboard
- Additional: STEMMA QT connector
- Cost: ~$15
```

**Type 3: Sparkfun MAX30105 (Similar chip)**
```
- Voltage: 3.3V - 5V
- LEDs: 3 (Red, IR, Green)
- More features than MAX30102
- Cost: ~$15-20
```

---

### 📐 Physical Dimensions

#### MAX30102 IC:
- **Package:** 14-pin OLGA (Optical LGA)
- **Size:** 5.6mm × 3.3mm × 1.55mm
- **Sensor Window:** 2.1mm × 2.3mm

#### Typical Module:
- **PCB Size:** ~15mm × 15mm
- **Height:** ~5mm (with components)
- **Mounting Holes:** Usually 2-4
- **Connector:** 2.54mm pitch header pins

---

### 🔋 Power Consumption Analysis

#### Typical Current Draw:
```
Condition                           Current
────────────────────────────────────────────
Shutdown mode                       0.7 μA
Inactive (no LEDs)                  1.2 mA
Red LED @ 50 mA                     51.2 mA
IR LED @ 50 mA                      51.2 mA
Both LEDs @ 50 mA                   102.4 mA
```

#### Power Saving Tips:
- Lower LED brightness when possible
- Use lower sample rate if acceptable
- Shutdown mode when not measuring
- Interrupt-driven instead of polling

**Our Project:**
- Active measurement: ~20-30 mA typical
- ESP32 + MAX30102: ~130-150 mA total

---

### 🧪 Calibration & Accuracy

#### Factory Calibration:
- MAX30102 comes pre-calibrated
- SpO2 accuracy: ±2% (70-100%)
- Heart rate accuracy: ±5 bpm

#### Improving Accuracy:
1. **Reference Device:** Compare with medical-grade oximeter
2. **Collect Data:** Multiple subjects, various conditions
3. **Adjust Formula:** Tweak SpO2 calculation constants
4. **Temperature Compensation:** Use internal temp sensor
5. **Signal Quality Check:** Reject noisy measurements

#### Limitations:
- Not a medical device
- Affected by motion
- Individual variation (skin, blood flow)
- Environmental conditions
- Can't diagnose medical conditions

---

### 🛠️ Advanced Features (Not used in basic project)

#### Interrupt Pin:
- **Function:** Alerts MCU when data ready
- **Benefit:** Lower power, faster response
- **Connection:** GPIO input with interrupt

#### Proximity Mode:
- **Function:** Detect object near sensor
- **Use:** Auto-wake when finger placed
- **Benefit:** Battery saving

#### Temperature Die Temperature:
- **Function:** Internal temperature monitoring
- **Use:** LED efficiency compensation
- **Accuracy:** ±1°C

---

## 🔄 I2C Communication Example

### Low-Level I2C Transaction:

```cpp
// Reading MAX30102 Part ID (Register 0xFF)
// Should return 0x15

Wire.beginTransmission(0x57);  // MAX30102 address
Wire.write(0xFF);              // Part ID register
Wire.endTransmission(false);   // Repeated start
Wire.requestFrom(0x57, 1);     // Request 1 byte
byte partID = Wire.read();     // Read response

if(partID == 0x15) {
  Serial.println("MAX30102 detected!");
}
```

### FIFO Data Reading:

```cpp
// Read FIFO data (6 bytes for Red + IR)
Wire.beginTransmission(0x57);
Wire.write(0x07);  // FIFO Data register
Wire.endTransmission(false);
Wire.requestFrom(0x57, 6);  // 6 bytes (3 per channel)

// Read Red LED data (18-bit)
long red = 0;
red  = Wire.read() << 16;
red |= Wire.read() << 8;
red |= Wire.read();
red &= 0x3FFFF;  // Mask to 18 bits

// Read IR LED data (18-bit)
long ir = 0;
ir  = Wire.read() << 16;
ir |= Wire.read() << 8;
ir |= Wire.read();
ir &= 0x3FFFF;
```

---

## 📖 Useful Formulas & Calculations

### Heart Rate from Time Between Beats:
```
BPM = 60 / (time_between_beats_in_seconds)

Example:
  Time between beats = 0.833 seconds
  BPM = 60 / 0.833 = 72 bpm
```

### SpO2 Calculation (Simplified):
```
R = (RMS_red / DC_red) / (RMS_ir / DC_ir)
SpO2 = 110 - 25 * R

where:
  RMS = Root Mean Square of AC component
  DC = Average (baseline) value
```

### Signal Quality Metric:
```
SNR = 20 * log10(AC_amplitude / Noise_level)

Good signal: SNR > 20 dB
Acceptable: SNR > 15 dB
Poor: SNR < 10 dB
```

---

## 🎓 Learning Resources

### Official Documentation:
- ESP32 Technical Reference Manual
- ESP32 Datasheet
- MAX30102 Datasheet (Maxim Integrated)
- Arduino-ESP32 Documentation

### Recommended Reading:
- Photoplethysmography principles
- Digital signal processing basics
- I2C protocol specification
- Pulse oximetry theory

### Application Notes:
- Maxim AN6409: "Pulse Oximeter Design Using Microcontroller"
- Maxim AN6802: "Designing the Optical Portion of a Pulse Oximeter"

---

## ✅ Quick Reference Summary

### ESP32 Key Points:
- ✅ 3.3V logic level
- ✅ Default I2C: GPIO 21 (SDA), GPIO 22 (SCL)
- ✅ WiFi + Bluetooth capable
- ✅ Dual-core, 240 MHz
- ⚠️ NOT 5V tolerant!

### MAX30102 Key Points:
- ✅ I2C address: 0x57
- ✅ Red (660nm) + IR (880nm) LEDs
- ✅ 18-bit ADC resolution
- ✅ 50-3200 sps sample rate
- ✅ SpO2 range: 70-100%
- ⚠️ Requires stable finger placement

### Connection Summary:
```
MAX30102  →  ESP32
VCC       →  3V3
GND       →  GND
SDA       →  GPIO 21
SCL       →  GPIO 22
```

---

That's everything you need to know about the hardware! 🎉
```

