#include "measurement_engine.h"
#include "debug_logger.h"
#include <math.h>

MeasurementEngine::MeasurementEngine() {
  reset();
}

void MeasurementEngine::addReading(long irValue, long redValue) {
  // Check if finger is on sensor
  if (irValue > 50000) {
    if (!fingerOn) {
      fingerOn = true;
      debug.info("Finger detected");
    }
  } else {
    if (fingerOn) {
      fingerOn = false;
      debug.info("Finger removed");
      reset();
    }
    return;  // Don't add readings if finger is off
  }
  
  // Store readings if we haven't reached buffer size yet
  if (i < MAX_BUFFER_SIZE) {
    irBuffer[i] = irValue;
    redBuffer[i] = redValue;
    i++;
    
    // Calculate moving average
    avered = 0;
    aveir = 0;
    for (int k = 0; k < i; k++) {
      avered += redBuffer[k];
      aveir += irBuffer[k];
    }
    avered /= i;
    aveir /= i;
  }
  
  // When we have 100 samples, calculate SpO2
  if (i >= MAX_BUFFER_SIZE && !hasCalculated) {
    calculateHeartRate();
    calculateSpO2();
    estimateHemoglobin();
    determineAnemiaStatus();
    hasCalculated = true;
    
    // Update measurement
    lastMeasurement.irValue = irValue;
    lastMeasurement.redValue = redValue;
    lastMeasurement.heartRate = beatAvg;
    lastMeasurement.spo2 = ESpO2;
    lastMeasurement.hemoglobin = estimatedHemoglobin;
    lastMeasurement.status = anemiaStatus;
    lastMeasurement.timestamp = millis();
    lastMeasurement.isValid = true;
  }
  
  // Update measurement values continuously
  if (hasCalculated) {
    lastMeasurement.irValue = irValue;
    lastMeasurement.redValue = redValue;
    lastMeasurement.timestamp = millis();
  }
}

bool MeasurementEngine::checkFingerOnSensor(long irValue) {
  return irValue > 50000;
}

void MeasurementEngine::calculateHeartRate() {
  // Detect peaks in the IR signal
  int peak = 0;
  int trough = 0;
  int peakCount = 0;
  int i = 100;
  
  for (int k = 2; k < 100; k++) {
    if (irBuffer[k] > irBuffer[k - 1] && irBuffer[k] > irBuffer[k + 1]) {
      if (irBuffer[k] > irBuffer[peak]) {
        peak = k;
      }
    }
  }
  
  // Simple beat detection: assume 4 beats in 100 samples at ~25Hz sampling rate
  beatAvg = (int)(60.0 * 25.0 / (100.0 / 4.0));
  if (beatAvg > 220) beatAvg = 0;  // Filter out invalid values
}

void MeasurementEngine::calculateSpO2() {
  // SpO2 calculation using accumulated averages
  double ratio = (avered / aveir) / (double)i * sqrt((double)i);
  if (ratio > 0) {
    // Empirical formula
    ESpO2 = 110.0 - 25.0 * ratio;
  } else {
    ESpO2 = 0;
  }
  
  // Clamp values to reasonable range
  if (ESpO2 > 100.0) ESpO2 = 100.0;
  if (ESpO2 < 70.0) ESpO2 = 70.0;
  
  debug.log(DEBUG_VERBOSE, "SpO2 calculated", ESpO2);
}

void MeasurementEngine::estimateHemoglobin() {
  // Hemoglobin estimation based on SpO2 and empirical data
  // This is a simplified model
  
  if (ESpO2 >= 95.0) {
    // Normal oxygen saturation: Hb typically 13-16 g/dL
    estimatedHemoglobin = 14.0 + ((ESpO2 - 95.0) / 5.0) * 2.0;
  } else if (ESpO2 >= 90.0) {
    // Mild hypoxia: Hb typically 12-14 g/dL
    estimatedHemoglobin = 12.5 + ((ESpO2 - 90.0) / 5.0) * 1.5;
  } else if (ESpO2 >= 85.0) {
    // Moderate hypoxia: Hb typically 10-12 g/dL
    estimatedHemoglobin = 10.5 + ((ESpO2 - 85.0) / 5.0) * 1.5;
  } else {
    // Severe hypoxia: Hb typically < 10 g/dL
    estimatedHemoglobin = max(7.0, 10.0 - ((85.0 - ESpO2) / 5.0) * 2.0);
  }
  
  // Clamp to realistic range
  if (estimatedHemoglobin > 18.0) estimatedHemoglobin = 18.0;
  if (estimatedHemoglobin < 5.0) estimatedHemoglobin = 5.0;
  
  debug.log(DEBUG_VERBOSE, "Hemoglobin estimated", estimatedHemoglobin);
}

void MeasurementEngine::determineAnemiaStatus() {
  if (estimatedHemoglobin >= NORMAL_HB_MIN) {
    anemiaStatus = "NORMAL";
  } else if (estimatedHemoglobin >= MILD_ANEMIA_HB_MIN) {
    anemiaStatus = "MILD";
  } else if (estimatedHemoglobin >= MODERATE_ANEMIA_HB_MIN) {
    anemiaStatus = "MODERATE";
  } else {
    anemiaStatus = "SEVERE";
  }
  
  debug.log(DEBUG_VERBOSE, "Status", anemiaStatus);
}

void MeasurementEngine::reset() {
  i = 0;
  avered = 0;
  aveir = 0;
  beatAvg = 0;
  ESpO2 = 0;
  estimatedHemoglobin = 0;
  anemiaStatus = "INITIALIZING";
  hasCalculated = false;
  fingerOn = false;
  rateSpot = 0;
  
  for (int k = 0; k < MAX_BUFFER_SIZE; k++) {
    irBuffer[k] = 0;
    redBuffer[k] = 0;
    beatTimes[k] = 0;
  }
  
  for (int k = 0; k < 10; k++) {
    rates[k] = 0;
  }
  
  lastMeasurement.isValid = false;
}
