#include "lcd_display.h"
#include "debug_logger.h"

LCDDisplay::LCDDisplay() : lcd(LCD_ADDRESS, LCD_COLS, LCD_ROWS)
{
  // Constructor
}

bool LCDDisplay::begin()
{
  debug.info("Initializing LCD display...");

  lcd.init();
  lcd.backlight();
  lcd.clear();

  debug.info("LCD initialized successfully");
  return true;
}

void LCDDisplay::showStarting()
{
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Hemoglobin Sys");
  lcd.setCursor(0, 1);
  lcd.print("Detector v1.0");
  lcd.setCursor(0, 2);
  lcd.print("Initializing...");
}

void LCDDisplay::showInitializing(const char *component)
{
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Initializing...");
  lcd.setCursor(0, 1);
  lcd.print(component);
  lcd.setCursor(0, 2);
  lcd.print("Please wait");
}

void LCDDisplay::showReady()
{
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("System Ready!");
  lcd.setCursor(0, 1);
  lcd.print("Queue patient via");
  lcd.setCursor(0, 2);
  lcd.print("web dashboard");
}

void LCDDisplay::showMeasuring()
{
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Diagnosis Active");
  lcd.setCursor(0, 1);
  lcd.print("Measuring...");
  lcd.setCursor(0, 2);
  lcd.print("Keep finger still");
}

void LCDDisplay::showWiFiSetup()
{
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Setup Mode");
  lcd.setCursor(0, 1);
  lcd.print("Connect to AP");
}

void LCDDisplay::showWiFiConnecting()
{
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connect...");
  lcd.setCursor(0, 1);
  lcd.print("Waiting...");
}

void LCDDisplay::showWiFiConnected()
{
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connected!");
  lcd.setCursor(0, 1);
  lcd.print("Server started");
}

void LCDDisplay::showCallPatient(const char *patientName)
{
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Call Patient:");
  lcd.setCursor(0, 1);
  lcd.print(patientName);
  lcd.setCursor(0, 2);
  lcd.print("Place finger now");
}

void LCDDisplay::showNotification(const char *line1, const char *line2)
{
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Workflow Update");
  lcd.setCursor(0, 1);
  lcd.print(line1);
  if (line2 && strlen(line2) > 0)
  {
    lcd.setCursor(0, 2);
    lcd.print(line2);
  }
}

void LCDDisplay::showError(const char *error1, const char *error2)
{
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(error1);
  if (error2 && strlen(error2) > 0)
  {
    lcd.setCursor(0, 1);
    lcd.print(error2);
  }
}

void LCDDisplay::showMeasurements(int hr, float spo2, float hemoglobin, const char *status)
{
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Diagnosis Result");
  lcd.setCursor(0, 1);
  lcd.print("HR:");
  lcd.print(hr);
  lcd.print(" SpO2:");
  lcd.print((int)spo2);
  lcd.print("%");
  lcd.setCursor(0, 2);
  lcd.print("Hb:");
  lcd.print(hemoglobin, 1);
  lcd.print(" g/dL");
  lcd.setCursor(0, 3);
  lcd.print("Status:");
  lcd.print(status);
}

void LCDDisplay::showStatus(const char *message)
{
  lcd.setCursor(0, 1);
  lcd.print("                "); // Clear line
  lcd.setCursor(0, 1);
  lcd.print(message);
}

void LCDDisplay::clear()
{
  lcd.clear();
}
