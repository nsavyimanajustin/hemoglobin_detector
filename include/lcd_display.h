#ifndef LCD_DISPLAY_H
#define LCD_DISPLAY_H

#include <Arduino.h>
#include <LiquidCrystal_I2C.h>
#include "config.h"

class LCDDisplay
{
private:
  LiquidCrystal_I2C lcd;
  int currentFormat = DISPLAY_FORMAT;
  unsigned long lastUpdateTime = 0;

public:
  LCDDisplay();

  // Initialize LCD
  bool begin();

  // Display status messages
  void showStarting();
  void showInitializing(const char *component);
  void showReady();
  void showMeasuring();
  void showWiFiSetup();
  void showWiFiConnecting();
  void showWiFiConnected();
  void showCallPatient(const char *patientName);
  void showNotification(const char *line1, const char *line2 = "");
  void showError(const char *error1, const char *error2 = "");

  // Display measurement results
  void showMeasurements(int hr, float spo2, float hemoglobin, const char *status);

  // Display status line
  void showStatus(const char *message);

  // Clear display
  void clear();

  // Get LCD object for direct operations
  LiquidCrystal_I2C *getDisplay() { return &lcd; }
};

#endif // LCD_DISPLAY_H
