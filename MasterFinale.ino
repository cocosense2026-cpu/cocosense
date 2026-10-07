/*
  Cocosense MASTER NODE -- 4 piezo sensors, reports every 1 SECOND
  (was: 2 piezos, one report every 30 s)

  Two ADS1115 chips, each on its own I2C bus, each carrying TWO piezos:

    Piezo 1 (A0) -> ADS1115 #1 channel A0  AND  ESP32 GPIO34
    Piezo 2 (A1) -> ADS1115 #2 channel A1  AND  ESP32 GPIO32
    Piezo 3 (A2) -> ADS1115 #1 channel A2  AND  ESP32 GPIO36 (VP)   <-- NEW
    Piezo 4 (A3) -> ADS1115 #2 channel A3  AND  ESP32 GPIO39 (VN)   <-- NEW
      each piezo:  S -> the two inputs above,  + -> 3.3V,  - -> GND

    ADS1115 #1: SDA -> GPIO16, SCL -> GPIO17, VDD 3.3V, GND
    ADS1115 #2: SDA -> GPIO21, SCL -> GPIO22, VDD 3.3V, GND
    Buzzer (ACTIVE): + -> GPIO27, - -> GND
    Battery divider -> GPIO35

  ONE LoRa packet per second carries all four piezos. (Four separate
  packets per second cannot fit in the air time at this data rate.)
  The Base Station splits it back into 4 readings (pin A0..A3).

  Libraries: Adafruit_ADS1X15, arduinoFFT (v2.x, kosme), LoRa
  (sandeepmistry), ArduinoJson v6
*/

#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <SPI.h>
#include <LoRa.h>
#include <ArduinoJson.h>
#include <arduinoFFT.h>

TwoWire I2C_1 = TwoWire(0);
TwoWire I2C_2 = TwoWire(1);
Adafruit_ADS1115 ads1;
Adafruit_ADS1115 ads2;

// --- LoRa radio ---
#define LORA_SCK  18
#define LORA_MISO 19
#define LORA_MOSI 23
#define LORA_NSS  5
#define LORA_RST  14
#define LORA_DIO0 4
#define LORA_FREQ 433E6   // must match the Base Station
#define LORA_SF   7       // MUST match the Base Station. SF7 keeps a
                          // 4-piezo packet at ~0.2 s of air time so a
                          // 1 s report rate is possible (SF9 = ~0.7 s).
                          // Range is shorter than SF9 -- see notes.

// --- Buzzer ---
#define BUZZER_PIN 27
const unsigned long ALARM_DURATION_MS = 5000UL;
#define TX_CHIRP 0        // 1 = short chirp on every transmit (annoying at 1/s)

// Real registered Master Node ID from the dashboard. All 4 piezos share it;
// the packet's per-piezo position (A0..A3) tells the backend which one.
const char* NODE_ID = "MN-STOCK-0001";
const char* SECTOR  = "Sector 1";

// --- Piezo table: index 0..3 = Piezo 1..4 = pins A0..A3 ---
const uint8_t NUM_PIEZOS = 4;
Adafruit_ADS1115* const ADS_FOR[NUM_PIEZOS]      = { &ads1, &ads2, &ads1, &ads2 };
const uint8_t           ADS_CHANNEL[NUM_PIEZOS]  = { 0, 1, 2, 3 };
const uint8_t           FFT_PIN[NUM_PIEZOS]      = { 34, 32, 36, 39 };

struct PeakResult {
  int16_t peak;
  int aboveThresholdSamples;
};

// --- Battery ---
#define BATTERY_PIN 35
#define DIVIDER_RATIO 2.0f
float readBatteryVoltage() {
  int raw = analogRead(BATTERY_PIN);
  return (raw / 4095.0f) * 3.3f * DIVIDER_RATIO;
}
uint8_t readBatteryPercent() {
  float pct = (readBatteryVoltage() - 3.0f) / (4.2f - 3.0f) * 100.0f;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return (uint8_t)pct;
}

// ============================================================
// PART 1: IMPACT / GRAMS
// ============================================================
// 4 piezos x 100 ms impact window + 4 x 128 ms FFT window ~= 0.9 s,
// so one full pass fits inside the 1 s report interval.
const unsigned long SAMPLE_WINDOW_MS = 100;   // was 250 (2 piezos)

const int16_t NOISE_FLOOR_ADDITIVE_MARGIN = 400;
const int MIN_SUSTAINED_SAMPLES = 3;
const float BASELINE_ADAPT_ALPHA = 0.02f;

const float ELEVATED_GRAMS = 2.0f;
const float CRITICAL_GRAMS = 5.0f;

