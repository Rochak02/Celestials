"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0f172a', color: 'white' }}>
        Loading Dashboard...
      </div>
    );
  }

  // ====== WARDEN / ADMIN VIEW ======
  if (userData?.role === 'warden' || userData?.role === 'admin') {
    return (
      <div style={{ padding: '40px', color: 'white', fontFamily: 'Inter', background: '#0f172a', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0 }}>Warden Operations Dashboard</h1>
            <p style={{ color: '#94a3b8', marginTop: '8px' }}>Welcome back, Warden {userData?.name || user?.email}</p>
          </div>
          <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'opacity 0.2s' }}>Sign Out</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '30px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#cbd5e1' }}>Pending Gate Passes</h3>
            <p style={{ fontSize: '42px', fontWeight: 'bold', color: '#f59e0b', margin: '0 0 16px 0' }}>12</p>
            <button style={{ background: '#38bdf8', border: 'none', padding: '10px 0', width: '100%', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>Review Requests</button>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#cbd5e1' }}>Today's Attendance</h3>
            <p style={{ fontSize: '42px', fontWeight: 'bold', color: '#10b981', margin: '0 0 16px 0' }}>240<span style={{ fontSize: '20px', color: '#64748b' }}>/250</span></p>
            <button style={{ background: '#38bdf8', border: 'none', padding: '10px 0', width: '100%', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>View Logs</button>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#cbd5e1' }}>Room Capacity</h3>
            <p style={{ fontSize: '42px', fontWeight: 'bold', color: '#8b5cf6', margin: '0 0 16px 0' }}>95%</p>
            <button style={{ background: '#38bdf8', border: 'none', padding: '10px 0', width: '100%', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>Manage Rooms</button>
          </div>
        </div>

        <div style={{ marginTop: '40px', background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
           <h3>Recent Hardware Activity (RFID)</h3>
           <p style={{ color: '#94a3b8' }}>Live synchronization with ESP32C6 sensors is waiting...</p>
        </div>
      </div>
    );
  }

  // ====== STUDENT VIEW ======
  return (
    <div style={{ padding: '40px', color: 'white', fontFamily: 'Inter', background: '#0f172a', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Student Dashboard</h1>
          <p style={{ color: '#94a3b8', marginTop: '8px' }}>Welcome back, {userData?.name || user?.email}</p>
        </div>
        <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Sign Out</button>
      </div>
      
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', marginTop: '30px', maxWidth: '500px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <p><strong>Status:</strong> Active Session</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Role:</strong> <span style={{ textTransform: 'uppercase', color: '#38bdf8', fontWeight: 'bold' }}>{userData?.role || "student"}</span></p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '30px', maxWidth: '800px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '30px 20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Request Gate Pass</h3>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0' }}>Apply for leave out of the hostel</p>
          <button style={{ background: '#4A8CFF', border: 'none', padding: '10px 20px', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>Apply</button>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '30px 20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Mess Menu Voting</h3>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0' }}>Vote for tomorrow's dinner options</p>
          <button style={{ background: '#4A8CFF', border: 'none', padding: '10px 20px', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>Vote Now</button>
        </div>
      </div>
    </div>
  );
}
