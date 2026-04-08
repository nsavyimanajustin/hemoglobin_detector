# Real-Time Data Flow & State Propagation

## How Data Flows Through The Entire System

This document explains how patient data, sensor readings, measurements, and state changes propagate across the hardware and dashboard in real-time.

---

## 1. Patient Registration Flow

```
┌────────────────────────────────────────────────────────────────┐
│ Step 1: USER REGISTERS PATIENT (register.html)               │
│ ─────────────────────────────────────────────────────────────  │
│ Patient fills form: Name, Phone, Age, Gender                 │
│ Clicks: "Register + Queue Patient"                           │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ Step 2: HARDWARE PROCESSES REGISTRATION (web_server_module)  │
│ ─────────────────────────────────────────────────────────────  │
│ Endpoint: POST /api/patients                                 │
│ Action: PatientManager::addPatient()                         │
│ • Creates unique numeric ID (1, 2, 3...)                     │
│ • Stores patient in patients[] array                         │
│ • Increments patientCount++                                  │
│ • BROADCASTS to Serial Monitor:                              │
│   === PATIENT REGISTERED ===                                 │
│   Patient ID: 1                                              │
│   Name: John Doe                                             │
│   Phone: +123456789                                          │
│   ...                                                         │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ Step 3: QUEUE PATIENT (POST /api/queue)                       │
│ ─────────────────────────────────────────────────────────────  │
│ Action: PatientManager::addToQueue()                          │
│ • Adds patient to queue array                                │
│ • Assigns queue position                                     │
│ • BROADCASTS to Serial Monitor:                              │
│   === PATIENT QUEUED ===                                     │
│   Patient Name: John Doe                                     │
│   Patient ID: 1                                              │
│   Queue Position: 1                                          │
│ • Auto-calls WebServer::startDiagnosis()                     │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ Step 4: DIAGNOSIS STARTED (startDiagnosis)                    │
│ ─────────────────────────────────────────────────────────────  │
│ • Sets activePatientId & activePatientName in WebServer      │
│ • Sets patientJustCalled = true (flag for main loop)         │
│ • Resets MeasurementEngine buffers                           │
│ • BROADCASTS to Serial Monitor:                              │
│   === CALL PATIENT FOR DIAGNOSIS ===                         │
│   Patient Name: John Doe                                     │
│   Patient ID: 1                                              │
│   *** CALL PATIENT TO PLACE FINGER ON SENSOR ***             │
└────────────────────────┬───────────────────────────────────────┘
                         │
         ┌───────────────┴──────────────┐
         ▼                              ▼
   LCD Display Updates         Dashboard (Browser) Updates
   ─────────────────────       ── ────────────────────────
   Shows: "Call Patient"       fetchMeasurements() runs
   John Doe                    API: GET /api/measurements
        Place finger now       Returns:
                              • activePatientName: "John Doe"
                              • canMeasure: true
                              • workflowMessage: "Call John Doe..."

                              Dashboard UI shows:
                              ✓ Patient name in header
                              ✓ Status: "Ready for diagnosis"
                              ✓ Waiting for finger placement
```

---

## 2. Real-Time Finger Detection & Measurement Flow

```
┌────────────────────────────────────────────────────────────────┐
│ Step 1: MAIN LOOP POLLS SENSOR (loop() in main.cpp)           │
│ ─────────────────────────────────────────────────────────────  │
│ Every ~100ms (SENSOR_UPDATE_INTERVAL):                        │
│ • Reads MAX30102 sensor (IR & Red LED values)                │
│ • Passes to MeasurementEngine::addReading()                   │
│ • Engine accumulates samples in buffer                        │
│ • Calculates SpO2, HR, Hemoglobin when ready                  │
│ • Updates lastMeasurement struct                             │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ Step 2: FINGER STATE CHANGE DETECTION                          │
│ ─────────────────────────────────────────────────────────────  │
│ Compare: engine.isFingerDetected() with lastFingerState       │
│                                                                │
│ IF Finger Placed (false → true):                              │
│ • lastFingerState = true                                      │
│ • measurementInProgress = true                                │
│ • BROADCASTS to Serial Monitor:                               │
│   === FINGER PLACED ON SENSOR ===                             │
│   Patient: John Doe                                           │
│   Time: 1234s                                                 │
│   Starting measurement collection...                          │
│                                                                │
│ IF Finger Removed (true → false):                             │
│ • lastFingerState = false                                     │
│ • measurementInProgress = false                               │
│ • BROADCASTS to Serial Monitor:                               │
│   === FINGER REMOVED FROM SENSOR ===                          │
│   Patient: John Doe                                           │
│   Time: 1267s                                                 │
│   Measurement interrupted                                     │
└────────────────────────┬───────────────────────────────────────┘
                         │
         ┌───────────────┴──────────────┐
         ▼                              ▼
   LCD Display Updates         Dashboard (Browser) Updates
   ─────────────────────       ── ────────────────────────
   FINGER ON:                  API: GET /api/measurements
   Shows: "Diagnosis Active     Returns:
           Measuring...        • fingerDetected: true
           Keep finger still"  • measurementInProgress: true
                              • workflowMessage:
   FINGER OFF:                  "Measuring John Doe... keep still"
   Shows: "Call Patient:
           John Doe            Dashboard UI shows:
           Place finger now"   ✓ "Measuring..." indicator
                              ✓ Real-time vital signs updating
                              ✓ Charts showing trends
```