const unsigned long REPORT_INTERVAL_MS = 1000UL;   // was 30000UL
// The buzzer used to need 8 Critical reports x 30 s = 4 minutes of
// sustained Critical. Reports are now 1 s apart, so 240 keeps that
// same 4-minute rule (8 would have made the buzzer fire after 8 s).
const uint16_t CONSEC_CRITICAL_FOR_ALARM = 240;

char classifySeverity(float grams) {
  if (grams >= CRITICAL_GRAMS) return 'C';
  if (grams >= ELEVATED_GRAMS) return 'E';
  return 'N';
}

float voltageToGrams(float voltage) { return voltage * 3.0; }

PeakResult readPeakRawSustained(Adafruit_ADS1115& ads, int16_t noiseFloor, uint8_t channel) {
  PeakResult result = {0, 0};
  int16_t threshold = noiseFloor + NOISE_FLOOR_ADDITIVE_MARGIN;
  unsigned long start = millis();
  while (millis() - start < SAMPLE_WINDOW_MS) {
    int16_t raw = ads.readADC_SingleEnded(channel);
    if (raw > result.peak) result.peak = raw;
    if (raw > threshold) result.aboveThresholdSamples++;
  }
  return result;
}

int16_t calibrateNoiseFloor(Adafruit_ADS1115& ads, uint8_t piezoIdx) {
  Serial.print("Calibrating Piezo ");
  Serial.print(piezoIdx + 1);
  Serial.println(" -- do not touch it for 3 seconds...");
  long sum = 0;
  int count = 0;
  unsigned long start = millis();
  while (millis() - start < 3000) {
    sum += ads.readADC_SingleEnded(ADS_CHANNEL[piezoIdx]);
    count++;
  }
  int16_t baseline = (int16_t)(sum / count);
  Serial.print("  baseline raw=");
  Serial.println(baseline);
  return baseline;
}

// ============================================================
// PART 2: PEST LIKELIHOOD (ESP32 ADC1 + FFT)
// ============================================================
#define SAMPLES          1024
#define SAMPLING_FREQ    8000

#define NOISE_CUTOFF_HZ      200.0
#define PEST_BAND_LOW_HZ     800.0
#define PEST_BAND_HIGH_HZ    2500.0

#define TRACK_WINDOWS         60
#define MIN_CLICKS_IN_TRACK    8
#define TRACK_TIMEOUT_MS    15000
#define BAND_ENERGY_RATIO_MIN 0.25

// ONE shared FFT buffer -- the piezos are analysed one after another,
// so 4 separate 16 KB buffer pairs would waste RAM for nothing.
double vReal[SAMPLES];
double vImag[SAMPLES];
ArduinoFFT<double> FFT = ArduinoFFT<double>(vReal, vImag, SAMPLES, SAMPLING_FREQ);

// --- Per-piezo state ---
int16_t  noiseFloorRaw[NUM_PIEZOS];
float    baselineF[NUM_PIEZOS];
float    intervalPeakGrams[NUM_PIEZOS];
uint16_t intervalEvents[NUM_PIEZOS];
uint16_t consecCritical[NUM_PIEZOS];

uint8_t  clickHistory[NUM_PIEZOS][TRACK_WINDOWS];
uint8_t  clickIndex[NUM_PIEZOS];
uint32_t lastClickMs[NUM_PIEZOS];
double   bandRatio[NUM_PIEZOS];
double   peakFreq[NUM_PIEZOS];

uint32_t lastReportMs = 0;
bool     buzzerActive  = false;
uint32_t buzzerOffAtMs = 0;

void triggerBuzzer() {
  digitalWrite(BUZZER_PIN, HIGH);
  buzzerActive = true;
  buzzerOffAtMs = millis() + ALARM_DURATION_MS;
  Serial.println("!!! ALARM: sustained Critical -- buzzer ON !!!");
}

void serviceBuzzer() {
  if (buzzerActive && millis() >= buzzerOffAtMs) {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerActive = false;
  }
}

void sampleWindowFFT(uint8_t pin) {
  uint32_t periodUs = 1000000UL / SAMPLING_FREQ;
  for (int i = 0; i < SAMPLES; i++) {
    uint32_t t0 = micros();
    vReal[i] = analogRead(pin);
    vImag[i] = 0.0;
    while (micros() - t0 < periodUs) { }
  }
}

void analyzeSpectrum(double& outBandRatio, double& outPeakFreq) {
  FFT.windowing(FFTWindow::Hamming, FFTDirection::Forward);
  FFT.compute(FFTDirection::Forward);
  FFT.complexToMagnitude();

  double totalEnergy = 0.0, bandEnergy = 0.0, peakMag = 0.0, pf = 0.0;
  double binWidth = (double)SAMPLING_FREQ / SAMPLES;

  for (int i = 1; i < SAMPLES / 2; i++) {
    double freq = i * binWidth;
    double mag  = vReal[i];
    if (freq < NOISE_CUTOFF_HZ) continue;
    totalEnergy += mag;
    if (freq >= PEST_BAND_LOW_HZ && freq <= PEST_BAND_HIGH_HZ) {
      bandEnergy += mag;
      if (mag > peakMag) { peakMag = mag; pf = freq; }
    }
  }
  outBandRatio = (totalEnergy > 0) ? (bandEnergy / totalEnergy) : 0.0;
  outPeakFreq = pf;
}

