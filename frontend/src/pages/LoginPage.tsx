import { ArrowRight } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const VALID_EMAIL_DOMAIN = '@precisely.com';

const RECTS = [
  { top: '7%',    left: '4%',   size: 80, rotate: 15,  delay: '0s'   },
  { top: '18%',   right: '7%',  size: 50, rotate: 30,  delay: '0.7s' },
  { bottom: '10%', left: '6%', size: 60,  rotate: -20, delay: '1.4s' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* card entrance — trigger on mount */
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  /* error appear/disappear with CSS transition */
  useEffect(() => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
    if (error) {
      /* tiny delay so element is in DOM before opacity transition fires */
      errorTimer.current = setTimeout(() => setErrorVisible(true), 16);
    } else {
      setErrorVisible(false);
    }
    return () => { if (errorTimer.current) clearTimeout(errorTimer.current); };
  }, [error]);

  const validateEmail = (value: string): string | null => {
    const v = value.trim();
    if (!v) return 'Enter your e-mail address.';
    if (!v.endsWith(VALID_EMAIL_DOMAIN)) return `E-mail must end with ${VALID_EMAIL_DOMAIN}`;
    return null;
  };

  const handleBlur = () => {
    setFocused(false);
    setError(validateEmail(email));
  };

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateEmail(email);
    if (validationError) { setError(validationError); return; }
    setError(null);
    setLoading(true);
    try {
      await login(email.trim());
      navigate('/dashboard');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 18px',
    borderRadius: 12,
    background: focused ? 'rgba(157,0,255,0.10)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${
      error && !focused
        ? 'rgba(255,80,80,0.60)'
        : focused
          ? 'rgba(157,0,255,0.70)'
          : 'rgba(255,255,255,0.10)'
    }`,
    boxShadow: focused ? '0 0 0 3px rgba(157,0,255,0.15)' : 'none',
    color: '#ffffff',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.25s, background 0.25s, box-shadow 0.25s',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap');

        @keyframes orb-drift {
          0%,100% { transform: translate(0,0) scale(1); }
          25%      { transform: translate(30px,-20px) scale(1.05); }
          50%      { transform: translate(-20px,30px) scale(0.95); }
          75%      { transform: translate(20px,20px) scale(1.03); }
        }
        @keyframes float {
          0%,100% { transform: translateY(0px)   rotate(var(--r,0deg)); }
          33%      { transform: translateY(-12px) rotate(calc(var(--r,0deg) + 1deg)); }
          66%      { transform: translateY(-6px)  rotate(calc(var(--r,0deg) - 1deg)); }
        }
        @keyframes login-neon-border {
          0%,100% {
            border-color: rgba(157,0,255,0.22);
            box-shadow: 0 0 100px rgba(100,0,200,0.22), 0 40px 80px rgba(0,0,0,0.55);
          }
          50% {
            border-color: rgba(191,63,255,0.45);
            box-shadow: 0 0 120px rgba(157,0,255,0.32), 0 40px 80px rgba(0,0,0,0.55);
          }
        }

        .login-card {
          animation: login-neon-border 4s ease-in-out infinite;
          transition: opacity 0.65s cubic-bezier(0.16,1,0.3,1),
                      transform 0.65s cubic-bezier(0.16,1,0.3,1);
        }
        .login-card.hidden {
          opacity: 0;
          transform: translateY(40px) scale(0.96);
        }
        .login-card.visible {
          opacity: 1;
          transform: translateY(0px) scale(1);
        }

        .login-error {
          color: #ff6b6b;
          font-size: 12px;
          padding-left: 4px;
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          margin-top: 0;
          transition: max-height 0.22s ease, opacity 0.22s ease, margin-top 0.22s ease;
        }
        .login-error.visible {
          max-height: 40px;
          opacity: 1;
          margin-top: 5px;
        }

        .login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          margin-top: 28px;
          padding: 13px 52px;
          border-radius: 30px;
          background: linear-gradient(135deg, #9d00ff, #bf3fff);
          border: none;
          color: #ffffff;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 4px 22px rgba(157,0,255,0.50);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          font-family: 'Syne', sans-serif;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(157,0,255,0.65);
        }
        .login-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
      `}</style>

      <main style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0d0118 0%, #1a0533 45%, #2a0b4e 100%)',
        overflow: 'hidden',
        fontFamily: "'Syne', ui-sans-serif, system-ui, sans-serif",
      }}>

        {/* ambient orbs */}
        <div style={{
          position: 'absolute', width: 380, height: 380, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(157,0,255,0.14) 0%, transparent 70%)',
          top: -80, left: -80, pointerEvents: 'none',
          animation: 'orb-drift 12s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(120,0,220,0.12) 0%, transparent 70%)',
          bottom: -60, right: -60, pointerEvents: 'none',
          animation: 'orb-drift 16s ease-in-out infinite reverse',
        }} />

        {/* floating rectangles */}
        {RECTS.map((r, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: (r as any).top, left: (r as any).left,
            right: (r as any).right, bottom: (r as any).bottom,
            width: r.size, height: r.size,
            border: '1.5px solid rgba(157,0,255,0.20)',
            borderRadius: 10,
            animation: `float ${6 + i * 2}s ease-in-out infinite ${r.delay}`,
            pointerEvents: 'none',
            ['--r' as string]: `${r.rotate}deg`,
          }} />
        ))}

        {/* card */}
        <section
          className={`login-card ${visible ? 'visible' : 'hidden'}`}
          style={{
            width: '100%',
            maxWidth: 480,
            margin: '0 16px',
            borderRadius: 22,
            overflow: 'hidden',
            background: 'rgba(18, 3, 38, 0.78)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            padding: '56px 48px 48px',
            position: 'relative',
          }}
        >
          {/* inner shimmer */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)',
            borderRadius: '22px 22px 0 0', pointerEvents: 'none',
          }} />

          {/* brand */}
          <div style={{
            position: 'absolute', top: 20, left: 26, zIndex: 10,
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: 18, color: '#ffffff', letterSpacing: '0.04em',
          }}>
            KUP50
          </div>

          {/* heading */}
          <p style={{ color: '#ffffff', fontSize: 26, fontWeight: 700, marginBottom: 8, fontFamily: "'Syne', sans-serif" }}>
            Welcome 
          </p>
   

          {/* form */}
          <form onSubmit={handleLogin} noValidate>
            <label>
              <span style={{
                display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 12,
                fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
              }}>
                Email
              </span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                placeholder="name@precisely.com"
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={handleBlur}
                style={inputStyle}
              />
            </label>

            <p className={`login-error ${errorVisible ? 'visible' : ''}`}>
              {error}
            </p>

            <button type="submit" disabled={loading} className="login-btn">
              {loading ? 'Signing in…' : 'SIGN IN'}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>

        </section>
      </main>
    </>
  );
}