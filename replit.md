# Non-Invasive Hemoglobin and Anemia Detection System

## Project Overview

An IoT-based medical screening web dashboard that simulates a hemoglobin/anemia detector. In production, the actual system uses an ESP32 microcontroller with a MAX30102 pulse oximeter sensor. In this Replit environment, a Node.js test server (`test-server.js`) simulates the ESP32's HTTP API and serves the web frontend.

## Architecture

- **Backend/Server**: `test-server.js` — Express.js server simulating the ESP32 REST API
- **Frontend**: Static HTML/CSS/JS files in the `data/` directory, served by the same Express server
- **Embedded Firmware**: C++ (Arduino/PlatformIO) in `src/` — for actual ESP32 hardware (not run in Replit)

## Key Files

- `test-server.js` — Main Express server (simulates ESP32 API + serves frontend)
- `data/index.html` — Main dashboard
- `data/register.html` — Patient registration page
- `data/queue.html` — Queue management page
- `data/style.css` — Styles
- `data/app.js` — Frontend JavaScript
- `platformio.ini` — ESP32 firmware build config (not used in Replit)
- `src/` — ESP32 C++ firmware source files

## Running

- **Port**: 5000 (bound to 0.0.0.0)
- **Workflow**: `node test-server.js`
- **Start**: The "Start application" workflow runs the server

## API Endpoints (simulated)

- `GET /` — Dashboard
- `GET /api/status` — System status
- `GET /api/measurements` — Current sensor readings
- `GET /api/patients` — List registered patients
- `POST /api/patients` — Register a new patient
- `GET /api/queue` — Queue status
- `POST /api/queue` — Add patient to queue
- `POST /api/diagnosis/start` — Begin diagnosis
- `POST /api/diagnosis/complete` — Complete diagnosis
- `GET /events` — Server-Sent Events stream for real-time updates
- `GET /api/settings` — Device settings

## Package Manager

- **npm** (Node.js 20)
- Dependencies: `express`, `body-parser`
- Dev dependencies: `nodemon`, `eslint`, `prettier`, `eventsource`
