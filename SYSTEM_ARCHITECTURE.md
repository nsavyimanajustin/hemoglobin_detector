# Hemoglobin Detector - System Architecture & Data Flow

## Complete System Overview

This document explains how data flows through the entire hemoglobin detector system in real-time, ensuring all components (hardware, software, and dashboard) stay synchronized.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WEB DASHBOARD                              │
│  (Frontend: Browser-based Real-time Display & Patient Management)  │
├─────────────────────────────────────────────────────────────────────┤
│  • Dashboard (index.html) - Real-time measurements visualization   │
│  • Patient Registration (register.html) - Queue new patients       │
│  • Queue Status (queue.html) - View queue and calling status       │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ HTTP/JSON API (every 2 seconds)
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                    ESP32 MICROCONTROLLER                            │
│         (Embedded System: Data Processing & Control)               │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ Main Loop (core/main.cpp)                                  │  │
│ │ • Reads sensor continuously                                │  │
│ │ • Detects finger placement/removal                         │  │
│ │ • Tracks measurement state changes                         │  │
│ │ • Notifies dashboard of all state updates                  │  │
│ │ • Saves diagnosis results to PatientManager               │  │
│ └──────┬───────────────────────────────────────────────────────┘  │
│        │                                                           │
│ ┌──────▼──────────────────────────────────────────────────────┐  │
│ │ Web Server Module (web_server_module.cpp)                 │  │
│ │ • REST API endpoints (/api/...)                           │  │
│ │ • Real-time state management                              │  │
│ │ • Patient queue management                                │  │
│ │ • Diagnosis workflow control                              │  │
│ │ • Dashboard data broadcasting                             │  │
│ └──────┬───────────────────────────────────────────────────────┘  │
│        │                                                           │
│ ┌──────▼──────────────────────────────────────────────────────┐  │
│ │ Measurement Engine (measurement_engine.cpp)                │  │
│ │ • Signal processing from sensor                            │  │
│ │ • SpO2 calculation                                         │  │
│ │ • Heart rate detection                                    │  │
│ │ • Hemoglobin estimation                                   │  │
│ │ • Anemia status determination                             │  │
│ └──────┬───────────────────────────────────────────────────────┘  │
│        │                                                           │
│ ┌──────▼──────────────────────────────────────────────────────┐  │
│ │ Sensor Module (sensor_module.cpp)                          │  │
│ │ • I2C communication with MAX30102                          │  │
│ │ • Reads IR & Red LED values                               │  │
│ │ • Returns raw sensor data                                 │  │
│ └──────┬───────────────────────────────────────────────────────┘  │
│        │                                                           │
│ ┌──────▼──────────────────────────────────────────────────────┐  │
│ │ LCD Display Module (lcd_display.cpp)                       │  │
│ │ • Shows current status/measurements                        │  │
│ │ • Displays patient being called                            │  │
│ │ • Shows measurement progress                              │  │
│ │ • Real-time vital signs display                           │  │
│ └──────┬───────────────────────────────────────────────────────┘  │
│        │                                                           │
│ ┌──────▼──────────────────────────────────────────────────────┐  │
│ │ Debug Logger (debug_logger.cpp)                            │  │
│ │ • Serial monitor output                                    │  │
│ │ • State change notifications                              │  │
│ │ • Error/warning logging                                   │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
└─────────────────────────────────────────────────────────────────────┘
         │ I2C                              │ Serial/WiFi
         │                                  │
    ┌────▼─────┐                    (Dashboard receives
    │ MAX30102  │                     real-time updates)
    │  Sensor   │
    └──────────┘
```
