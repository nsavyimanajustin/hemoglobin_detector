#include "web_server_module.h"
#include "debug_logger.h"
#include <ArduinoJson.h>
#include <SPIFFS.h>
#include <WiFi.h>

static void logWorkflowEvent(const char *event, const String &details)
{
  Serial.printf("[%lu ms] %s: %s\r\n", millis(), event, details.c_str());
  Serial.flush();
}

void WebServerModule::publishEvent(const String &eventType, const String &message, const String &details)
{
  JsonDocument doc;
  doc["eventType"] = eventType;
  doc["message"] = message;
  doc["details"] = details;
  doc["timestampMs"] = millis();

  String payload;
  serializeJson(doc, payload);

  Serial.printf("[%lu ms] %s: %s\r\n", millis(), eventType.c_str(), message.c_str());
  if (details.length() > 0)
  {
    Serial.printf("[%lu ms] %s_DETAILS: %s\r\n", millis(), eventType.c_str(), details.c_str());
  }
  Serial.flush();

  events.send(payload.c_str(), eventType.c_str(), millis());
}

int PatientManager::addPatient(const String &name, const String &phone, const String &gender, int age)
{
  if (patientCount >= MAX_PATIENTS)
    return -1;

  int patientId = nextPatientId++; // Get unique ID: 1, 2, 3...
  patients[patientCount].id = String(patientId);
  patients[patientCount].numericId = patientId;
  patients[patientCount].name = name;
  patients[patientCount].phone = phone;
  patients[patientCount].gender = gender;
  patients[patientCount].age = age;
  patients[patientCount].registeredAt = millis();
  patients[patientCount].lastHemoglobin = 0;
  patients[patientCount].lastSpO2 = 0;
  patients[patientCount].heartRate = 0;

  debug.header("=== PATIENT REGISTERED ===");
  debug.log(DEBUG_INFO, "Patient ID", patientId);
  debug.log(DEBUG_INFO, "Name", name);
  debug.log(DEBUG_INFO, "Phone", phone);
  debug.log(DEBUG_INFO, "Age", age);
  debug.log(DEBUG_INFO, "Gender", gender);
  debug.footer();
  logWorkflowEvent("PATIENT_REGISTERED", String("ID=") + patientId + ", Name=" + name + ", Phone=" + phone + ", Age=" + age + ", Gender=" + gender);

  patientCount++;   // Increment to maintain correct count
  return patientId; // Return the actual patient ID
}

Patient *PatientManager::getPatient(const String &id)
{
  // Try to match by numeric ID first
  int numericId = id.toInt();
  if (numericId > 0)
  {
    for (int i = 0; i < patientCount; i++)
    {
      if (patients[i].numericId == numericId)
        return &patients[i];
    }
  }

  // Fallback to string ID for backward compatibility
  for (int i = 0; i < patientCount; i++)
  {
    if (patients[i].id == id)
      return &patients[i];
  }
  return nullptr;
}

Patient *PatientManager::listPatients(int *count)
{
  *count = patientCount;
  return patients;
}

int PatientManager::addToQueue(const String &patientId)
{
  if (queueCount >= MAX_QUEUE_SIZE)
    return -1;

  Patient *p = getPatient(patientId);
  if (!p)
    return -1;

  for (int i = 0; i < queueCount; i++)
  {
    if (queue[i].patientId == patientId)
      return -1;
  }

  queue[queueCount].patientId = patientId;
  queue[queueCount].patientName = p->name;
  queue[queueCount].queuedAt = millis();
  queue[queueCount].position = queueCount + 1;

  debug.log(DEBUG_INFO, "Added to queue", p->name);
  logWorkflowEvent("PATIENT_QUEUED", String("ID=") + patientId + ", Name=" + p->name + ", Position=" + String(queueCount + 1));
  return queueCount++;
}

QueueEntry *PatientManager::getQueue(int *count)
{
  *count = queueCount;
  return queue;
}

QueueEntry *PatientManager::callNext()
{
  if (queueCount == 0)
    return nullptr;
  return &queue[0];
}

bool PatientManager::removeFromQueue(const String &patientId)
{
  for (int i = 0; i < queueCount; i++)
  {
    if (queue[i].patientId == patientId)
    {
      for (int j = i; j < queueCount - 1; j++)
      {
        queue[j] = queue[j + 1];
        queue[j].position = j + 1;
      }
      queueCount--;
      debug.log(DEBUG_INFO, "Removed from queue", patientId);
      return true;
    }
  }
  return false;
}

