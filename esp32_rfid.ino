#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>

// RFID Sensor Pins (ESP32C6)
// Adjust these precisely to your ESP32C6 board diagram
#define RST_PIN         9  
#define SS_PIN          10 

MFRC522 mfrc522(SS_PIN, RST_PIN);

// Wi-Fi Integration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Your Next.js App's specific internal IP (e.g. http://192.168.1.5:3000/api/hardware/scan)
const char* serverUrl = "http://YOUR_LOCAL_IP:3000/api/hardware/scan";

void setup() {
  Serial.begin(115200);   
  while (!Serial);        
  
  SPI.begin();            // Init SPI bus
  mfrc522.PCD_Init();     // Init MFRC522 card
  
  Serial.println(F("Connecting to WiFi..."));
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi connected! System ready for RFID scanning.");
}

void loop() {
  // Look for new RFID cards
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // Convert exact UID byte array into a solid clean Hex String
  String rfidTag = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    rfidTag += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    rfidTag += String(mfrc522.uid.uidByte[i], HEX);
  }
  rfidTag.toUpperCase();
  
  Serial.print("RFID Scanned! Tag UUID: ");
  Serial.println(rfidTag);

  // Send the tag string to our Next.js Server immediately over HTTP POST
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // Construct the payload 
    String jsonPayload = "{\"rfid_tag_id\":\"" + rfidTag + "\"}";

    int httpResponseCode = http.POST(jsonPayload);
    
    if (httpResponseCode > 0) {
      Serial.print("Backend Response Code: ");
      Serial.println(httpResponseCode);
      Serial.println(http.getString());
    } else {
      Serial.print("Error sending to backend... Response Code: ");
      Serial.println(httpResponseCode);
    }
    http.end(); 
  } else {
    Serial.println("WiFi dropped. Unable to send read info.");
  }

  // Halt PICC to debounce scans (prevent multi-reads on long taps)
  mfrc522.PICC_HaltA();
  delay(1500); 
}
