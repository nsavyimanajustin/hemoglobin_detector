#ifndef MEASUREMENT_ENGINE_H
#define MEASUREMENT_ENGINE_H

#include <Arduino.h>
#include "config.h"

// Measurement state structure
struct Measurement {
  int heartRate = 0;
  float spo2 = 0.0;
  float hemoglobin = 0.0;
  String status = "INITIALIZING";
  long irValue = 0;
  long redValue = 0;
  unsigned long timestamp = 0;
  bool isValid = false;
};

class MeasurementEngine {
private:
  // Buffers for calculation
  long irBuffer[MAX_BUFFER_SIZE];
  long redBuffer[MAX_BUFFER_SIZE];
  int beatTimes[MAX_BUFFER_SIZE];
  int i = 0;
  
  // Accumulated values
  double avered = 0;
  double aveir = 0;
  
  // Results
  int beatAvg = 0;
  float ESpO2 = 0;
  float estimatedHemoglobin = 0;
  String anemiaStatus = "INITIALIZING";
  
  // State flags
  bool fingerOn = false;
  bool hasCalculated = false;
  int rates[10];
  int rateSpot = 0;
  
  // Last measurement
  Measurement lastMeasurement;
  
public:
  MeasurementEngine();
  
  // Add sensor reading to buffer
  void addReading(long irValue, long redValue);
  
  // Check if finger is on sensor (based on IR value)
  bool checkFingerOnSensor(long irValue);
  
  // Calculate SpO2 from accumulated data
  void calculateSpO2();
  
  // Estimate hemoglobin from SpO2
  void estimateHemoglobin();
  
  // Determine anemia status
  void determineAnemiaStatus();
  
  // Get current measurement
  const Measurement& getMeasurement() { return lastMeasurement; }
  
  // Reset buffers on finger removal
  void reset();
  
  // Check if ready to calculate (100 samples collected)
  bool isReadyToCalculate() { return i >= MAX_BUFFER_SIZE; }
  
  // Is finger detected on sensor
  bool isFingerDetected() { return fingerOn; }
  
private:
  void calculateHeartRate();
};

#endif  // MEASUREMENT_ENGINE_H