bool PatientManager::updateMeasurement(const String &patientId, float hb, float spo2, int hr)
{
  Patient *p = getPatient(patientId);
  if (!p)
    return false;
  p->lastHemoglobin = hb;
  p->lastSpO2 = spo2;
  p->heartRate = hr;
  return true;
}

WebServerModule::WebServerModule() : server(WEB_SERVER_PORT)
{
  // Constructor
}

bool WebServerModule::begin(MeasurementEngine *engine, bool requireWiFi)
{
  debug.header("Web Server Module");

  if (!engine)
  {
    debug.error("MeasurementEngine not provided");
    debug.footer();
    return false;
  }

  measurementEngine = engine;
  wifiRequired = requireWiFi;

  // Initialize SPIFFS
  debug.info("Mounting SPIFFS filesystem...");
  if (!SPIFFS.begin(true))
  {
    debug.error("SPIFFS mount failed");
    debug.footer();
    return false;
  }

  debug.info("SPIFFS mounted successfully");

  // List files on SPIFFS
  File root = SPIFFS.open("/");
  File file = root.openNextFile();
  int fileCount = 0;

  debug.info("Files on SPIFFS:");
  while (file)
  {
    debug.log(DEBUG_VERBOSE, "  File", file.name());
    fileCount++;
    file = root.openNextFile();
  }
  debug.log(DEBUG_INFO, "Total files", fileCount);

  // Setup endpoints
  debug.info("Setting up REST API endpoints...");
  setupRestAPI();

  debug.info("Setting up web dashboard...");
  setupWebDashboard();

  // Start server
  debug.info("Starting AsyncWebServer on port 80...");
  start();

  debug.footer();
  return true;
}

void WebServerModule::start()
{
  if (!running)
  {
    server.begin();
    running = true;
    debug.header("Web Server Started");
    debug.info("Access the dashboard at:");
    if (WiFi.status() == WL_CONNECTED)
    {
      String localUrl = String("http://") + WiFi.localIP().toString();
      debug.log(DEBUG_INFO, "  Local IP", localUrl);
    }
    else
    {
      debug.log(DEBUG_INFO, "  Local IP", "offline (no WiFi)");
    }
    debug.log(DEBUG_INFO, "  mDNS", "http://hemoglobin-detector.local");
    debug.footer();
  }
}

void WebServerModule::stop()
{
  if (running)
  {
    server.end();
    running = false;
    debug.info("Web server stopped");
  }
}

