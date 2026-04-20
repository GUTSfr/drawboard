import React, { useState } from 'react';

export default function LandingPage({ onEnter }) {
  const [nick, setNick] = useState('');
  const [err, setErr] = useState('');

  const submit = () => {
    const n = nick.trim();
    if (!n) { setErr('Please enter a nickname'); return; }
    if (n.length < 2) { setErr('At least 2 characters'); return; }
    if (n.length > 24) { setErr('Max 24 characters'); return; }
    onEnter(n);
  };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative background */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
      }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: `${200 + i * 120}px`,
            height: `${200 + i * 120}px`,
            borderRadius: '50%',
            border: `1px solid rgba(108,99,255,${0.04 + i * 0.01})`,
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            animation: `spin${i % 2 === 0 ? '' : 'Rev'} ${20 + i * 8}s linear infinite`,
          }} />
        ))}
        {/* Floating dots */}
        {[...Array(20)].map((_, i) => (
          <div key={`dot-${i}`} style={{
            position: 'absolute',
            width: `${3 + Math.random() * 5}px`,
            height: `${3 + Math.random() * 5}px`,
            borderRadius: '50%',
            background: ['#6c63ff','#ff6b6b','#43e97b','#f9ca24'][i % 4],
            opacity: 0.3 + Math.random() * 0.4,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float${i % 3} ${4 + Math.random() * 6}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 4}s`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes spinRev { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(-360deg); } }
        @keyframes spin { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
        @keyframes float0 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes float1 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-18px); } }
        @keyframes float2 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .landing-card { animation: slideUp 0.4s ease; }
        .landing-input:focus { outline: none; }
      `}</style>

      <div className="landing-card" style={{
        position: 'relative', zIndex: 10,
        width: 'min(440px, 95vw)',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg, #6c63ff, #ff6b6b)',
            marginBottom: 20, boxShadow: '0 8px 32px rgba(108,99,255,0.4)',
          }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M8 28 Q18 8 28 18 Q20 24 8 28Z" fill="white" opacity="0.9"/>
              <circle cx="26" cy="10" r="3" fill="white"/>
              <path d="M6 32 L10 30" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 }}>
            Draw<span style={{ color: 'var(--accent)' }}>Board</span>
          </div>
          <div style={{ color: 'var(--text2)', fontSize: 14, marginTop: 8, letterSpacing: '0.5px' }}>
            Real-time collaborative canvas
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16, padding: 32,
          boxShadow: 'var(--shadow)',
        }}>
          <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 20 }}>
            Choose a nickname to start drawing together
          </p>
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Your nickname..."
              value={nick}
              onChange={e => { setNick(e.target.value); setErr(''); }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              maxLength={24}
              autoFocus
              style={{ fontSize: 16, textAlign: 'center', padding: '14px' }}
            />
            {err && <div style={{ color: 'var(--accent2)', fontSize: 12, marginTop: 6 }}>{err}</div>}
          </div>
          <button className="btn btn-primary" onClick={submit}
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15 }}>
            Enter DrawBoard →
          </button>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            marginTop: 28, paddingTop: 24,
            borderTop: '1px solid var(--border)',
          }}>
            {[
              { icon: '✦', label: 'Multi-tool drawing' },
              { icon: '⬡', label: 'Live collaboration' },
              { icon: '◈', label: 'Persistent boards' },
            ].map(f => (
              <div key={f.label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ color: 'var(--accent)', fontSize: 18, marginBottom: 4 }}>{f.icon}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '0.3px' }}>{f.label}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 20 }}>
          No account needed · Open to everyone
        </p>
      </div>
    </div>
  );
}