bool isClickWindow(double ratio) { return ratio >= BAND_ENERGY_RATIO_MIN; }

void recordClick(bool clicked, uint8_t* history, uint8_t& idx, uint32_t& lastMs) {
  uint32_t now = millis();
  if (!clicked && (now - lastMs) > TRACK_TIMEOUT_MS) memset(history, 0, TRACK_WINDOWS);
  history[idx] = clicked ? 1 : 0;
  idx = (idx + 1) % TRACK_WINDOWS;
  if (clicked) lastMs = now;
}

uint8_t countRecentClicks(uint8_t* history) {
  uint8_t count = 0;
  for (int i = 0; i < TRACK_WINDOWS; i++) count += history[i];
  return count;
}

void sampleImpactFast(uint8_t i) {
  Adafruit_ADS1115& ads = *ADS_FOR[i];
  PeakResult r = readPeakRawSustained(ads, noiseFloorRaw[i], ADS_CHANNEL[i]);
  bool sustainedHit = (r.aboveThresholdSamples >= MIN_SUSTAINED_SAMPLES);

  if (sustainedHit) {
    float grams = voltageToGrams(ads.computeVolts(r.peak));
    if (grams > intervalPeakGrams[i]) intervalPeakGrams[i] = grams;
    intervalEvents[i]++;
  } else {
    baselineF[i] = (1.0f - BASELINE_ADAPT_ALPHA) * baselineF[i] + BASELINE_ADAPT_ALPHA * (float)r.peak;
    noiseFloorRaw[i] = (int16_t)(baselineF[i] + 0.5f);
  }
}

// One packet, all four piezos:
//   n=node, s=sector, b=battery %,
//   g=[grams x4], v="NNEN" severity per piezo, e=[events x4],
//   p=[pest 0/1 x4], c=[pest clicks x4]
void sendToBaseStation(const float* grams, const char* sev, const uint16_t* events,
                       const bool* pest, const uint8_t* clicks) {
  StaticJsonDocument<640> doc;
  doc["n"] = NODE_ID;
  doc["s"] = SECTOR;
  doc["b"] = readBatteryPercent();
  JsonArray g = doc.createNestedArray("g");
  JsonArray e = doc.createNestedArray("e");
  JsonArray p = doc.createNestedArray("p");
  JsonArray c = doc.createNestedArray("c");
  for (uint8_t i = 0; i < NUM_PIEZOS; i++) {
    g.add(roundf(grams[i] * 100.0f) / 100.0f);
    e.add(events[i]);
    p.add(pest[i] ? 1 : 0);
    c.add(clicks[i]);
  }
  doc["v"] = sev;   // char[5], copied into the document

  String packet;
  serializeJson(doc, packet);

  LoRa.beginPacket();
  LoRa.print(packet);
  int txOk = LoRa.endPacket();

  Serial.print("LoRa TX ");
  Serial.print(txOk ? "ok  " : "FAILED  ");
  Serial.println(packet);

#if TX_CHIRP
  digitalWrite(BUZZER_PIN, HIGH); delay(50); digitalWrite(BUZZER_PIN, LOW);
#endif
}

