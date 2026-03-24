"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, collection, query, where, onSnapshot, setDoc } from 'firebase/firestore';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Real-time Warden States
  const [students, setStudents] = useState([]);
  const [assigningRfidFor, setAssigningRfidFor] = useState(null);
  const [rfidInput, setRfidInput] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [wardenRfidInput, setWardenRfidInput] = useState('');
  
  // Real-time Mess Voting State
  const [menuVotes, setMenuVotes] = useState({ pizza: 0, pasta: 0, burger: 0, salad: 0 });

  // Onboarding States
  const [address, setAddress] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [collegeId, setCollegeId] = useState('');

  useEffect(() => {
    let unsubscribeUser = null;
    let unsubscribeStudents = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          // Listen to the current user's document in REAL-TIME (Instant UI Updates)
          unsubscribeUser = onSnapshot(doc(db, "users", currentUser.uid), async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              
              // SELF-HEALING DATA SYNC: 
              // If an account was registered before role tracking, or bypassed creation, repair it instantly!
              if (!data.role || !data.email) {
                await setDoc(doc(db, "users", currentUser.uid), {
                  role: data.role || "student",
                  email: data.email || currentUser.email,
                  name: data.name || "Student"
                }, { merge: true });
                return; // Let the new snapshot trigger render
              }

              setUserData(data);
              
              // If warden, subscribe to all students in REAL-TIME
              if (data.role === 'warden' || data.role === 'admin') {
                const q = query(collection(db, "users"), where("role", "==", "student"));
                unsubscribeStudents = onSnapshot(q, (snapshot) => {
                  const studentsList = [];
                  const votes = { pizza: 0, pasta: 0, burger: 0, salad: 0 };
                  snapshot.forEach((studentDoc) => {
                    const sData = studentDoc.data();
                    studentsList.push({ id: studentDoc.id, ...sData });
                    if (sData.foodVote && votes[sData.foodVote] !== undefined) {
                      votes[sData.foodVote]++;
                    }
                  });
                  setStudents(studentsList);
                  setMenuVotes(votes);
                });
              }
            } else {
              // Document doesn't exist at all? Create the absolute baseline
              await setDoc(doc(db, "users", currentUser.uid), {
                role: "student",
                email: currentUser.email,
                name: "Student",
                createdAt: new Date()
              });
            }
          });
        } catch (error) {
          console.error("Error setting up listeners:", error);
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeStudents) unsubscribeStudents();
    };
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    if (!address || !parentPhone || !collegeName || !collegeId) return alert("Please fill all details!");
    try {
      await setDoc(doc(db, "users", user.uid), {
        profileComplete: true,
        address,
        parentPhone,
        collegeName,
        collegeId,
        inHostel: true // Default assumed inside upon signup completion
      }, { merge: true });
    } catch (e) {
      alert("Failed to save profile. Ensure you are connected to internet.");
    }
  };

  // ====== STUDENT ACTIONS ======
  const applyForRfid = async () => {
    try {
      if (!user) return;
      await setDoc(doc(db, "users", user.uid), { rfidStatus: "pending" }, { merge: true });
      // We removed the annoying alert since the UI updates absolutely instantly now!
    } catch (e) {
      alert("Error applying for RFID. Network issue.");
    }
  };

  const voteForFood = async (foodItem) => {
    try {
      await setDoc(doc(db, "users", user.uid), { foodVote: foodItem }, { merge: true });
    } catch (e) {
      alert("Could not register live vote. Network issue.");
    }
  };

  // ====== WARDEN ACTIONS ======
  const handleAssignRfid = async (e, studentId) => {
    e.preventDefault();
    const roomNum = parseInt(roomInput);
    const floor = Math.floor(roomNum / 100);
    const roomSuffix = roomNum % 100;
    
    // Strict Structure Math for the 250 students architecture
    if (isNaN(roomNum) || floor < 1 || floor > 4 || roomSuffix < 1 || (floor < 4 && roomSuffix > 31) || (floor === 4 && roomSuffix > 32)) {
      return alert("Mathematical Room Rejection!\nFloors 1-3 have rooms 1-31. Floor 4 has rooms 1-32.");
    }

    try {
      await setDoc(doc(db, "users", studentId), {
        rfidStatus: "assigned",
        rfidTag: rfidInput.toUpperCase(),
        roomNo: roomInput
      }, { merge: true });
      
      setAssigningRfidFor(null);
      setRfidInput('');
      setRoomInput('');
    } catch (error) {
      alert("Error assigning RFID and Room globally to backend.");
    }
  };

  const handleAssignWardenRfid = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid), {
        rfidTag: wardenRfidInput.toUpperCase(),
        rfidStatus: "assigned"
      }, { merge: true });
      setWardenRfidInput('');
      alert("Master Access Card successfully linked to your Warden Profile!");
    } catch (error) {
      alert("Error syncing master warden tag.");
    }
  };

  if (loading) return <div style={{ color: 'white', background: '#0f172a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Connecting to Realtime Firebase Protocol...</div>;
  if (!userData) return <div style={{ color: 'white', background: '#0f172a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Checking user profile matrix...</div>;

  // ====== ONBOARDING WALL (Students Only) ======
  if (userData.role === 'student' && !userData.profileComplete) {
    return (
      <div style={{ padding: '40px', color: 'white', background: '#0f172a', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '40px', borderRadius: '16px', maxWidth: '500px', width: '100%' }}>
          <h2>Complete Your Profile</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>To enable automated parent SMS notifications and secure your registration, please fill out these required fields securely.</p>
          <form onSubmit={handleOnboardingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="text" placeholder="Home Address" value={address} onChange={e => setAddress(e.target.value)} required style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#1e293b', color: 'white' }} />
            <input type="text" placeholder="Parent Contact Number (e.g. +1...)" value={parentPhone} onChange={e => setParentPhone(e.target.value)} required style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#1e293b', color: 'white' }} />
            <input type="text" placeholder="College Name" value={collegeName} onChange={e => setCollegeName(e.target.value)} required style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#1e293b', color: 'white' }} />
            <input type="text" placeholder="College ID Number" value={collegeId} onChange={e => setCollegeId(e.target.value)} required style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#1e293b', color: 'white' }} />
            <button type="submit" style={{ padding: '14px', background: '#38bdf8', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>Save Profile & Log In</button>
          </form>
        </div>
      </div>
    );
  }

  // ============== WARDEN VIEW ==============
  if (userData.role === 'warden' || userData.role === 'admin') {
    const pendingRequests = students.filter(s => s.rfidStatus === "pending");
    
    // Find highest voted food dynamically
    let winningFood = "None";
    let maxVotes = -1;
    for (const [food, count] of Object.entries(menuVotes)) {
      if (count > maxVotes && count > 0) {
        maxVotes = count;
        winningFood = food.charAt(0).toUpperCase() + food.slice(1);
      }
    }

    return (
      <div style={{ padding: '40px', color: 'white', fontFamily: 'Inter', background: '#0f172a', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0 }}>Warden Live Operations Dashboard</h1>
            <p style={{ color: '#94a3b8', marginTop: '8px' }}>Real-time Sync Active • Automated PUSH Logs Enabled • ESP32 Relay Linked</p>
          </div>
          <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Sign Out</button>
        </div>

        {/* Analytics Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginTop: '30px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ color: '#cbd5e1' }}>Pending RFID Applications</h3>
            <p style={{ fontSize: '36px', fontWeight: 'bold', color: pendingRequests.length > 0 ? '#f59e0b' : '#94a3b8' }}>{pendingRequests.length}</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ color: '#cbd5e1' }}>Students Inside Hostel Right Now</h3>
            <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#10b981' }}>{students.filter(s => s.inHostel === true).length}</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ color: '#cbd5e1' }}>Tomorrow's Winning Mess Menu</h3>
            <p style={{ fontSize: '30px', fontWeight: 'bold', color: '#8b5cf6' }}>{winningFood} <span style={{fontSize:'12px', color:'#94a3b8'}}>({maxVotes === -1 ? 0 : maxVotes} votes)</span></p>
          </div>
        </div>

        {/* Alerts Section */}
        <div style={{ marginTop: '40px' }}>
          <h2>Instant Alerts: Action Required</h2>
          {pendingRequests.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', color: '#94a3b8' }}>No pending applications currently. Live sync is watching...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {pendingRequests.map(student => (
                <div key={student.id} style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #f59e0b', transition: 'all 0.3s' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '18px' }}><strong>{student.name}</strong> applied for an RFID Card & Room Assignment.</p>
                  {assigningRfidFor === student.id ? (
                    <form onSubmit={(e) => handleAssignRfid(e, student.id)} style={{ display: 'flex', gap: '10px' }}>
                      <input type="text" placeholder="Scan/Type physical RFID Tag" value={rfidInput} onChange={(e) => setRfidInput(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: 'none', outline:'none' }} required />
                      <input type="text" placeholder="Room No (e.g. 101)" value={roomInput} onChange={(e) => setRoomInput(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: 'none', width: '150px', outline:'none' }} required />
                      <button type="submit" style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Assign via Backend & Sync</button>
                      <button type="button" onClick={() => setAssigningRfidFor(null)} style={{ padding: '10px 20px', background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                    </form>
                  ) : (
                    <button onClick={() => setAssigningRfidFor(student.id)} style={{ background: '#38bdf8', border: 'none', padding: '10px 20px', borderRadius: '6px', color: '#0f172a', cursor: 'pointer', fontWeight: 'bold' }}>Approve & Assign Hardware</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Warden Master Key Linking */}
        <div style={{ marginTop: '40px', background: 'rgba(139, 92, 246, 0.1)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
          <h2 style={{ color: '#c4b5fd', margin: '0 0 10px 0' }}>Warden Universal Master Key</h2>
          <p style={{ color: '#e2e8f0', margin: '0 0 15px 0' }}>Assign an RFID card to your own Warden credentials. Your master card will automatically unlock all relay gates.</p>
          <form onSubmit={handleAssignWardenRfid} style={{ display: 'flex', gap: '10px' }}>
            <input type="text" placeholder="Scan/Type Warden RFID String" value={wardenRfidInput} onChange={(e) => setWardenRfidInput(e.target.value)} style={{ padding: '12px', borderRadius: '6px', border: 'none', outline:'none', minWidth: '300px', background: 'rgba(0,0,0,0.3)', color: 'white' }} required />
            <button type="submit" style={{ padding: '12px 24px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Link to My Warden Profile</button>
          </form>
          {userData?.rfidTag && <p style={{color: '#10b981', marginTop: '15px', fontWeight: 'bold', fontFamily: 'monospace'}}>✅ Active Universal Key: {userData.rfidTag}</p>}
        </div>

        {/* Live Directory */}
        <div style={{ marginTop: '40px' }}>
          <h2>Live Student Directory & Tracking</h2>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '15px' }}>Location Status</th>
                  <th style={{ padding: '15px' }}>Student Identity</th>
                  <th style={{ padding: '15px' }}>Parent Alert Info</th>
                  <th style={{ padding: '15px' }}>RFID Gateway Tag</th>
                  <th style={{ padding: '15px' }}>Room Assig.</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: s.inHostel ? '#10b981' : '#ef4444', margin: 'auto', boxShadow: s.inHostel ? '0 0 12px #10b981' : '0 0 12px #ef4444' }} title={s.inHostel ? "Inside Hostel" : "Outside Hostel"} />
                      <span style={{fontSize: '10px', color: '#cbd5e1', marginTop: '4px', display:'block'}}>{s.inHostel ? 'INSIDE' : 'OUTSIDE'}</span>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <strong>{s.name}</strong><br/>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>{s.email} | ID: {s.collegeId || 'N/A'}</span>
                    </td>
                    <td style={{ padding: '15px', color: '#cbd5e1', fontSize: '13px' }}>
                      Phone: {s.parentPhone || 'Missing'}<br/>
                      <span style={{color: '#94a3b8'}}>{s.address}</span>
                    </td>
                    <td style={{ padding: '15px', fontFamily: 'monospace', color: s.rfidStatus === 'assigned' ? '#38bdf8' : '#64748b' }}>{s.rfidTag || 'UNASSIGNED'}</td>
                    <td style={{ padding: '15px', fontWeight: 'bold' }}>{s.roomNo ? `R. ${s.roomNo}` : '-'}</td>
                  </tr>
                ))}
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
          <h1 style={{ margin: 0 }}>Student Dashboard</h1>
          <p style={{ color: '#94a3b8', marginTop: '8px' }}>Welcome back, {userData.name} | Real-time Sync Linked</p>
        </div>
        <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Sign Out</button>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', marginTop: '30px' }}>
        
        {/* Verification Status */}
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: '0 0 25px 0', color: '#38bdf8', fontSize: '22px' }}>Hostel Registration Profile</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '13px', textTransform: 'uppercase' }}>Room Link</p>
              <p style={{ margin: 0, fontSize: '26px', fontWeight: 'bold' }}>{userData.roomNo ? `Room ${userData.roomNo}` : "Unassigned"}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '13px', textTransform: 'uppercase' }}>RFID Physical Access</p>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', color: userData.rfidTag ? '#10b981' : '#ef4444' }}>
                {userData.rfidTag || "Not Linked"}
              </p>
            </div>
          </div>
          <div style={{ marginTop: '30px', paddingTop: '25px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {(!userData.rfidStatus || userData.rfidStatus === "unapplied") && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                 <p style={{ margin: 0, color: '#fca5a5' }}>You must request an RFID Card to gain gateway relay access to the hostel building.</p>
                 <button onClick={applyForRfid} style={{ padding: '12px 24px', background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>Apply For Card & Room Online</button>
               </div>
            )}
            {userData.rfidStatus === "pending" && (
               <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <p style={{ margin: 0, color: '#fcd34d', fontWeight: 'bold' }}>⏳ Your RFID application was successfully sent and is pending Warden approval!</p>
               </div>
            )}
            {userData.rfidStatus === "assigned" && (
               <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                 <p style={{ margin: 0, color: '#10b981', fontWeight: 'bold' }}>✅ Secured! Tap your assigned ESP32 RFID card to dynamically open the hostel relay.</p>
               </div>
            )}
          </div>
        </div>

        {/* Mess Network Voting */}
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: '0 0 25px 0', color: '#8b5cf6', fontSize: '22px' }}>Tomorrow's Mess Menu Voting</h3>
          <p style={{ color: '#94a3b8', marginBottom: '20px' }}>Your synced vote: <strong style={{color: 'white', textTransform: 'uppercase'}}>{userData.foodVote || 'None Selected'}</strong></p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button onClick={() => voteForFood('pizza')} style={{ padding: '18px', background: userData.foodVote === 'pizza' ? '#8b5cf6' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize:'16px', transition: 'background 0.2s' }}>🍕 Pizza</button>
            <button onClick={() => voteForFood('pasta')} style={{ padding: '18px', background: userData.foodVote === 'pasta' ? '#8b5cf6' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize:'16px', transition: 'background 0.2s' }}>🍝 Pasta</button>
            <button onClick={() => voteForFood('burger')} style={{ padding: '18px', background: userData.foodVote === 'burger' ? '#8b5cf6' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize:'16px', transition: 'background 0.2s' }}>🍔 Burgers</button>
            <button onClick={() => voteForFood('salad')} style={{ padding: '18px', background: userData.foodVote === 'salad' ? '#8b5cf6' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize:'16px', transition: 'background 0.2s' }}>🥗 Salad Bowl</button>
          </div>
        </div>
      </div>
    </div>
  );
}
