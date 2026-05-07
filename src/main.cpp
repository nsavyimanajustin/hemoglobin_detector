#include <Arduino.h>
#include <Wire.h>

// Include all modules
#include "config.h"
#include "debug_logger.h"
#include "sensor_module.h"
#include "lcd_display.h"
#include "measurement_engine.h"
#include "wifi_manager_module.h"
#include "web_server_module.h"

// ==================== GLOBAL INSTANCES ====================
SensorModule sensor;
LCDDisplay lcd;
MeasurementEngine engine;
WiFiManagerModule wifiManager;
WebServerModule webServer;

// Timing
unsigned long lastMeasurementTime = 0;
unsigned long lastWorkflowHintTime = 0;
unsigned long lastHeartbeatTime = 0;
String lastDisplayedPatientName = "";
unsigned long lastPatientNotificationTime = 0;

// State tracking for real-time propagation
bool lastFingerState = false; // Track finger on/off state
unsigned long lastStateChangeTime = 0;
int lastMeasuredHeartRate = 0;
float lastMeasuredSpO2 = 0.0;
float lastMeasuredHemoglobin = 0.0;
String lastMeasurementStatus = "INITIALIZING";
bool measurementInProgress = false;
bool wasDiagnosisActive = false;
unsigned long transientDisplayUntil = 0;

// ==================== SETUP ====================
void setup()
{
  // Initialize debug logger first
  debug.begin(DEBUG_BAUD_RATE);
  debug.setLevel(DEBUG_VERBOSE);

  // Initialize I2C bus
  debug.info("Initializing I2C bus...");
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  // Initialize LCD display
  if (!lcd.begin())
  {
    debug.error("LCD initialization failed");
    while (1)
      delay(1000);
  }
  lcd.showStarting();
  delay(1000);

  // Initialize MAX30102 sensor
  lcd.showInitializing("MAX30102");
  if (!sensor.begin())
  {
    debug.error("Sensor initialization failed");
    lcd.showError("ERROR", "No Sensor");
    while (1)
      delay(1000);
  }

  // Initialize WiFi (non-critical - web server can work offline)
  wifiManager.begin(false);

  // Initialize web server (works with or without WiFi)
  webServer.begin(&engine, false); // false = WiFi not required

  // System ready
  lcd.showReady();
  delay(1500);

  webServer.setSystemOnline(true, "startup_complete");

  debug.info("System initialization complete");
  debug.info("Waiting for patient registration and queue selection...");

  lastMeasurementTime = millis();
}