// ============================================================
// SETUP / LOOP
// ============================================================
void setup() {
  Serial.begin(115200);

  // Beep checkpoints (no laptop needed):
  //   0 beeps -> stuck at ADS1115 #1 | 1 beep -> stuck at ADS1115 #2
  //   2 beeps -> stuck at LoRa       | 2 beeps + triple beep -> running
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  I2C_1.begin(16, 17);
  I2C_2.begin(21, 22);

  if (!ads1.begin(0x48, &I2C_1)) {
    Serial.println("ADS1115 #1 (Piezo 1 + 3) not found! Check wiring.");
    while (1);
  }
  digitalWrite(BUZZER_PIN, HIGH); delay(150); digitalWrite(BUZZER_PIN, LOW); delay(150);

  if (!ads2.begin(0x48, &I2C_2)) {
    Serial.println("ADS1115 #2 (Piezo 2 + 4) not found! Check wiring.");
    while (1);
  }
  digitalWrite(BUZZER_PIN, HIGH); delay(150); digitalWrite(BUZZER_PIN, LOW); delay(150);

  ads1.setDataRate(RATE_ADS1115_860SPS);
  ads2.setDataRate(RATE_ADS1115_860SPS);

  for (uint8_t i = 0; i < NUM_PIEZOS; i++) {
    noiseFloorRaw[i] = calibrateNoiseFloor(*ADS_FOR[i], i);
    baselineF[i] = (float)noiseFloorRaw[i];
    intervalPeakGrams[i] = 0.0f;
    intervalEvents[i] = 0;
    consecCritical[i] = 0;
    memset(clickHistory[i], 0, TRACK_WINDOWS);
    clickIndex[i] = 0;
    lastClickMs[i] = 0;
  }

  analogReadResolution(12);
  for (uint8_t i = 0; i < NUM_PIEZOS; i++) analogSetPinAttenuation(FFT_PIN[i], ADC_11db);
  analogSetPinAttenuation(BATTERY_PIN, ADC_11db);

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);

  pinMode(LORA_RST, OUTPUT);
  digitalWrite(LORA_RST, LOW);  delay(10);
  digitalWrite(LORA_RST, HIGH); delay(10);

  pinMode(LORA_NSS, OUTPUT);
  digitalWrite(LORA_NSS, HIGH);
  digitalWrite(LORA_NSS, LOW);
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  SPI.transfer(0x42 & 0x7F);
  uint8_t version = SPI.transfer(0x00);
  SPI.endTransaction();
  digitalWrite(LORA_NSS, HIGH);
  Serial.print("SX127x version register read: 0x");
  Serial.println(version, HEX);

  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa init failed -- check wiring/frequency");
    while (true) delay(1000);
  }
  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.setSignalBandwidth(125E3);

  lastReportMs = millis();
  Serial.println("Master Node ready -- 4 piezos, 1 report per second over LoRa.");

  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH); delay(80); digitalWrite(BUZZER_PIN, LOW); delay(80);
  }
}

void loop() {
  static uint32_t lastHeapPrint = 0;
  if (millis() - lastHeapPrint > 30000) {
    lastHeapPrint = millis();
    Serial.print("[heap] free bytes: ");
    Serial.println(ESP.getFreeHeap());
  }

  serviceBuzzer();

  // 1) sample all four piezos (impact via ADS1115, pest via FFT)
  for (uint8_t i = 0; i < NUM_PIEZOS; i++) sampleImpactFast(i);
  for (uint8_t i = 0; i < NUM_PIEZOS; i++) {
    sampleWindowFFT(FFT_PIN[i]);
    analyzeSpectrum(bandRatio[i], peakFreq[i]);
    recordClick(isClickWindow(bandRatio[i]), clickHistory[i], clickIndex[i], lastClickMs[i]);
  }

  // 2) pad the pass out to exactly one report interval (1 s)
  while (millis() - lastReportMs < REPORT_INTERVAL_MS) {
    serviceBuzzer();
    delay(1);
  }
  lastReportMs = millis();

  // 3) build + send ONE packet carrying all four piezos
  float    grams[NUM_PIEZOS];
  char     sev[NUM_PIEZOS + 1];
  uint16_t events[NUM_PIEZOS];
  bool     pest[NUM_PIEZOS];
  uint8_t  clicks[NUM_PIEZOS];

  for (uint8_t i = 0; i < NUM_PIEZOS; i++) {
    grams[i]  = intervalPeakGrams[i];
    sev[i]    = classifySeverity(grams[i]);
    events[i] = intervalEvents[i];
    clicks[i] = countRecentClicks(clickHistory[i]);
    pest[i]   = (clicks[i] >= MIN_CLICKS_IN_TRACK);
  }
  sev[NUM_PIEZOS] = '\0';

  Serial.print("[1s] g: ");
  for (uint8_t i = 0; i < NUM_PIEZOS; i++) { Serial.print(grams[i], 2); Serial.print(i < NUM_PIEZOS - 1 ? " / " : "  "); }
  Serial.print("sev: "); Serial.print(sev);
  Serial.print("  pest: ");
  for (uint8_t i = 0; i < NUM_PIEZOS; i++) Serial.print(pest[i] ? 'Y' : '-');
  Serial.println();

  sendToBaseStation(grams, sev, events, pest, clicks);

  // 4) alarm: any piezo Critical for CONSEC_CRITICAL_FOR_ALARM reports in a row
  bool alarm = false;
  for (uint8_t i = 0; i < NUM_PIEZOS; i++) {
    consecCritical[i] = (sev[i] == 'C') ? (consecCritical[i] + 1) : 0;
    if (consecCritical[i] >= CONSEC_CRITICAL_FOR_ALARM) alarm = true;
  }
  if (alarm) {
    triggerBuzzer();
    for (uint8_t i = 0; i < NUM_PIEZOS; i++) consecCritical[i] = 0;
  }

  for (uint8_t i = 0; i < NUM_PIEZOS; i++) { intervalPeakGrams[i] = 0.0f; intervalEvents[i] = 0; }
}
