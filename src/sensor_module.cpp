#include "sensor_module.h"
#include "debug_logger.h"

SensorModule::SensorModule() {
  // Constructor
}

bool SensorModule::begin() {
  debug.info("Initializing MAX30102 sensor...");
  
  if (!sensor.begin(Wire, I2C_SPEED_FAST)) {
    debug.error("MAX30102 not found. Check wiring/power.");
    return false;
  }
  
  debug.info("MAX30102 initialized successfully");
  configure();
  initialized = true;
  return true;
}

void SensorModule::configure() {
  debug.verbose("Configuring MAX30102...");
  
  // Configure sensor
  sensor.setup();
  sensor.setPulseAmplitudeRed(0x0A);     // Red LED to low
  sensor.setPulseAmplitudeGreen(0);      // Turn off Green LED
  sensor.setPulseAmplitudeIR(0x33);      // IR LED
  
  debug.verbose("MAX30102 configuration complete");
}

bool SensorModule::readSensor(long& irValue, long& redValue) {
  if (!initialized) {
    return false;
  }
  
  irValue = sensor.getIR();
  redValue = sensor.getRed();
  lastReadTime = millis();
  
  return true;
}