// ==================== MAIN LOOP ====================
void loop()
{
  // Show short workflow notices from web events (registration/queue transitions).
  String workflowLine1;
  String workflowLine2;
  if (webServer.consumeWorkflowNotice(workflowLine1, workflowLine2))
  {
    debug.log(DEBUG_INFO, "Workflow notice", workflowLine1 + (workflowLine2.length() > 0 ? String(" -> ") + workflowLine2 : ""));
    lcd.showNotification(workflowLine1.c_str(), workflowLine2.c_str());
    transientDisplayUntil = millis() + 1500;
  }

  // Check if a patient was just called and show immediately on LCD
  if (webServer.checkPatientJustCalled())
  {
    debug.header("=== PATIENT CALLED NOTIFICATION ===");
    debug.log(DEBUG_INFO, "Showing on LCD", webServer.getActivePatientName());
    debug.info("LCD: Call Patient - Place Finger on Sensor");
    debug.footer();

    if (!webServer.getActivePatientName().isEmpty())
    {
      lcd.showCallPatient(webServer.getActivePatientName().c_str());
      transientDisplayUntil = millis() + 1200;
    }
  }

  // Check if active patient has changed and notify
  if (webServer.getActivePatientName() != lastDisplayedPatientName)
  {
    lastDisplayedPatientName = webServer.getActivePatientName();
    lastPatientNotificationTime = millis();

    if (webServer.canMeasure())
    {
      debug.header("=== PATIENT NOTIFICATION ===");
      debug.log(DEBUG_INFO, "Active Patient", lastDisplayedPatientName);
      debug.info("Ready for diagnosis measurement");
      debug.footer();
    }
  }

  // Keep workflow prompts visible even if a sensor read intermittently fails.
  const bool canMeasureNow = webServer.canMeasure();
  const bool transientDisplayActive = millis() < transientDisplayUntil;

  if (canMeasureNow)
  {
    if (!engine.isFingerDetected() && !transientDisplayActive)
    {
      lcd.showCallPatient(webServer.getActivePatientName().c_str());
    }
  }
  else if (wasDiagnosisActive && !transientDisplayActive)
  {
    // Only redraw ready screen on transition from diagnosis->idle.
    lcd.showReady();
  }
  wasDiagnosisActive = canMeasureNow;

  // Read sensor values
  long irValue = 0;
  long redValue = 0;

  if (sensor.readSensor(irValue, redValue))
  {
    // Only allow diagnosis once a queued patient is actively selected.
    if (!canMeasureNow)
    {
      if (engine.checkFingerOnSensor(irValue))
      {
        if (millis() - lastWorkflowHintTime > 3000)
        {
          debug.warn("Finger detected but no active patient diagnosis session");
          debug.warn("Register patient and start diagnosis from queue page");
          lastWorkflowHintTime = millis();
        }
        if (!transientDisplayActive)
        {
          lcd.showError("Register First", "Use Queue Page");
        }
      }
      delay(SENSOR_UPDATE_INTERVAL);
      return;
    }

    // Track finger state changes
    bool currentFingerState = engine.isFingerDetected();
    if (currentFingerState != lastFingerState)
    {
      lastFingerState = currentFingerState;
      lastStateChangeTime = millis();

      if (currentFingerState)
      {
        debug.header("=== FINGER PLACED ON SENSOR ===");
        debug.log(DEBUG_INFO, "Patient", webServer.getActivePatientName());
        debug.log(DEBUG_INFO, "Time", String(millis() / 1000) + "s");
        debug.info("Starting measurement collection...");
        debug.footer();
        measurementInProgress = true;
      }
      else
      {
        debug.header("=== FINGER REMOVED FROM SENSOR ===");
        debug.log(DEBUG_INFO, "Patient", webServer.getActivePatientName());
        debug.log(DEBUG_INFO, "Time", String(millis() / 1000) + "s");
        debug.info("Measurement interrupted");
        debug.footer();
        measurementInProgress = false;
      }
    }

    // Add reading to measurement engine
    engine.addReading(irValue, redValue);

    // Get current measurement
    const Measurement &m = engine.getMeasurement();

    // Update display
    if (m.isValid)
    {
      // Show measurement results
      lcd.showMeasurements(m.heartRate, m.spo2, m.hemoglobin, m.status.c_str());

      // Save state for propagation to dashboard
      lastMeasuredHeartRate = m.heartRate;
      lastMeasuredSpO2 = m.spo2;
      lastMeasuredHemoglobin = m.hemoglobin;
      lastMeasurementStatus = m.status;
      webServer.updateMeasurementState(currentFingerState, true, m.heartRate, m.spo2, m.hemoglobin, m.status);

      debug.header("=== MEASUREMENT COMPLETE - SAVING RESULTS ===");
      debug.log(DEBUG_INFO, "Patient ID", webServer.getActivePatientId());
      debug.log(DEBUG_INFO, "Patient Name", webServer.getActivePatientName());
      debug.log(DEBUG_INFO, "Heart Rate (BPM)", m.heartRate);
      debug.log(DEBUG_INFO, "SpO2 (%)", (int)m.spo2);
      debug.log(DEBUG_INFO, "Hemoglobin (g/dL)", m.hemoglobin);
      debug.log(DEBUG_INFO, "Status", m.status);
      debug.log(DEBUG_INFO, "Timestamp", String(millis() / 1000) + "s");
      debug.footer();

      // Complete current diagnosis and auto-call the next patient.
      if (webServer.completeDiagnosis(true))
      {
        debug.info("Diagnosis cycle complete and queue advanced");
        measurementInProgress = false;
        // Keep results visible for 5 seconds before prompting the next patient.
        delay(5000);
      }

      // Log every 5 seconds
      if (millis() - lastMeasurementTime > 5000)
      {
        debug.log(DEBUG_INFO, "HR (bpm)", m.heartRate);
        debug.log(DEBUG_INFO, "SpO2 (%)", m.spo2);
        debug.log(DEBUG_INFO, "Hemoglobin (g/dL)", m.hemoglobin);
        debug.log(DEBUG_INFO, "Status", m.status);
        debug.log(DEBUG_INFO, "IR Value", (int)m.irValue);
        debug.log(DEBUG_INFO, "Red Value", (int)m.redValue);
        lastMeasurementTime = millis();
      }
    }
    else
    {
      // Still measuring
      if (engine.isFingerDetected())
      {
        if (!transientDisplayActive)
        {
          lcd.showMeasuring();
        }
        if (!measurementInProgress)
        {
          measurementInProgress = true;
        }
      }
      else
      {
        if (!transientDisplayActive)
        {
          lcd.showCallPatient(webServer.getActivePatientName().c_str());
        }
        if (measurementInProgress)
        {
          measurementInProgress = false;
        }
      }
    }
  }

  // Update WiFi status periodically
  static unsigned long lastWiFiUpdate = 0;
  if (millis() - lastWiFiUpdate > 10000)
  {
    wifiManager.update();
    lastWiFiUpdate = millis();
  }

  if (millis() - lastHeartbeatTime > 10000)
  {
    debug.log(DEBUG_INFO, "System heartbeat", webServer.canMeasure() ? "DIAGNOSIS_READY" : "WAITING_FOR_QUEUE");
    lastHeartbeatTime = millis();
  }

  delay(SENSOR_UPDATE_INTERVAL);
}