---

## 3. Measurement Complete & Results Saved

```
┌────────────────────────────────────────────────────────────────┐
│ Step 1: ENGINE READY (100+ samples collected)                 │
│ ─────────────────────────────────────────────────────────────  │
│ MeasurementEngine calculates:                                  │
│ • Final SpO2 value                                           │
│ • Heart Rate (BPM)                                           │
│ • Hemoglobin estimation                                      │
│ • Anemia status                                              │
│ • Sets Measurement.isValid = true                            │
│                                                                │
│ Stores in lastMeasurement:                                     │
│ • heartRate: 72                                              │
│ • spo2: 97.5                                                 │
│ • hemoglobin: 14.2                                           │
│ • status: "NORMAL (13-17 g/dL)"                              │
│ • timestamp: millis()                                        │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ Step 2: RESULTS CAPTURED & PROPAGATED (main.cpp)              │
│ ─────────────────────────────────────────────────────────────  │
│ Action: Update measurement state in WebServerModule           │
│                                                                │
│ webServer.updateMeasurementState(                             │
│   true,          // fingerDetected                           │
│   true,          // measurementInProgress                    │
│   72,            // lastHeartRate                            │
│   97.5,          // lastSpO2                                 │
│   14.2,          // lastHemoglobin                           │
│   "NORMAL..."    // lastStatus                              │
│ );                                                             │
│                                                                │
│ State saved in WebServerModule:                                │
│ • lastHeartRate = 72                                         │
│ • lastSpO2 = 97.5                                            │
│ • lastHemoglobin = 14.2                                      │
│ • lastStatus = "NORMAL..."                                   │
│ • measurementInProgress = true                               │
│                                                                │
│ BROADCASTS to Serial Monitor:                                  │
│ === MEASUREMENT COMPLETE - SAVING RESULTS ===                 │
│ Patient ID: 1                                                │
│ Patient Name: John Doe                                       │
│ Heart Rate (BPM): 72                                         │
│ SpO2 (%): 97                                                 │
│ Hemoglobin (g/dL): 14.2                                      │
│ Status: NORMAL (13-17 g/dL)                                  │
│ Timestamp: 1267s                                             │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ Step 3: RESULTS SAVED TO PATIENT RECORD                        │
│ ─────────────────────────────────────────────────────────────  │
│ Call: PatientManager::updateMeasurement()                      │
│                                                                │
│ Updates patient record:                                        │
│ patients[0]:                                                   │
│   lastHemoglobin = 14.2                                       │
│   lastSpO2 = 97.5                                             │
│   heartRate = 72                                              │
│                                                                │
│ Data persists in ESP32 RAM throughout session                 │
│ (Note: Not saved to SPIFFS, but could be added)               │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ Step 4: AUTO-ADVANCE QUEUE                                     │
│ ─────────────────────────────────────────────────────────────  │
│ Call: webServer.completeDiagnosis(true)                        │
│                                                                │
│ Actions:                                                       │
│ • Remove patient from queue                                  │
│ • Clear activePatientId & activePatientName                  │
│ • Reset MeasurementEngine                                    │
│ • Auto-call next queued patient (if exists)                  │
│                                                                │
│ BROADCASTS to Serial Monitor:                                  │
│ === DIAGNOSIS COMPLETED ===                                   │
│ ...patient results...                                          │
│ Diagnosis completed for: John Doe                             │
│ Queue empty after completion                                  │
│                                                                │
│ OR (if queue has more):                                        │
│ === CALL PATIENT FOR DIAGNOSIS ===                             │
│ Patient Name: Jane Smith                                      │
│ ...calls next patient...                                       │
└────────────────────────┬───────────────────────────────────────┘
                         │
         ┌───────────────┴──────────────┐
         ▼                              ▼
   LCD Display Updates         Dashboard (Browser) Updates
   ─────────────────────       ── ────────────────────────
   Shows Results:              API: GET /api/measurements
   "Diagnosis Result           Returns:
    HR: 72                     • heartRate: 72
    SpO2: 97%                  • spo2: 97.5
    Hb: 14.2 g/dL              • hemoglobin: 14.2
    Status: NORMAL"            • lastStatus: "NORMAL..."
                              • measurementInProgress: false
   Then Calls Next:            • fingerDetected: false
   "Call Patient:
    Jane Smith                  Dashboard UI shows:
    Place finger now"          ✓ Final measurement results
                              ✓ Status badge: NORMAL
                              ✓ Charts updated with new point
                              ✓ Queue updated (John removed)
                              ✓ Next patient name: "Jane Smith"
                              ✓ System ready message
```

