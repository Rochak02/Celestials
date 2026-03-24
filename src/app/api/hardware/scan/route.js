import { db } from '../../../../lib/firebase'; 
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';
import whatsappClient from '../../../../lib/whatsapp'; 

// ESP32 hits this POST endpoint automatically anytime an RFID tag is tapped natively on the scanner.
export async function POST(request) {
  try {
    const { rfid_tag_id } = await request.json();
    
    if (!rfid_tag_id) {
      return NextResponse.json({ success: false, action: "DENY", message: "MISSING_PAYLOAD" }, { status: 400 });
    }

    // Ping Firestore to securely find the student assigned to this hardware tag
    const q = query(collection(db, "users"), where("rfidTag", "==", rfid_tag_id));
    const qs = await getDocs(q);
    
    if (qs.empty) {
      // Log failed scan visually to the Warden's new terminal
      await addDoc(collection(db, "hardwareLogs"), {
        event: "SCAN_DENIED",
        rfidTag: rfid_tag_id,
        message: `Unregistered Master/Student Card Tapped: ${rfid_tag_id}`,
        timestamp: new Date()
      });

      // Hardware Relay stays SHUT
      return NextResponse.json({ success: false, action: "DENY", message: "UNREGISTERED_TAG" }, { status: 404 });
    }
    
    // Found the deeply mapped student
    const studentDoc = qs.docs[0];
    const student = studentDoc.data();
    
    // The previous state determines if they are entering or leaving!
    const isCurrentlyInside = student.inHostel || false;
    const newStatus = !isCurrentlyInside; // Flip Status
    
    // Natively sync Firestore backwards so the Warden UI updates a GREEN DOT instantly
    await updateDoc(doc(db, "users", studentDoc.id), {
      inHostel: newStatus,
      lastScanTime: new Date()
    });

    // Write a permanent immutable log of the entry/exit (this triggers the parent push notification logs)
    await addDoc(collection(db, "attendanceLogs"), {
      studentId: studentDoc.id,
      studentName: student.name,
      parentNumber: student.parentPhone || "none", // Updated to explicitly match the dashboard state variable 
      action: newStatus ? "ENTER" : "EXIT",
      hardwareTagId: rfid_tag_id,
      timestamp: new Date()
    });

    // -- DIRECT WHATSAPP WEB INTEGRATION --
    // Only fire if the parent specified a numeric mobile number
    if (student.parentPhone && student.parentPhone.toLowerCase() !== "none") {
      try {
        const actionWord = newStatus ? "ENTERED" : "LEFT";
        const timeString = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        
        // Structure the WhatsApp Payload Native to the Client App API
        const whatsappPayload = `🚨 *Hostel Gate Alert*\nYour child, *${student.name}*, has successfully *${actionWord}* the hostel securely at ${timeString}.`;
        
        // Strip out any non-numeric characters from the string (like + or dashes)
        const cleanNumber = student.parentPhone.replace(/\D/g, ''); 
        
        // Web Whatsapp requires the ID in this exact syntax natively at the country code level
        const whatsappId = `${cleanNumber}@c.us`; 
        
        // Securely blast the Headless Chromium DOM to send the encrypted message down the physical HTTP pipe
        if (whatsappClient) {
          await whatsappClient.sendMessage(whatsappId, whatsappPayload);
          console.log(`WhatsApp securely blasted to Parent Phone: ${whatsappId}`);
        } else {
          console.warn("WhatsApp Client isn't initialized yet. Skipping Push.");
        }
        
      } catch (err) {
        console.error("Failed to route WhatsApp Push Headless API dynamically:", err);
      }
    }
    // -- END WHATSAPP INTEGRATION --

    // Write a Visual Live Terminal Log for the Warden Dashboard
    await addDoc(collection(db, "hardwareLogs"), {
      event: "SCAN_GRANTED",
      rfidTag: rfid_tag_id,
      studentName: student.name,
      message: `Access Granted to ${student.name}. Relaying GATE UNLOCK command.`,
      timestamp: new Date()
    });
    
    // SUCCESS! Return the command back directly to the ESP32.
    // Notice "action: GRANT_ACCESS". Your ESP32 C++ code should look for this 200 OK and TRIGGER the Relay to physically unlock the gate!
    return NextResponse.json({ 
      success: true, 
      action: "GRANT_ACCESS", 
      student_name: student.name,
      state_change: newStatus ? "ENTERED_HOSTEL" : "LEFT_HOSTEL"
    }, { status: 200 });

  } catch (error) {
    console.error("Hardware Synchro Error: ", error);
    return NextResponse.json({ success: false, action: "DENY", error: error.message }, { status: 500 });
  }
}
