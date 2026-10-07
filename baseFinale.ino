// CocoSense -- Base Station (gateway)  |  4 piezos, 1 reading/second each
// Board: ESP32 + SX127x LoRa.  Libraries: sandeepmistry/LoRa, ArduinoJson v6
//
// Role: receives ONE LoRa packet per second from each Master Node (it
// carries all 4 piezos), measures the real RSSI itself, splits the
// packet into 4 readings (pin A0..A3 = Piezo 1..4) and POSTs each to
// /api/ingest-vibration -- the endpoint is unchanged.
//
// What's different from the old version:
//   * Packet format: g/e/p/c arrays + "v" severity string (4 piezos).
//     The old single-piezo packet {n,pin,g,...} is still understood.
//   * "pin" is now forwarded. The old build dropped it, so the server
//     filed EVERY reading under A0 (Piezo 1).
//   * HTTPS posting runs in its own task, so a slow request no longer
//     blocks LoRa reception (at 1 packet/s that would lose packets).
//   * One kept-alive HTTPS connection instead of a new TLS handshake
//     per reading.

#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ---- WiFi ----
static const char *WIFI_SSID = "curlie";
static const char *WIFI_PASSWORD = "12345678";

// ---- Server ----
static const char *SERVER_URL = "https://cocosense2026.netlify.app/api/ingest-vibration";
static const char *DEVICE_API_KEY = "Luna-1327"; // must match DEVICE_API_KEY in server/.env

// ---- Radio ----
#define LORA_SCK  18
#define LORA_MISO 19
#define LORA_MOSI 23
#define LORA_NSS  5
#define LORA_RST  14
#define LORA_DIO0 4
#define LORA_FREQ 915E6   // NOTE: the Master Node file uses 433E6 -- these two MUST match
#define LORA_SF   7       // MUST match the Master Node

static const char *PIN_NAMES[4] = {"A0", "A1", "A2", "A3"};

// ---- Outgoing queue (filled by the LoRa loop, drained by postTask) ----
struct OutBody { char json[300]; };
static const int QUEUE_SIZE = 40;      // ~10 s of backlog for 4 piezos
static QueueHandle_t postQueue;

void enqueueBody(const String &body) {
  if (body.length() == 0 || body.length() >= sizeof(OutBody::json)) return;
  OutBody item;
  memcpy(item.json, body.c_str(), body.length() + 1);
  if (xQueueSend(postQueue, &item, 0) != pdTRUE) {
    // Queue full: drop the OLDEST reading -- at 1/s a stale value is
    // worth less than the fresh one.
    OutBody dropped;
    xQueueReceive(postQueue, &dropped, 0);
    xQueueSend(postQueue, &item, 0);
  }
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();
  Serial.println(WiFi.status() == WL_CONNECTED ? "WiFi connected" : "WiFi connect failed -- will retry in background");
}

// Runs on core 0: sends queued readings, reconnects WiFi when needed.
void postTask(void *) {
  WiFiClientSecure client;
  client.setInsecure();               // same as the old begin(url) with no CA set
  HTTPClient http;
  http.setReuse(true);                // keep the TLS connection open between POSTs
  http.setTimeout(8000);

  OutBody item;
  uint8_t failCount = 0;
  uint32_t lastReconnect = 0;

  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      if (millis() - lastReconnect > 10000) {
        lastReconnect = millis();
        Serial.println("  [WiFi] lost -- reconnecting");
        WiFi.disconnect();
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      }
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    if (xQueuePeek(postQueue, &item, pdMS_TO_TICKS(500)) != pdTRUE) continue;

    http.begin(client, SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(String(item.json));
    http.end();

    if (code > 0) {
      // Server answered. Remove it either way so one bad reading can't
      // block the queue; the next fresh reading arrives in 1 s anyway.
      xQueueReceive(postQueue, &item, 0);
      failCount = 0;
      if (code < 200 || code >= 300) Serial.printf("Forward rejected (%d)\n", code);
    } else {
      // Network/connection error: retry a couple of times, then drop.
      Serial.printf("Forward failed (%d)\n", code);
      if (++failCount >= 3) {
        xQueueReceive(postQueue, &item, 0);
        failCount = 0;
      }
      vTaskDelay(pdMS_TO_TICKS(300));
    }
  }
}