---

## 4. API Real-Time Update Endpoints

### GET /api/measurements

**Frequency:** Every 2 seconds from dashboard  
**Returns:**

```json
{
  "heartRate": 72,
  "spO2": 97.5,
  "hemoglobin": 14.2,
  "status": "NORMAL (13-17 g/dL)",
  "timestamp": 1267000,
  "valid": true,
  "canMeasure": true,
  "activePatientId": "1",
  "activePatientName": "John Doe",
  "workflowMessage": "Measuring John Doe... keep still",

  // Real-time state propagation fields
  "fingerDetected": true, // Is finger on sensor?
  "measurementInProgress": true, // Are we actively measuring?
  "lastHeartRate": 72, // Most recent HR
  "lastSpO2": 97.5, // Most recent SpO2
  "lastHemoglobin": 14.2, // Most recent Hb
  "lastStatus": "NORMAL..." // Most recent status
}
```

### GET /api/status

**Frequency:** Every 10 seconds from dashboard  
**Returns system health & queue status**

### GET /api/queue

**Frequency:** Every 5 seconds from queue page  
**Returns complete queue with positions**

---

## 5. How C++ and JavaScript Fit Together

Yes, C++ and JavaScript integrate well in this project.

Recommended event patterns:

- **HTTP + JSON**: C++ serves data, JS polls or submits forms.
- **Server-Sent Events or WebSockets**: C++ pushes live events to JS instantly.
- **localStorage events**: JS pages on the same origin can notify each other.

In this project:

- Firmware logs registration and queue events from C++ to the serial monitor.
- The browser registers patients with `fetch()` and updates the dashboard from JSON.
- For more immediate UI updates, a WebSocket or SSE layer is the best next step.
- If you are using `npm run dev`, the Node test server now prints registration events in the terminal too.

---

## 6. State Persistence & Saving

### Where Data is Stored:

- **Memory (volatile):** Measurement results, queue status
- **Patient Record:** Final diagnosis saved to PatientManager

### Data That Persists:

- Patient list (while system running)
- Measurement results (while system running)
- Queue order (while system running)

### Data Cleared When:

- Patient diagnosis completes and removed from queue
- Finger removed (measurement engine reset)
- New patient diagnosis starts

---

## 7. Real-Time Propagation Timeline

### 100ms intervals:

```
[Sensor Read] → [Engine Process] → [State Update] → [Serial Log]
     ↓              ↓                  ↓
  IR/Red        Calculate         Check finger
  LEDs          SpO2/HR           state changes
               / Hemoglobin
```

### 2 second intervals:

```
[Dashboard Poll] → [API Request] → [JSON Response] → [UI Update]
   browser         GET /api/        incl. real-time      charts,
                 measurements       state fields         gauges
```

### Event-Based (immediate):

```
[Finger Placed] → [State Changed] → [Serial Broadcast] → [LCD Update]
                                    === FINGER ON ===    Show "Measuring"

[Measurement Done] → [Results Calc] → [All Systems] → [Auto Next]
                                      Updated in         Start
                                      parallel            diagnosis
```

