#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
// IMPORTANT: You must install the ArduinoJson library in Arduino IDE to parse the server's HTTP JSON response!
// #include <ArduinoJson.h> (Optional if we just do a basic string match, which saves memory. Let's use basic String matching for "GRANT_ACCESS" to be extremely fast and robust for ESP32).

// --- PIN DEFINITIONS FOR Seeed Studio XIAO ESP32-C6 ---
// Wired explicitly to match your uploaded D-pad pinout diagram
#define RST_PIN         16  // Connect RC522 RST to D6 (GPIO16)
#define SS_PIN          17  // Connect RC522 SDA (SS) to D7 (GPIO17)
#define RELAY_PIN       21  // Connect Relay trigger to D3 (GPIO21)

// Explicitly defining hardware SPI pins to bypass Arduino IDE Board Profile defaults
#define SCK_PIN         19  // Connect to D8
#define MISO_PIN        20  // Connect to D9
#define MOSI_PIN        18  // Connect to D10

MFRC522 mfrc522(SS_PIN, RST_PIN);

// --- WIFI & SERVER ENDPOINT ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Replace strictly with the Local IPv4 address of the computer running "npm run dev"
// If deployed online (e.g. Vercel), replace with actual URL: "https://your-app.vercel.app/api/hardware/scan"
const char* serverUrl = "http://YOUR_LOCAL_IP:3000/api/hardware/scan";

void setup() {
  Serial.begin(115200);   
  // Optional delay to give the native USB time to securely connect to the PC
  delay(2000); 
  
  Serial.println(F("\n=============================="));
  Serial.println(F("ESP32-C6 Booting Up..."));
  Serial.println(F("=============================="));
  
  // Setup the Relay Actuator Pin
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); // Assumes LOW is locked for typical Active-High relays. Flip to HIGH if Active-Low!
  
  Serial.println(F("Configuring Explicit Hardware SPI Bus..."));
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);            
  
  Serial.println(F("Waking up MFRC522 Scanner..."));
  mfrc522.PCD_Init();     
  delay(4); // short delay to let PCD boot

  // STRICT HARDWARE DIAGNOSTIC CHECK
  Serial.print(F("Scanner Firmware Target: 0x"));
  byte v = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  Serial.println(v, HEX);
  if (v == 0x00 || v == 0xFF) {
    Serial.println(F("CRITICAL ERROR: Communication failure! SPI pins are wrong, wires are loose, or the RC522 Scanner is completely dead/unpowered. System halting."));
    while(1); // Completely halt execution to stop native USB from crashing
  }
  
  Serial.println(F("Hardware Authorized. Connecting to WiFi..."));
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected! System ready and listening for RFID taps.");
}

void loop() {
  // Look for new physical RFID cards
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) return;

  // Extract the exact Hexadecimal String
  String rfidTag = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    rfidTag += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    rfidTag += String(mfrc522.uid.uidByte[i], HEX);
  }
  rfidTag.toUpperCase();
  
  Serial.print("RFID Tapped! Tag UUID: ");
  Serial.println(rfidTag);

  // Send the payload instantly to our Next.js API
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{\"rfid_tag_id\":\"" + rfidTag + "\"}"; 
    int httpResponseCode = http.POST(jsonPayload);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("Server Database Response: ");
      Serial.println(response);
      
      // Analyze Database Authorization dynamically!
      // If the backend verifies it's a registered Student or Warden, it returns "action": "GRANT_ACCESS"
      if (response.indexOf("\"GRANT_ACCESS\"") > 0) {
        Serial.println("✅ VERIFIED: Access Granted! Actuating Relay Gate...");
        digitalWrite(RELAY_PIN, HIGH); // Send voltage to open the relay
        delay(3000);                   // Keep gate physically unlocked for 3 seconds
        digitalWrite(RELAY_PIN, LOW);  // Kill voltage to lock the relay instantly
        Serial.println("Gate Securely Locked.");
      } else {
        Serial.println("❌ DENIED: Card is completely Unregistered or Unauthorized.");
      }
      
    } else {
      Serial.print("Network Error sending to server: ");
      Serial.println(httpResponseCode);
    }
    http.end(); 
  } else {
    Serial.println("WiFi disconnected... Waiting for reconnect.");
  }

  // Halt reading the identical card multiple times natively to prevent relay spam
  mfrc522.PICC_HaltA();
  delay(1500); 
}
