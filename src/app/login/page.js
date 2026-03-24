"use client";

import { useState } from 'react';
import './login.css';

export default function Login() {
  const [isRightPanelActive, setIsRightPanelActive] = useState(false);
  
  // Sign In states
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign Up states
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  const handleSignIn = (e) => {
    e.preventDefault();
    console.log("Sign In attempted for:", signInEmail);
    // TODO: Implement Firebase Auth handleSignIn
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    console.log("Sign Up attempted for:", signUpEmail);
    // TODO: Implement Firebase Auth handleSignUp
  };

  return (
    <div className="login-wrapper">
      <div className={`container ${isRightPanelActive ? "right-panel-active" : ""}`} id="container">
        
        {/* Sign Up Form (Left when active) */}
        <div className="form-container sign-up-container">
          <form onSubmit={handleSignUp}>
            <h1>Create Account</h1>
            <span>Register your personal details to use features</span>
            <input 
              type="text" 
              placeholder="Name" 
              value={signUpName}
              onChange={(e) => setSignUpName(e.target.value)}
              required
            />
            <input 
              type="text" 
              placeholder="Username / Email" 
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
            <button type="submit" className="solid-btn">Sign Up</button>
          </form>
        </div>
        
        {/* Sign In Form (Left when inactive) */}
        <div className="form-container sign-in-container">
          <form onSubmit={handleSignIn}>
            <h1>Sign In</h1>
            <p className="subtitle">Enter your username and password</p>
            <input 
              type="text" 
              placeholder="Username" 
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
              <button className="ghost-btn" onClick={() => setIsRightPanelActive(false)}>Sign In</button>
            </div>
            <div className="overlay-panel overlay-right">
              <h1>Hello, Friend!</h1>
              <p>Register with your personal details to use all of the site features</p>
              <button className="ghost-btn" onClick={() => setIsRightPanelActive(true)}>SIGN UP</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
