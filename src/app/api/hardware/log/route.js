import { db } from '../../../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const data = await request.json();
    
    // Natively write the hardware device log into Firestore so the Warden Dashboard can display it in real-time
    await addDoc(collection(db, "hardwareLogs"), {
      ...data,
      timestamp: new Date()
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("Hardware Log Error: ", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
