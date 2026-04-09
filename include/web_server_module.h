#ifndef WEB_SERVER_MODULE_H
#define WEB_SERVER_MODULE_H

#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include "measurement_engine.h"
#include "config.h"

#define MAX_PATIENTS 100
#define MAX_QUEUE_SIZE 50

struct Patient
{
  String id;
  int numericId;
  String name;
  String phone;
  String gender;
  int age;
  unsigned long registeredAt;
  float lastHemoglobin;
  float lastSpO2;
  int heartRate;
};

struct QueueEntry
{
  String patientId;
  String patientName;
  unsigned long queuedAt;
  int position;
};

struct HistoryEntry
{
  uint32_t entryId;
  String patientId;
  String patientName;
  String gender;
  int age;
  int heartRate;
  float spO2;
  float hemoglobin;
  String status;
  unsigned long recordedAt;
};

class PatientManager
{
private:
  Patient patients[MAX_PATIENTS];
  int patientCount = 0;
  QueueEntry queue[MAX_QUEUE_SIZE];
  int queueCount = 0;
  int nextPatientId = 1;

public:
  int addPatient(const String &name, const String &phone, const String &gender, int age);
  Patient *getPatient(const String &id);
  int getPatientCount() { return patientCount; }
  Patient *listPatients(int *count);
  const Patient *listPatients(int *count) const;

  int addToQueue(const String &patientId);
  QueueEntry *getQueue(int *count);
  int getQueueCount() { return queueCount; }
  QueueEntry *callNext();
  bool removeFromQueue(const String &patientId);
  bool updateMeasurement(const String &patientId, float hb, float spo2, int hr);
};

class WebServerModule
{
private:
  AsyncWebServer server;
  AsyncEventSource events{"/events"};
  MeasurementEngine *measurementEngine = nullptr;
  PatientManager patientManager;
  HistoryEntry history[MEASUREMENT_HISTORY_SIZE];
  int historyCount = 0;
  uint32_t nextHistoryId = 1;
  bool running = false;
  bool wifiRequired = false;
  String activePatientId = "";
  String activePatientName = "";
  unsigned long diagnosisStartedAt = 0;
  bool diagnosisActive = false;
  bool patientJustCalled = false; // Flag to signal main loop of new patient
  bool workflowNoticePending = false;
  String workflowNoticeLine1 = "";
  String workflowNoticeLine2 = "";

  // State for dashboard propagation
  bool lastFingerState = false;
  bool measurementInProgress = false;
  int lastHeartRate = 0;
  float lastSpO2 = 0.0;
  float lastHemoglobin = 0.0;
  String lastStatus = "INITIALIZING";

public:
  WebServerModule();

  // Initialize web server (optional WiFi requirement)
  bool begin(MeasurementEngine *engine, bool requireWiFi = true);

  // Start web server
  void start();

  // Stop web server
  void stop();

  // Check if running
  bool isRunning() { return running; }

  // Get patient manager
  PatientManager *getPatientManager() { return &patientManager; }

  // Setup REST API endpoints
  void setupRestAPI();

  // Setup web dashboard
  void setupWebDashboard();

  // Persistent history helpers
  void loadHistory();
  bool saveHistory();
  void appendHistoryRecord(const String &patientId, const String &patientName, const String &gender, int age, const Measurement &measurement);
  void appendHistoryRecord(const Patient *patient, const Measurement &measurement);
  void writeHistoryResponse(JsonDocument &doc, int limit) const;

  // Broadcast workflow events to serial monitor and browser clients
  void publishEvent(const String &eventType, const String &message, const String &details = "");

  // Workflow helpers
  bool canMeasure() const { return diagnosisActive && activePatientId.length() > 0; }
  const String &getActivePatientId() const { return activePatientId; }
  const String &getActivePatientName() const { return activePatientName; }
  bool checkPatientJustCalled()
  {
    bool val = patientJustCalled;
    patientJustCalled = false;
    return val;
  }
  void setWorkflowNotice(const String &line1, const String &line2 = "")
  {
    workflowNoticeLine1 = line1;
    workflowNoticeLine2 = line2;
    workflowNoticePending = true;
  }
  bool consumeWorkflowNotice(String &line1, String &line2)
  {
    if (!workflowNoticePending)
    {
      return false;
    }
    line1 = workflowNoticeLine1;
    line2 = workflowNoticeLine2;
    workflowNoticePending = false;
    return true;
  }
  bool startDiagnosis(const String &patientId = "");
  bool completeDiagnosis(bool autoStartNext = true);
  String getNextQueuedPatientName();

  // State propagation for dashboard
  void updateMeasurementState(bool fingerDetected, bool inProgress, int hr, float spo2, float hb, const String &status)
  {
    lastFingerState = fingerDetected;
    measurementInProgress = inProgress;
    lastHeartRate = hr;
    lastSpO2 = spo2;
    lastHemoglobin = hb;
    lastStatus = status;
  }

  bool getFingerDetected() const { return lastFingerState; }
  bool getMeasurementInProgress() const { return measurementInProgress; }
  int getLastHeartRate() const { return lastHeartRate; }
  float getLastSpO2() const { return lastSpO2; }
  float getLastHemoglobin() const { return lastHemoglobin; }
  const String &getLastStatus() const { return lastStatus; }
};

#endif // WEB_SERVER_MODULE_H
