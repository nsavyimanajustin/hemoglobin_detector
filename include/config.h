#ifndef CONFIG_H
#define CONFIG_H

// ==================== I2C CONFIGURATION ====================
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22
#define I2C_SPEED_FAST 400000

// ==================== SENSOR CONFIGURATION ====================
#define MAX_BUFFER_SIZE 100
#define SENSOR_UPDATE_INTERVAL 100 // ms between sensor reads

// ==================== LCD CONFIGURATION ====================
#define LCD_ADDRESS 0x27
#define LCD_COLS 16
#define LCD_ROWS 4
#define DISPLAY_FORMAT 1 // 1 = compact (all metrics), 2 = alternating

// ==================== MEASUREMENT THRESHOLDS ====================
// SpO2 thresholds
#define NORMAL_SPO2_MIN 95.0
#define MILD_SPO2_MIN 90.0
#define MODERATE_SPO2_MIN 85.0

// Hemoglobin thresholds (g/dL)
#define NORMAL_HB_MIN 12.0         // Women: 12.0-16.0, Men: 13.5-17.5
#define MILD_ANEMIA_HB_MIN 10.0    // 10.0-11.9
#define MODERATE_ANEMIA_HB_MIN 7.0 // 7.0-9.9

// ==================== WIFI CONFIGURATION ====================
#define WIFI_TIMEOUT_MS 15000 // 15 second timeout for WiFi connection attempt
#define WIFI_SSID "Dikroucha"
#define WIFI_PASSWORD "ffaffaffa"
#define WIFI_AP_SSID "Hemoglobin_Detector"
#define WIFI_AP_PASSWORD "password"
// ==================== WEB SERVER CONFIGURATION ====================
#define WEB_SERVER_PORT 80
#define MEASUREMENT_HISTORY_SIZE 60

// ==================== DEBUG CONFIGURATION ====================
#define DEBUG_ENABLED 1
#define DEBUG_BAUD_RATE 115200

#endif // CONFIG_H
