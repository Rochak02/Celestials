import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem', background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Hostel Operations
      </h1>
      <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Unified management platform for attendance, passes, and mess voting.</p>
      <Link href="/login" style={{ padding: '12px 24px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.2)', transition: 'background 0.2s', color: 'white' }}>
        Go to Login
      </Link>
    </main>
  );
}
