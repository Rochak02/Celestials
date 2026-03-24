"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import './login.css';

export default function Login() {
  const router = useRouter();
  const [isRightPanelActive, setIsRightPanelActive] = useState(false);
  const [errorHeader, setErrorHeader] = useState('');
  
  // Sign In states
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign Up states
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpAdminCode, setSignUpAdminCode] = useState('');

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorHeader('');
    try {
      // Isolate session strictly to this tab so multiple tabs can have different users
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, signInEmail, signInPassword);
      console.log("Sign In successful!");
      router.push('/dashboard');
    } catch (error) {
      console.error("Sign In Error:", error);
      setErrorHeader("Invalid Credentials. " + error.message.replace('Firebase:', ''));
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorHeader('');
    try {
      // Isolate session strictly to this tab
      await setPersistence(auth, browserSessionPersistence);
      const userCredential = await createUserWithEmailAndPassword(auth, signUpEmail, signUpPassword);
      const user = userCredential.user;
      
      // Determine Role
      let assignedRole = "student";
      // Hidden secret to create a Warden test account
      if (signUpAdminCode === "SECRETWARDEN") {
        assignedRole = "warden";
      }

      // Save user to Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: signUpName,
        email: signUpEmail,
        role: assignedRole,
        createdAt: new Date()
      });
      
      console.log("Sign Up successful!");
      router.push('/dashboard');
    } catch (error) {
      console.error("Sign Up Error:", error);
      setErrorHeader("Failed to Sign Up. " + error.message.replace('Firebase:', ''));
    }
  };

  return (
    <div className="login-wrapper">
      <div className={`container ${isRightPanelActive ? "right-panel-active" : ""}`} id="container">
        
        {/* Sign Up Form (Left when active) */}
        <div className="form-container sign-up-container">
          <form onSubmit={handleSignUp}>
            <h1>Create Account</h1>
            <span>Register your personal details to use features</span>
            {errorHeader && isRightPanelActive && <p className="error-text" style={{color: '#fca5a5', fontSize: '13px', marginTop: '10px'}}>{errorHeader}</p>}
            <input 
              type="text" 
              placeholder="Name" 
              value={signUpName}
              onChange={(e) => setSignUpName(e.target.value)}
              required
            />
            <input 
              type="email" 
              placeholder="Email" 
              value={signUpEmail}
              onChange={(e) => setSignUpEmail(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={signUpPassword}
              onChange={(e) => setSignUpPassword(e.target.value)}
              required
            />
            <input 
              type="text" 
              placeholder="Admin Code (Optional)" 
              value={signUpAdminCode}
              onChange={(e) => setSignUpAdminCode(e.target.value)}
              style={{ padding: '8px 15px', color: '#9CA3AF', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.2)', marginBottom: '10px', fontSize: '12px' }}
            />
            <button type="submit" className="solid-btn">Sign Up</button>
          </form>
        </div>
        
        {/* Sign In Form (Left when inactive) */}
        <div className="form-container sign-in-container">
          <form onSubmit={handleSignIn}>
            <h1>Sign In</h1>
            <p className="subtitle">Enter your email and password</p>
            {errorHeader && !isRightPanelActive && <p className="error-text" style={{color: '#fca5a5', fontSize: '13px', marginTop: '10px'}}>{errorHeader}</p>}
            <input 
              type="email" 
              placeholder="Email" 
              value={signInEmail}
              onChange={(e) => setSignInEmail(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={signInPassword}
              onChange={(e) => setSignInPassword(e.target.value)}
              required
            />
            <button type="submit" className="solid-btn">SIGN IN</button>
          </form>
        </div>
        
        {/* Overlay Container (Right side graphic) */}
        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <h1>Welcome Back!</h1>
              <p>To keep connected with us please login with your personal info</p>
              <button type="button" className="ghost-btn" onClick={() => { setIsRightPanelActive(false); setErrorHeader(''); }}>Sign In</button>
            </div>
            <div className="overlay-panel overlay-right">
              <h1>Hello, Friend!</h1>
              <p>Register with your personal details to use all of the site features</p>
              <button type="button" className="ghost-btn" onClick={() => { setIsRightPanelActive(true); setErrorHeader(''); }}>SIGN UP</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
