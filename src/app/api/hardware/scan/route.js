import { db } from '../../../lib/firebase'; 
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';

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
      parentNumber: student.parentNumber || "none",
      action: newStatus ? "ENTER" : "EXIT",
      hardwareTagId: rfid_tag_id,
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