void WebServerModule::setupRestAPI()
{
  // GET /api/measurements - Current measurement data
  server.on("/api/measurements", HTTP_GET, [this](AsyncWebServerRequest *request)
            {
    if (!measurementEngine) {
      request->send(500, "application/json", "{\"error\":\"Engine not initialized\"}");
      return;
    }
    
    const Measurement& m = measurementEngine->getMeasurement();
    
    JsonDocument doc;
    // Return both modern and legacy keys to keep old dashboards compatible.
    doc["heartRate"] = m.heartRate;
    doc["hr"] = m.heartRate;
    doc["spO2"] = m.spo2;
    doc["spo2"] = m.spo2;
    doc["hemoglobin"] = m.hemoglobin;
    doc["status"] = m.status;
    doc["irValue"] = m.irValue;
    doc["ir_value"] = m.irValue;
    doc["redValue"] = m.redValue;
    doc["red_value"] = m.redValue;
    doc["timestamp"] = m.timestamp;
    doc["valid"] = m.isValid && canMeasure();
    doc["canMeasure"] = canMeasure();
    doc["activePatientId"] = activePatientId;
    doc["activePatientName"] = activePatientName;
    
    // Real-time state propagation for dashboard
    doc["fingerDetected"] = getFingerDetected();
    doc["measurementInProgress"] = getMeasurementInProgress();
    doc["lastHeartRate"] = getLastHeartRate();
    doc["lastSpO2"] = getLastSpO2();
    doc["lastHemoglobin"] = getLastHemoglobin();
    doc["lastStatus"] = getLastStatus();
    
    if (canMeasure()) {
      if (getFingerDetected()) {
        doc["workflowMessage"] = String("Measuring ") + activePatientName + "... keep still";
      } else {
        doc["workflowMessage"] = String("Call ") + activePatientName + " for diagnosis";
      }
    } else if (patientManager.getQueueCount() > 0) {
      doc["workflowMessage"] = String("Waiting to call ") + getNextQueuedPatientName();
    } else {
      doc["workflowMessage"] = "No patients in queue";
    }
    
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response); });

  // GET /api/status - System status
  server.on("/api/status", HTTP_GET, [this](AsyncWebServerRequest *request)
            {
    JsonDocument doc;
    doc["system"] = "online";
    doc["uptime_ms"] = millis();
    doc["has_measurement"] = measurementEngine->getMeasurement().isValid;
    doc["canMeasure"] = canMeasure();
    doc["activePatientId"] = activePatientId;
    doc["activePatientName"] = activePatientName;
    doc["diagnosisActive"] = diagnosisActive;
    doc["queueCount"] = patientManager.getQueueCount();
    doc["nextPatientName"] = getNextQueuedPatientName();
    
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response); });

  // GET /api/settings - Configuration
  server.on("/api/settings", HTTP_GET, [this](AsyncWebServerRequest *request)
            {
    JsonDocument doc;
    doc["device_name"] = "Hemoglobin Detector";
    doc["version"] = "1.0";
    doc["normal_hb_min"] = NORMAL_HB_MIN;
    doc["mild_anemia_hb_min"] = MILD_ANEMIA_HB_MIN;
    doc["moderate_anemia_hb_min"] = MODERATE_ANEMIA_HB_MIN;
    doc["normal_spo2_min"] = NORMAL_SPO2_MIN;
    
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response); });

  debug.info("REST API endpoints configured");

  // POST /api/patients - Register new patient
  server.on("/api/patients", HTTP_POST, [this](AsyncWebServerRequest *request)
            {
    if (!request->hasParam("name", true) || !request->hasParam("phone", true)) {
      request->send(400, "application/json", "{\"error\":\"Missing required fields\"}");
      return;
    }
    
    String name = request->getParam("name", true)->value();
    String phone = request->getParam("phone", true)->value();
    String gender = request->hasParam("gender", true) ? request->getParam("gender", true)->value() : "other";
    int age = request->hasParam("age", true) ? request->getParam("age", true)->value().toInt() : 0;
    
    int patientId = patientManager.addPatient(name, phone, gender, age);
    if (patientId < 0) {
      request->send(500, "application/json", "{\"error\":\"Failed to register patient\"}");
      return;
    }

    debug.log(DEBUG_INFO, "Registration API", String("Patient registered: ") + name + " (ID " + String(patientId) + ")");
    setWorkflowNotice("Registered", name);
    publishEvent("patient_registered", String("Patient registered: ") + name, String("PatientId=") + patientId + ", Name=" + name + ", Phone=" + phone);
    publishEvent("api_patient_registered", String("Registration received from web: ") + name, String("PatientId=") + patientId + ", Name=" + name + ", Phone=" + phone);
    
    JsonDocument doc;
    doc["success"] = true;
    doc["patientId"] = patientId;
    doc["message"] = "Patient registered successfully";
    
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response); });

  // GET /api/patients - List all patients
  server.on("/api/patients", HTTP_GET, [this](AsyncWebServerRequest *request)
            {
    int count = 0;
    Patient* patients = patientManager.listPatients(&count);
    
    JsonDocument doc;
    JsonArray arr = doc["patients"].to<JsonArray>();
    for (int i = 0; i < count; i++) {
      JsonObject p = arr.add<JsonObject>();
      p["id"] = patients[i].id;
      p["name"] = patients[i].name;
      p["phone"] = patients[i].phone;
      p["gender"] = patients[i].gender;
      p["age"] = patients[i].age;
      p["hemoglobin"] = patients[i].lastHemoglobin;
      p["spo2"] = patients[i].lastSpO2;
    }
    doc["total"] = count;
    
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response); });

  // POST /api/queue - Add patient to queue
  server.on("/api/queue", HTTP_POST, [this](AsyncWebServerRequest *request)
            {
    if (!request->hasParam("patientId", true) && !request->hasParam("patientId")) {
      request->send(400, "application/json", "{\"error\":\"Missing patientId\"}");
      return;
    }
    
    String patientId = request->hasParam("patientId", true)
      ? request->getParam("patientId", true)->value()
      : request->getParam("patientId")->value();
    int result = patientManager.addToQueue(patientId);
    
    if (result < 0) {
      request->send(500, "application/json", "{\"error\":\"Failed to add to queue\"}");
      return;
    }
    
    // Get patient details for notification
    Patient *p = patientManager.getPatient(patientId);
    String patientName = p ? p->name : "Unknown";
    
    debug.header("=== PATIENT QUEUED ===");
    debug.log(DEBUG_INFO, "Patient Name", patientName);
    debug.log(DEBUG_INFO, "Patient ID", patientId);
    debug.log(DEBUG_INFO, "Queue Position", result + 1);
    debug.footer();
    setWorkflowNotice("Queued", patientName);
    publishEvent("patient_queued", String("Patient queued: ") + patientName, String("PatientId=") + patientId + ", QueuePosition=" + String(result + 1));
    publishEvent("api_patient_queued", String("Queue updated: ") + patientName, String("PatientId=") + patientId + ", QueuePosition=" + String(result + 1));
    
    JsonDocument doc;
    doc["success"] = true;
    doc["position"] = result + 1;
    doc["message"] = "Added to queue";
    doc["patientName"] = patientName;

    // Automatically call first queued patient if no diagnosis is active.
    if (!canMeasure()) {
      if (startDiagnosis()) {
        debug.header("=== DIAGNOSIS STARTED ===");
        debug.log(DEBUG_INFO, "Calling Patient", activePatientName);
        debug.info("Patient should place finger on sensor now");
        debug.footer();
        publishEvent("diagnosis_started", String("Call patient: ") + activePatientName, String("PatientId=") + activePatientId);
      } else {
        debug.warn("Queue updated but failed to start diagnosis session");
      }
    }
    
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response); });

  // GET /api/queue - Get queue status
  server.on("/api/queue", HTTP_GET, [this](AsyncWebServerRequest *request)
            {
    int count = 0;
    QueueEntry* queue = patientManager.getQueue(&count);
    
    JsonDocument doc;
    JsonArray arr = doc["queue"].to<JsonArray>();
    for (int i = 0; i < count; i++) {
      JsonObject q = arr.add<JsonObject>();
      q["patientId"] = queue[i].patientId;
      q["patientName"] = queue[i].patientName;
      q["position"] = queue[i].position;
    }
    doc["total"] = count;
    doc["nextPatient"] = count > 0 ? queue[0].patientName : "";
    
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response); });

  // POST /api/queue/call - Call next patient
  server.on("/api/queue/call", HTTP_POST, [this](AsyncWebServerRequest *request)
            {
    bool started = startDiagnosis();
    JsonDocument doc;
    doc["success"] = started;
    if (!started) {
      doc["message"] = "No patients in queue";
    } else {
      doc["patientId"] = activePatientId;
      doc["patientName"] = activePatientName;
      doc["message"] = "Diagnosis started";
    }
    
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response); });

  // DELETE /api/queue - Remove from queue
  server.on("/api/queue", HTTP_DELETE, [this](AsyncWebServerRequest *request)
            {
    if (!request->hasParam("patientId", true) && !request->hasParam("patientId")) {
      request->send(400, "application/json", "{\"error\":\"Missing patientId\"}");
      return;
    }
    
    String patientId = request->hasParam("patientId", true)
      ? request->getParam("patientId", true)->value()
      : request->getParam("patientId")->value();
    bool removed = patientManager.removeFromQueue(patientId);
    if (removed && patientId == activePatientId) {
      diagnosisActive = false;
      activePatientId = "";
      activePatientName = "";
    }
    
    JsonDocument doc;
    doc["success"] = removed;
    doc["message"] = removed ? "Removed from queue" : "Not found in queue";
    
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response); });

  debug.info("Patient/Queue API endpoints configured");

  server.on("/api/diagnosis/start", HTTP_POST, [this](AsyncWebServerRequest *request)
            {
    String patientId = "";
    if (request->hasParam("patientId", true)) {
      patientId = request->getParam("patientId", true)->value();
    } else if (request->hasParam("patientId")) {
      patientId = request->getParam("patientId")->value();
    }

    bool started = startDiagnosis(patientId);
    JsonDocument doc;
    doc["success"] = started;
    doc["activePatientId"] = activePatientId;
    doc["activePatientName"] = activePatientName;
    doc["message"] = started ? "Place finger for diagnosis" : "No valid queued patient";

    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response); });

  server.on("/api/diagnosis/complete", HTTP_POST, [this](AsyncWebServerRequest *request)
            {
    bool completed = completeDiagnosis(true);
    JsonDocument doc;
    doc["success"] = completed;
    doc["message"] = completed ? "Diagnosis completed" : "No active diagnosis";

    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response); });
}