// Builds the JSON body server/routes/ingest.js expects, for ONE piezo.
String makeBody(const char *nodeId, const char *sector, const char *pin, float grams,
                int battery, int rssi, const char *severity, int events, bool pest, int clicks) {
  StaticJsonDocument<384> out;
  out["api_key"]  = DEVICE_API_KEY;
  out["node_id"]  = nodeId;
  out["pin"]      = pin;               // A0..A3 -> Piezo 1..4 (was missing before)
  out["sector"]   = sector;
  out["grams"]    = grams;
  out["battery"]  = battery;
  out["rssi"]     = rssi;              // measured here, not self-reported
  out["severity"] = severity;
  out["events"]   = events;
  out["pest_likely"] = pest;
  if (clicks > 0) out["pest_clicks"] = clicks;

  String body;
  serializeJson(out, body);
  return body;
}

void handlePacket(const String &packet, int rssi) {
  StaticJsonDocument<640> in;
  if (deserializeJson(in, packet)) {
    Serial.println("Malformed packet -- dropped");
    return;
  }
  const char *nodeId = in["n"];
  if (!nodeId) {
    Serial.println("Packet has no node id -- dropped");
    return;
  }
  const char *sector = in["s"] | "";
  int battery = in["b"] | 0;

  JsonArray g = in["g"].as<JsonArray>();
  if (!g.isNull()) {
    // New format: all four piezos in one packet.
    JsonArray e = in["e"].as<JsonArray>();
    JsonArray p = in["p"].as<JsonArray>();
    JsonArray c = in["c"].as<JsonArray>();
    const char *v = in["v"] | "";
    size_t vLen = strlen(v);

    size_t n = g.size();
    if (n > 4) n = 4;
    for (size_t i = 0; i < n; i++) {
      char sv[2] = { (i < vLen) ? v[i] : 'N', '\0' };
      enqueueBody(makeBody(nodeId, sector, PIN_NAMES[i], g[i] | 0.0f, battery, rssi,
                           sv, e[i] | 0, (p[i] | 0) != 0, c[i] | 0));
    }
  } else {
    // Old single-piezo packet {n,pin,s,g,b,sv,e,p,c}.
    const char *pin = in["pin"] | "A0";
    const char *sv = in["sv"] | "N";
    enqueueBody(makeBody(nodeId, sector, pin, in["g"] | 0.0f, battery, rssi,
                         sv, in["e"] | 0, (bool)(in["p"] | false), in["c"] | 0));
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);

  connectWiFi();

  postQueue = xQueueCreate(QUEUE_SIZE, sizeof(OutBody));
  xTaskCreatePinnedToCore(postTask, "post", 12288, NULL, 1, NULL, 0);

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa init failed -- check wiring/frequency");
    while (true) delay(1000);
  }
  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.setSignalBandwidth(125E3);

  Serial.println("Base Station ready -- listening for Master Nodes...");
}

static uint32_t lastRssiPrint = 0;

void loop() {
  static uint32_t lastHeapPrint = 0;
  if (millis() - lastHeapPrint > 30000) {
    lastHeapPrint = millis();
    Serial.print("[heap] free bytes: ");
    Serial.println(ESP.getFreeHeap());
  }

  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String packet;
    while (LoRa.available()) packet += (char)LoRa.read();
    int rssi = LoRa.packetRssi();
    Serial.printf("Received (RSSI %d dBm): %s\n", rssi, packet.c_str());
    handlePacket(packet, rssi);
  } else if (millis() - lastRssiPrint > 5000) {
    lastRssiPrint = millis();
    Serial.print("  (idle, ambient RSSI: ");
    Serial.print(LoRa.rssi());
    Serial.println(" dBm)");
  }
}
