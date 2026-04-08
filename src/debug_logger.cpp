#include "debug_logger.h"

DebugLogger debug;

DebugLogger::DebugLogger()
{
  // Constructor
}

void DebugLogger::begin(unsigned long baudRate)
{
  Serial.begin(baudRate);
  delay(500); // Wait for serial to initialize

  // Print boot messages
  Serial.println("\n\n\n");
  Serial.println("========================================");
  Serial.println("  ESP32 BOOTING...");
  Serial.println("========================================");
  Serial.flush();

  delay(1000); // Wait for monitor to attach

  header("HEMOGLOBIN & ANEMIA DETECTION SYSTEM");
  info("Debug Logger initialized");
  Serial.flush();
}

const char *DebugLogger::getLevelStr(int level)
{
  switch (level)
  {
  case DEBUG_ERROR:
    return "ERROR";
  case DEBUG_WARN:
    return "WARN";
  case DEBUG_INFO:
    return "INFO";
  case DEBUG_VERBOSE:
    return "VERBOSE";
  default:
    return "UNKNOWN";
  }
}

void DebugLogger::log(int level, const char *message)
{
  if (level > debugLevel)
    return;

  Serial.print("[");
  Serial.print(getLevelStr(level));
  Serial.print("] ");
  Serial.println(message);
  Serial.flush(); // Force output
}

void DebugLogger::log(int level, const char *prefix, const String &message)
{
  if (level > debugLevel)
    return;

  Serial.print("[");
  Serial.print(getLevelStr(level));
  Serial.print("] ");
  Serial.print(prefix);
  Serial.print(": ");
  Serial.println(message);
  Serial.flush();
}

void DebugLogger::log(int level, const char *prefix, int value)
{
  if (level > debugLevel)
    return;

  Serial.print("[");
  Serial.print(getLevelStr(level));
  Serial.print("] ");
  Serial.print(prefix);
  Serial.print(": ");
  Serial.println(value);
  Serial.flush();
}

void DebugLogger::log(int level, const char *prefix, float value, int decimals)
{
  if (level > debugLevel)
    return;

  Serial.print("[");
  Serial.print(getLevelStr(level));
  Serial.print("] ");
  Serial.print(prefix);
  Serial.print(": ");
  Serial.println(value, decimals);
  Serial.flush();
}

void DebugLogger::error(const char *message)
{
  log(DEBUG_ERROR, message);
}

void DebugLogger::warn(const char *message)
{
  log(DEBUG_WARN, message);
}

void DebugLogger::info(const char *message)
{
  log(DEBUG_INFO, message);
}

void DebugLogger::verbose(const char *message)
{
  log(DEBUG_VERBOSE, message);
}

void DebugLogger::header(const char *section)
{
  Serial.println("\n");
  Serial.println("=====================================");
  Serial.print("  ");
  Serial.println(section);
  Serial.println("=====================================");
  Serial.flush();
}

void DebugLogger::footer()
{
  Serial.println("=====================================\n");
  Serial.flush();
}