bool WebServerModule::startDiagnosis(const String &patientId)
{
  String candidateId = patientId;
  if (candidateId.length() == 0)
  {
    QueueEntry *next = patientManager.callNext();
    if (!next)
    {
      debug.warn("startDiagnosis requested with empty queue");
      return false;
    }
    candidateId = next->patientId;
  }

  Patient *p = patientManager.getPatient(candidateId);
  if (!p)
  {
    debug.log(DEBUG_WARN, "startDiagnosis invalid patientId", candidateId);
    return false;
  }

  int queueCount = 0;
  QueueEntry *queue = patientManager.getQueue(&queueCount);
  bool isQueued = false;
  for (int i = 0; i < queueCount; i++)
  {
    if (queue[i].patientId == candidateId)
    {
      isQueued = true;
      break;
    }
  }
  if (!isQueued)
  {
    debug.log(DEBUG_WARN, "startDiagnosis patient not queued", candidateId);
    return false;
  }

  activePatientId = p->id;
  activePatientName = p->name;
  diagnosisStartedAt = millis();
  diagnosisActive = true;
  patientJustCalled = true; // Signal main loop
  measurementEngine->reset();

  debug.header("=== CALL PATIENT FOR DIAGNOSIS ===");
  debug.log(DEBUG_INFO, "Patient Name", activePatientName);
  debug.log(DEBUG_INFO, "Patient ID", activePatientId);
  debug.info("*** CALL PATIENT TO PLACE FINGER ON SENSOR ***");
  debug.log(DEBUG_INFO, "Time", String(millis() / 1000) + "s");
  debug.footer();
  publishEvent("diagnosis_started", String("Call patient: ") + activePatientName, String("PatientId=") + activePatientId);
  setWorkflowNotice("Call Patient", activePatientName);

  return true;
}