---

## 8. Dashboard Real-Time Updates

### What The Dashboard Shows:

1. **Active Patient:** Name of patient currently being measured
2. **Workflow Status:** What step we're on (waiting, measuring, results)
3. **Real-time Vitals:**
   - Heart Rate gauge (0-150 BPM)
   - SpO2 gauge (70-100%)
   - Hemoglobin gauge (8-18 g/dL)
   - Status badge (NORMAL/MILD/MODERATE/SEVERE)
4. **Live Charts:** Trends over last 60 measurements
5. **Finger Detection:** Shows if finger is on sensor
6. **Measurement Progress:** "Measuring..." indicator while active

### How Dashboard Stays Synchronized:

1. Polls API every 2 seconds
2. Receives real-time state in JSON response:
   - `fingerDetected`: Finger on/off
   - `measurementInProgress`: Currently measuring?
   - `lastHeartRate/SpO2/Hemoglobin`: Most recent values
3. Updates UI immediately when state changes
4. Uses Event Listeners for cross-page notifications

---

## 9. Error Handling & State Recovery

### If Patient Removed Mid-Measurement:

1. Main loop detects activePatientId is ""
2. Clears all measurement state
3. LCD shows "System Ready"
4. Dashboard shows "No patient" status

### If Network/Dashboard Disconnects:

1. Hardware continues normally
2. Serial monitor logs everything
3. LCD displays all status locally
4. When dashboard reconnects, catches up immediately

### If Measurement Fails:

1. Engine resets isValid = false
2. Buffers cleared
3. LCD shows "Ready" or waiting state
4. Patient can try again

---

## 10. Complete Message Flow Example

```
USER: Registers Patient "John Doe"
 └─→ Browser sends: POST /api/patients {name: "John Doe", ...}
     └─→ ESP32 responds: {success: true, patientId: 1}
         └─→ Browser queues: POST /api/queue {patientId: "1"}
             └─→ ESP32 responds: {success: true, position: 1}
                 └─→ Serial Monitor shows:
                     === PATIENT REGISTERED ===
                     === PATIENT QUEUED ===
                     === DIAGNOSIS STARTED ===
                 └─→ LCD shows: "Call Patient: John Doe"
                 └─→ Dashboard updates:
                     • Patient name
                     • Workflow: "Place finger"
                     • Status changed to "Diagnosis Ready"

USER: Places finger on sensor
 └─→ MAX30102 detects pressure
     └─→ Main loop detects: engine.isFingerDetected() = true
         └─→ Serial Monitor shows:
             === FINGER PLACED ON SENSOR ===
         └─→ LCD shows: "Diagnosis Active - Measuring..."
         └─→ Next API call includes:
             "fingerDetected": true
             "measurementInProgress": true
         └─→ Dashboard shows:
             • "Measuring..." indicator
             • Live updating vital signs
             • Status: "Collecting data"

SYSTEM: Measurement completes (100 samples)
 └─→ Engine calculates: HR=72, SpO2=97.5, Hb=14.2
     └─→ Main loop saves state via updateMeasurementState()
         └─→ Serial Monitor shows:
             === MEASUREMENT COMPLETE - SAVING RESULTS ===
             HR: 72, SpO2: 97.5, Hb: 14.2
             Status: NORMAL
         └─→ WebServer updates PatientManager
         └─→ completeDiagnosis() is called
         └─→ Patient removed from queue
         └─→ Next patient called (if exists)
         └─→ LCD shows results, then "Call next patient"
         └─→ Dashboard shows:
             • Final results display
             • Queue updated (John removed)
             • Next patient info (if any)
             • Ready for next measurement
```

---

## Key Takeaways

✅ **Patient Registration** → Immediately saved to internal database  
✅ **Queue Operations** → Real-time positions broadcast  
✅ **Diagnosis Start** → Both LCD and dashboard notified instantly  
✅ **Finger Placement** → Detected within 100ms, state propagated  
✅ **Measurement Progress** → Streamed to dashboard every 2 seconds  
✅ **Results Obtained** → Saved and broadcast within 100ms  
✅ **Auto Advancement** → Next patient called automatically  
✅ **Serial Monitor** → Shows every state change for debugging

**The system is fully synchronized - changes on hardware appear on dashboard immediately, and vice versa.**
