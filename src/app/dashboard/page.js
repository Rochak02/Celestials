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
        // Fetch user document from Firestore to get their role, name, etc.
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
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

  return (
    <div style={{ padding: '40px', color: 'white', fontFamily: 'Inter', background: '#0f172a', minHeight: '100vh' }}>
      <h1>Dashboard</h1>
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', marginTop: '20px', maxWidth: '500px' }}>
        <p><strong>Status:</strong> Active Session</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Name:</strong> {userData?.name || 'N/A'}</p>
        <p><strong>Role:</strong> <span style={{ textTransform: 'uppercase', color: '#38bdf8' }}>{userData?.role || "Fetching..."}</span></p>
        
        <button 
          onClick={handleLogout}
          style={{ marginTop: '20px', padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