bool WebServerModule::completeDiagnosis(bool autoStartNext)
{
  if (!canMeasure())
  {
    return false;
  }

  const Measurement &m = measurementEngine->getMeasurement();
  String completedPatient = activePatientName;
  String completedId = activePatientId;

  debug.header("=== DIAGNOSIS COMPLETED ===");
  debug.log(DEBUG_INFO, "Patient Name", completedPatient);
  debug.log(DEBUG_INFO, "Patient ID", completedId);

  if (m.isValid)
  {
    patientManager.updateMeasurement(activePatientId, m.hemoglobin, m.spo2, m.heartRate);
    debug.log(DEBUG_INFO, "Heart Rate (BPM)", m.heartRate);
    debug.log(DEBUG_INFO, "SpO2 (%)", (int)m.spo2);
    debug.log(DEBUG_INFO, "Hemoglobin (g/dL)", m.hemoglobin);
    debug.log(DEBUG_INFO, "Status", m.status);
    debug.log(DEBUG_INFO, "IR Value", (int)m.irValue);
    debug.log(DEBUG_INFO, "Red Value", (int)m.redValue);
    publishEvent("measurement_complete", String("Results saved for ") + completedPatient, String("HR=") + m.heartRate + ", SpO2=" + String(m.spo2, 1) + ", Hb=" + String(m.hemoglobin, 1) + ", Status=" + m.status);
  }

  patientManager.removeFromQueue(activePatientId);

  diagnosisActive = false;
  activePatientId = "";
  activePatientName = "";
  diagnosisStartedAt = 0;
  measurementEngine->reset();

  if (autoStartNext)
  {
    if (startDiagnosis())
    {
      debug.info("Next patient has been called automatically");
      setWorkflowNotice("Next Patient", activePatientName);
      publishEvent("next_patient_called", String("Auto-called: ") + activePatientName, String("PatientId=") + activePatientId);
    }
    else
    {
      debug.info("Queue is now empty");
      setWorkflowNotice("Queue", "Empty");
      publishEvent("queue_empty", "Queue is now empty", "No active patient remains");
    }
  }

  publishEvent("diagnosis_completed", String("Diagnosis completed for ") + completedPatient, String("PatientId=") + completedId);
  debug.footer();
  return true;
}

String WebServerModule::getNextQueuedPatientName()
{
  int count = 0;
  QueueEntry *queue = patientManager.getQueue(&count);
  if (count <= 0)
  {
    return "";
  }
  return queue[0].patientName;
}

void WebServerModule::setupWebDashboard()
{
  // Serve static files from SPIFFS
  server.serveStatic("/", SPIFFS, "/").setDefaultFile("index.html");
  server.addHandler(&events);

  // Fallback to index.html for SPA routing
  server.onNotFound([](AsyncWebServerRequest *request)
                    {
    if (request->method() == HTTP_GET) {
      File file = SPIFFS.open("/index.html", "r");
      if (file) {
        request->send(file, String("/index.html"), String("text/html"));
      } else {
        request->send(404, "text/plain", "Not Found");
      }
    } else {
      request->send(405, "text/plain", "Method Not Allowed");
    } });

  debug.info("Web dashboard configured");
}
