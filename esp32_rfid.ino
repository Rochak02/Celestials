#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
// IMPORTANT: You must install the ArduinoJson library in Arduino IDE to parse the server's HTTP JSON response!
// #include <ArduinoJson.h> (Optional if we just do a basic string match, which saves memory. Let's use basic String matching for "GRANT_ACCESS" to be extremely fast and robust for ESP32).

// --- PIN DEFINITIONS FOR ESP32-C6 ---
// Customize these directly based on the pin diagram you have for your specific ESP32-C6!
#define RST_PIN         15  
#define SS_PIN          18
#define RELAY_PIN       4   // The GPIO pin physically wired to the Relay Module

MFRC522 mfrc522(SS_PIN, RST_PIN);

// --- WIFI & SERVER ENDPOINT ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Replace strictly with the Local IPv4 address of the computer running "npm run dev"
// If deployed online (e.g. Vercel), replace with actual URL: "https://your-app.vercel.app/api/hardware/scan"
const char* serverUrl = "http://YOUR_LOCAL_IP:3000/api/hardware/scan";

void setup() {
  Serial.begin(115200);   
  while (!Serial);        
  
  // Setup the Relay Actuator Pin
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); // Assumes LOW is locked for typical Active-High relays. Flip to HIGH if Active-Low!
  
  SPI.begin();            
  mfrc522.PCD_Init();     
  
  Serial.println(F("Initializing ESP32C6 Environment..."));
  Serial.println(F("Connecting to WiFi..."));
  
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
