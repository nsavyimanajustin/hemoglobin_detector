#include "wifi_manager_module.h"
#include "debug_logger.h"

WiFiManagerModule::WiFiManagerModule()
{
  // Constructor
}

bool WiFiManagerModule::begin(bool forceConfigPortal)
{
  debug.header("WiFi Manager");

  WiFi.mode(WIFI_STA);

  if (!forceConfigPortal)
  {
    debug.log(DEBUG_INFO, "Connecting to hotspot", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - start) < WIFI_TIMEOUT_MS)
    {
      delay(250);
    }

    if (WiFi.status() == WL_CONNECTED)
    {
      connected = true;
      debug.info("WiFi connection successful!");
      debug.log(DEBUG_INFO, "SSID", WiFi.SSID());
      debug.log(DEBUG_INFO, "IP Address", WiFi.localIP().toString());
      debug.log(DEBUG_INFO, "Signal Strength (dBm)", WiFi.RSSI());
      debug.footer();
      return true;
    }

    debug.warn("Direct hotspot connection failed; continuing offline without WiFi config portal");
    connected = false;
    debug.footer();
    return false;
  }

  // Set up WiFiManager callbacks
  wm.setAPCallback([](WiFiManager *myWiFiManager)
                   {
    debug.warn("WiFi config mode started");
    debug.log(DEBUG_INFO, "AP SSID", WIFI_AP_SSID);
    debug.log(DEBUG_INFO, "AP Password", WIFI_AP_PASSWORD); });

  // Set very short timeout to avoid blocking
  wm.setConfigPortalTimeout(15); // 15 seconds only

  debug.log(DEBUG_INFO, "Attempting to connect to WiFi", "");
  connectionStartTime = millis();

  // Non-blocking mode would require custom implementation
  // For now, we'll use autoConnect with timeout
  bool res = wm.autoConnect(WIFI_AP_SSID, WIFI_AP_PASSWORD);

  if (res)
  {
    connected = true;
    debug.info("WiFi connection successful!");
    debug.log(DEBUG_INFO, "SSID", WiFi.SSID());
    debug.log(DEBUG_INFO, "IP Address", WiFi.localIP().toString());
    debug.log(DEBUG_INFO, "Signal Strength (dBm)", WiFi.RSSI());
  }
  else
  {
    connected = false;
    debug.warn("WiFi connection failed - continuing in offline mode");
    debug.warn("Web dashboard will not be accessible over WiFi");
  }

  debug.footer();
  return connected;
}

bool WiFiManagerModule::isConnected()
{
  return WiFi.status() == WL_CONNECTED;
}

String WiFiManagerModule::getLocalIP()
{
  if (isConnected())
  {
    return WiFi.localIP().toString();
  }
  return "NOT_CONNECTED";
}

int WiFiManagerModule::getRSSI()
{
  if (isConnected())
  {
    return WiFi.RSSI();
  }
  return 0;
}

void WiFiManagerModule::update()
{
  // Check WiFi status
  if (WiFi.status() == WL_CONNECTED && !connected)
  {
    connected = true;
    debug.info("WiFi reconnected!");
  }
  else if (WiFi.status() != WL_CONNECTED && connected)
  {
    connected = false;
    debug.warn("WiFi disconnected!");
  }
}

void WiFiManagerModule::disconnect()
{
  WiFi.disconnect(true); // true = turn off radio
  connected = false;
  debug.info("WiFi disconnected");
}
