#ifndef SENSOR_MODULE_H
#define SENSOR_MODULE_H

#include <Arduino.h>
#include <MAX30105.h>
#include "config.h"

class SensorModule {
private:
  MAX30105 sensor;
  bool initialized = false;
  unsigned long lastReadTime = 0;
  
public:
  SensorModule();
  
  // Initialize sensor
  bool begin();
  
  // Read sensor values
  bool readSensor(long& irValue, long& redValue);
  
  // Configure sensor settings
  void configure();
  
  // Check if sensor is initialized
  bool isInitialized() { return initialized; }
  
  // Get raw sensor object for advanced operations
  MAX30105* getSensor() { return &sensor; }
};

#endif  // SENSOR_MODULE_H
