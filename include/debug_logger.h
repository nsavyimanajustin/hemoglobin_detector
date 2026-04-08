#ifndef DEBUG_LOGGER_H
#define DEBUG_LOGGER_H

#include <Arduino.h>
#include "config.h"

// Debug levels
#define DEBUG_ERROR 0
#define DEBUG_WARN 1
#define DEBUG_INFO 2
#define DEBUG_VERBOSE 3

class DebugLogger {
private:
  int debugLevel = DEBUG_INFO;
  
public:
  DebugLogger();
  
  // Initialize serial communication
  void begin(unsigned long baudRate = DEBUG_BAUD_RATE);
  
  // Log with level
  void log(int level, const char* message);
  void log(int level, const char* prefix, const String& message);
  void log(int level, const char* prefix, int value);
  void log(int level, const char* prefix, float value, int decimals = 2);
  
  // Convenience methods
  void error(const char* message);
  void warn(const char* message);
  void info(const char* message);
  void verbose(const char* message);
  
  // Section headers
  void header(const char* section);
  void footer();
  
  // Set debug level
  void setLevel(int level) { debugLevel = level; }
  
private:
  const char* getLevelStr(int level);
};

// Global debug logger instance
extern DebugLogger debug;

#endif  // DEBUG_LOGGER_H
