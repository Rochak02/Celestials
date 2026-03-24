"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Warden specific states
  const [students, setStudents] = useState([]);
  const [assigningRfidFor, setAssigningRfidFor] = useState(null);
  const [rfidInput, setRfidInput] = useState('');
  const [roomInput, setRoomInput] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            
            // If warden, fetch all students
            if (data.role === 'warden' || data.role === 'admin') {
              const q = query(collection(db, "users"), where("role", "==", "student"));
              const querySnapshot = await getDocs(q);
              const studentsList = [];
              querySnapshot.forEach((doc) => {
                studentsList.push({ id: doc.id, ...doc.data() });
              });
              setStudents(studentsList);
            }
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

  // ====== STUDENT ACTIONS ======
  const applyForRfid = async () => {
    try {
      if (!user) return;
      await updateDoc(doc(db, "users", user.uid), {
        rfidStatus: "pending"
      });
      setUserData(prev => ({ ...prev, rfidStatus: "pending" }));
      alert("Applied for RFID Card successfully! Waiting for Warden approval.");
    } catch (e) {
      console.error(e);
      alert("Error applying for RFID. Check permissions.");
    }
  };

  // ====== WARDEN ACTIONS ======
  const handleAssignRfid = async (e, studentId) => {
    e.preventDefault();
    if (!rfidInput || !roomInput) return alert("Please fill both RFID tag and Room No.");
    
    // Strict Structure Check: 250 Students, 125 Rooms (2 capacity), 4 Floors.
    // Floor 1-3 have 31 rooms. Floor 4 has 32 rooms.
    const roomNum = parseInt(roomInput);
    const floor = Math.floor(roomNum / 100);
    const roomSuffix = roomNum % 100;

    if (
      isNaN(roomNum) || 
      floor < 1 || floor > 4 || 
      roomSuffix < 1 || 
      (floor < 4 && roomSuffix > 31) || 
      (floor === 4 && roomSuffix > 32)
    ) {
      return alert("Invalid Room Number.\nConstraints:\n- Floors: 1 to 4\n- Floors 1-3: Rooms 01-31\n- Floor 4: Rooms 01-32\nExample: 101, 231, 432");
    }

    try {
      await updateDoc(doc(db, "users", studentId), {
        rfidStatus: "assigned",
        rfidTag: rfidInput,
        roomNo: roomInput
      });
      
      // Local state update immediately
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, rfidStatus: "assigned", rfidTag: rfidInput, roomNo: roomInput } : s));
      setAssigningRfidFor(null);
      setRfidInput('');
      setRoomInput('');
      alert(`Success! RFID [${rfidInput}] and Room [${roomInput}] verified and assigned.`);
    } catch (error) {
      console.error(error);
      alert("Error assigning RFID and Room to the backend.");
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0f172a', color: 'white' }}>
        Loading Dashboard...
      </div>
    );
  }

  // ============== WARDEN / ADMIN VIEW ==============
  if (userData?.role === 'warden' || userData?.role === 'admin') {
    const pendingRequests = students.filter(s => s.rfidStatus === "pending");
    const assignedStudents = students.filter(s => s.rfidStatus === "assigned");

    return (
      <div style={{ padding: '40px', color: 'white', fontFamily: 'Inter', background: '#0f172a', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0 }}>Warden Operations Dashboard</h1>
            <p style={{ color: '#94a3b8', marginTop: '8px' }}>Manage 250 Students • 125 Rooms • 4 Floors (Max 2 Students/Room)</p>
          </div>
          <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Sign Out</button>
        </div>

        {/* Top Analytics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '30px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#cbd5e1' }}>Pending RFID Applications</h3>
            <p style={{ fontSize: '42px', fontWeight: 'bold', color: '#f59e0b', margin: '0 0 16px 0' }}>{pendingRequests.length}</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#cbd5e1' }}>Assigned Students</h3>
            <p style={{ fontSize: '42px', fontWeight: 'bold', color: '#38bdf8', margin: '0 0 16px 0' }}>{assignedStudents.length}<span style={{ fontSize: '20px', color: '#64748b' }}>/250</span></p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#cbd5e1' }}>Total Registered Accounts</h3>
            <p style={{ fontSize: '42px', fontWeight: 'bold', color: '#10b981', margin: '0 0 16px 0' }}>{students.length}</p>
          </div>
        </div>

        {/* Action Center: Pending Configurations */}
        <div style={{ marginTop: '40px' }}>
          <h2>Alerts: Action Required</h2>
          {pendingRequests.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', color: '#94a3b8' }}>All caught up! No applications pending.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {pendingRequests.map(student => (
                <div key={student.id} style={{ background: 'rgba(255,255,255,0.06)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '18px' }}><strong>{student.name}</strong> <span style={{fontSize: '14px', color: '#94a3b8'}}>({student.email})</span> has applied for an RFID card & Room.</p>
                  
                  {assigningRfidFor === student.id ? (
                    <form onSubmit={(e) => handleAssignRfid(e, student.id)} style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        placeholder="Scan/Type RFID Tag ID" 
                        value={rfidInput} 
                        onChange={(e) => setRfidInput(e.target.value)} 
                        style={{ padding: '12px', borderRadius: '6px', border: 'none', background: '#1e293b', color: 'white', outline: 'none', minWidth: '220px' }} 
                        required 
                      />
                      <input 
                        type="text" 
                        placeholder="Room No (e.g. 101)" 
                        value={roomInput} 
                        onChange={(e) => setRoomInput(e.target.value)} 
                        style={{ padding: '12px', borderRadius: '6px', border: 'none', background: '#1e293b', color: 'white', outline: 'none', width: '150px' }} 
                        required 
                      />
                      <button type="submit" style={{ padding: '12px 24px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Link Registration</button>
                      <button type="button" onClick={() => setAssigningRfidFor(null)} style={{ padding: '12px 24px', background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer' }}>Cancel</button>
                    </form>
                  ) : (
                    <button onClick={() => setAssigningRfidFor(student.id)} style={{ background: '#38bdf8', border: 'none', padding: '10px 20px', borderRadius: '6px', color: '#fff', cursor: 'pointer', marginTop: '10px', fontWeight: 'bold' }}>
                      Assign Room & RFID
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comprehensive Directory */}
        <div style={{ marginTop: '40px' }}>
          <h2>Hostel Directory (Registered Students)</h2>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '15px 10px', color: '#94a3b8' }}>Name</th>
                  <th style={{ padding: '15px 10px', color: '#94a3b8' }}>Email</th>
                  <th style={{ padding: '15px 10px', color: '#94a3b8' }}>Status</th>
                  <th style={{ padding: '15px 10px', color: '#94a3b8' }}>RFID Tag ID</th>
                  <th style={{ padding: '15px 10px', color: '#94a3b8' }}>Room Assignment</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '15px 10px', fontWeight: '500' }}>{s.name}</td>
                    <td style={{ padding: '15px 10px', color: '#cbd5e1' }}>{s.email}</td>
                    <td style={{ padding: '15px 10px' }}>
                      <span style={{ 
                        padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                        background: s.rfidStatus === 'assigned' ? 'rgba(16, 185, 129, 0.2)' : s.rfidStatus === 'pending' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: s.rfidStatus === 'assigned' ? '#10b981' : s.rfidStatus === 'pending' ? '#f59e0b' : '#ef4444'
                      }}>
                        {(s.rfidStatus || "UNAPPLIED").toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '15px 10px', fontFamily: 'monospace', color: '#38bdf8' }}>{s.rfidTag || 'N/A'}</td>
                    <td style={{ padding: '15px 10px', fontWeight: 'bold' }}>{s.roomNo ? `Room ${s.roomNo}` : 'Unassigned'}</td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No students registered yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    );
  }

  // ============== STUDENT VIEW ==============
  return (
    <div style={{ padding: '40px', color: 'white', fontFamily: 'Inter', background: '#0f172a', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Student Operations Portal</h1>
          <p style={{ color: '#94a3b8', marginTop: '8px' }}>Welcome back, {userData?.name || user?.email}</p>
        </div>
        <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Sign Out</button>
      </div>
      
      {/* Front-and-Center Details */}
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '30px', borderRadius: '16px', marginTop: '30px', maxWidth: '600px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ margin: '0 0 25px 0', color: '#38bdf8', fontSize: '22px' }}>Your Allocation Profile</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <p style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Room Assignment</p>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>{userData?.roomNo ? `Room ${userData.roomNo}` : "Unassigned"}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>RFID Tag Access</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', color: userData?.rfidTag ? '#10b981' : '#ef4444' }}>
              {userData?.rfidTag || "Not Linked"}
            </p>
          </div>
        </div>

        {/* Dynamic Action State */}
        <div style={{ marginTop: '30px', paddingTop: '25px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {(!userData?.rfidStatus || userData?.rfidStatus === "unapplied") && (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'flex-start' }}>
               <p style={{ margin: 0, color: '#fca5a5', lineHeight: '1.5' }}>You do not have a physical RFID Card allocated to you yet. You must apply for one to gain physical entry to the hostel.</p>
               <button onClick={applyForRfid} style={{ padding: '12px 24px', background: '#38bdf8', color: 'black', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>Apply For Card & Room Now</button>
             </div>
          )}
          {userData?.rfidStatus === "pending" && (
             <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <p style={{ margin: 0, color: '#fcd34d', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                  ⏳ Your application is pending Warden review and assignment.
                </p>
             </div>
          )}
          {userData?.rfidStatus === "assigned" && (
             <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
               <p style={{ margin: 0, color: '#10b981', fontWeight: 'bold' }}>
                 ✅ Verified. You have full physical access via your assigned RFID Card.
               </p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
