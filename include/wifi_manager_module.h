#ifndef WIFI_MANAGER_MODULE_H
#define WIFI_MANAGER_MODULE_H

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include "config.h"

class WiFiManagerModule {
private:
  WiFiManager wm;
  bool connected = false;
  bool configMode = false;
  unsigned long connectionStartTime = 0;
  
public:
  WiFiManagerModule();
  
  // Non-blocking WiFi initialization
  // Returns true if already connected or connection successful
  // Returns false if still connecting or not connected yet
  bool begin(bool forceConfigPortal = false);
  
  // Check if WiFi is connected
  bool isConnected();
  
  // Get local IP address
  String getLocalIP();
  
  // Get signal strength
  int getRSSI();
  
  // Check if in config mode
  bool isConfigMode() { return configMode; }
  
  // Handle WiFi events
  void update();
  
  // Disconnect WiFi
  void disconnect();
};

#endif  // WIFI_MANAGER_MODULE_H
