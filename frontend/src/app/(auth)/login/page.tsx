'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router  = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const [showPw,     setShowPw]     = useState(false);
  const [error,      setError]      = useState('');
  const [mounted,    setMounted]    = useState(false);

  // Detecta se é CPF (apenas números) para mostrar hint
  const isCpfMode = /^\d+$/.test(identifier.replace(/\D/g, '')) && identifier.replace(/\D/g, '').length >= 4;

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier || !password) { setError('Preencha os campos de acesso.'); return; }

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: identifier.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Credenciais inválidas.'); return; }

      setAuth(data.user, data.token, data.refreshToken, data.must_change_password);
      toast.success(`Bem-vindo(a), ${data.user.name.split(' ')[0]}!`);

      if (data.must_change_password) {
        router.push('/trocar-senha');
      } else if (data.user.role === 'FUNCIONARIO') {
        router.push('/meu-portal');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeInUp   { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeInDown { from { opacity:0; transform:translateY(-16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-glow { 0%,100%{ box-shadow:0 0 20px rgba(37,99,235,0.3); } 50%{ box-shadow:0 0 40px rgba(37,99,235,0.6); } }
        @keyframes float      { 0%,100%{ transform:translateY(0px); } 50%{ transform:translateY(-8px); } }
        @keyframes spin-slow  { from{ transform:rotate(0deg); } to{ transform:rotate(360deg); } }
        @keyframes shimmer    { 0%{ background-position:-200% center; } 100%{ background-position:200% center; } }
        .fade-up   { animation: fadeInUp 0.6s ease both; }
        .fade-down { animation: fadeInDown 0.5s ease both; }
        .logo-float { animation: float 4s ease-in-out infinite; }
        .logo-glow  { animation: pulse-glow 3s ease-in-out infinite; }
        .input-field {
          width:100%; box-sizing:border-box;
          background:rgba(255,255,255,0.07);
          border:1.5px solid rgba(255,255,255,0.12);
          border-radius:12px; padding:14px 16px;
          color:white; font-size:14px; outline:none;
          transition:all 0.3s ease;
        }
        .input-field:focus {
          border-color:rgba(99,179,237,0.7);
          background:rgba(255,255,255,0.1);
          box-shadow:0 0 0 3px rgba(66,153,225,0.15);
        }
        .input-field::placeholder { color:rgba(255,255,255,0.3); }
        .btn-login {
          width:100%; padding:14px;
          background:linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border:none; border-radius:12px;
          color:white; font-size:15px; font-weight:700;
          cursor:pointer; transition:all 0.3s ease;
          box-shadow:0 4px 20px rgba(37,99,235,0.4);
          letter-spacing:0.3px;
        }
        .btn-login:hover:not(:disabled) {
          transform:translateY(-2px);
          box-shadow:0 8px 30px rgba(37,99,235,0.5);
          background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        }
        .btn-login:active:not(:disabled) { transform:translateY(0); }
        .btn-login:disabled { opacity:0.7; cursor:not-allowed; }
        .credential-btn {
          display:block; width:100%; text-align:left;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
          border-radius:8px; padding:8px 12px;
          color:#94a3b8; font-size:12px; cursor:pointer;
          transition:all 0.2s; margin-bottom:4px;
        }
        .credential-btn:hover {
          background:rgba(37,99,235,0.15);
          border-color:rgba(37,99,235,0.4);
          color:#cbd5e1;
          transform:translateX(4px);
        }
        .particle {
          position:absolute; border-radius:50%;
          animation:float var(--dur) ease-in-out infinite;
          animation-delay:var(--delay);
        }
      `}</style>

      <div style={{
        minHeight:'100vh', position:'relative', overflow:'hidden',
        background:'linear-gradient(135deg, #0a0f1e 0%, #0d1b3e 40%, #111827 100%)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:'1rem',
      }}>
        {/* Partículas decorativas */}
        {mounted && [
          { size:300, x:'10%',  y:'15%',  dur:'8s',  delay:'0s',   opacity:0.04 },
          { size:200, x:'80%',  y:'70%',  dur:'10s', delay:'2s',   opacity:0.06 },
          { size:150, x:'60%',  y:'10%',  dur:'7s',  delay:'1s',   opacity:0.05 },
          { size:100, x:'20%',  y:'80%',  dur:'9s',  delay:'3s',   opacity:0.07 },
          { size:80,  x:'90%',  y:'20%',  dur:'6s',  delay:'0.5s', opacity:0.08 },
        ].map((p, i) => (
          <div key={i} className="particle" style={{
            width: p.size, height: p.size,
            left: p.x, top: p.y,
            background: `radial-gradient(circle, rgba(37,99,235,${p.opacity}) 0%, transparent 70%)`,
            ['--dur' as string]: p.dur, ['--delay' as string]: p.delay,
          }} />
        ))}

        {/* Linha decorativa top */}
        <div style={{
          position:'absolute', top:0, left:0, right:0, height:'3px',
          background:'linear-gradient(90deg, transparent, #2563eb, #60a5fa, #2563eb, transparent)',
        }} />

        <div style={{ width:'100%', maxWidth:'420px', position:'relative', zIndex:10 }}>

          {/* Logo + Nome da ONG */}
          <div className="fade-down" style={{ textAlign:'center', marginBottom:'2rem' }}>
            <div className="logo-glow" style={{
              display:'inline-flex', padding:'16px',
              background:'rgba(37,99,235,0.1)',
              borderRadius:'24px',
              border:'1px solid rgba(37,99,235,0.2)',
              marginBottom:'1.25rem',
            }}>
              <div className="logo-float">
                <Image
                  src="/logo-casca.png"
                  alt="EVO Gestão"
                  width={90}
                  height={102}
                  style={{ objectFit:'contain' }}
                  priority
                />
              </div>
            </div>
            <div>
              <h1 style={{
                color:'white', fontSize:'22px', fontWeight:800,
                letterSpacing:'-0.3px', margin:0,
                textShadow:'0 2px 20px rgba(99,179,237,0.3)',
              }}>
                C.A.S.C.A
              </h1>
              <p style={{
                fontSize:'11px', fontWeight:500, letterSpacing:'2px',
                color:'#60a5fa', textTransform:'uppercase', margin:'4px 0 0',
              }}>
                Sistema de Gestão Araucária
              </p>
            </div>
          </div>

          {/* Card de login */}
          <div className="fade-up" style={{
            background:'rgba(15,23,42,0.8)',
            backdropFilter:'blur(20px)',
            border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:'20px',
            padding:'2rem',
            boxShadow:'0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>

            <h2 style={{ color:'white', fontSize:'18px', fontWeight:700, margin:'0 0 6px', textAlign:'center' }}>
              Bem-vindo(a) de volta
            </h2>
            <p style={{ color:'#64748b', fontSize:'13px', textAlign:'center', margin:'0 0 1.5rem' }}>
              Faça login para acessar o sistema
            </p>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              {error && (
                <div style={{
                  background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
                  borderRadius:'10px', padding:'12px 14px',
                  color:'#fca5a5', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px',
                }}>
                  <span>⚠️</span> {error}
                </div>
              )}

              <div>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'12px', fontWeight:600, marginBottom:'8px', letterSpacing:'0.5px', textTransform:'uppercase' }}>
                  {isCpfMode ? '🪪 CPF (funcionário)' : 'Email'}
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Email ou CPF (somente números)"
                  autoComplete="username"
                  required
                  className="input-field"
                />
                {isCpfMode && (
                  <p style={{ color:'#60a5fa', fontSize:'11px', marginTop:'6px' }}>
                    🔑 Primeiro acesso? Sua senha inicial é o próprio CPF.
                  </p>
                )}
              </div>

              <div>
                <label style={{ display:'block', color:'#94a3b8', fontSize:'12px', fontWeight:600, marginBottom:'8px', letterSpacing:'0.5px', textTransform:'uppercase' }}>
                  Senha
                </label>
                <div style={{ position:'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="input-field"
                    style={{ paddingRight:'48px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{
                      position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)',
                      background:'none', border:'none', color:'#475569', cursor:'pointer',
                      fontSize:'16px', padding:'4px',
                    }}
                    aria-label={showPw ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-login" style={{ marginTop:'8px' }}>
                {loading ? (
                  <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                    <span style={{
                      display:'inline-block', width:'16px', height:'16px',
                      border:'2px solid rgba(255,255,255,0.3)',
                      borderTopColor:'white', borderRadius:'50%',
                      animation:'spin-slow 0.8s linear infinite',
                    }} />
                    Entrando...
                  </span>
                ) : '→ Entrar no Sistema'}
              </button>
            </form>
          </div>

          {/* Credenciais rápidas */}
          <div className="fade-up" style={{
            marginTop:'1.25rem',
            background:'rgba(255,255,255,0.02)',
            border:'1px solid rgba(255,255,255,0.06)',
            borderRadius:'14px', padding:'1rem',
            animationDelay:'0.2s',
          }}>
            <p style={{ color:'#475569', fontSize:'11px', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase', margin:'0 0 10px', textAlign:'center' }}>
              Acesso rápido (desenvolvimento)
            </p>
            {[
              ['lucas@evo.org.br',       'TI — Acesso total'],
              ['milene@evo.org.br',      'RH — Gestão de pessoal'],
              ['ti@ong.org.br',          'TI (compatibilidade)'],
              ['noemi@evo.org.br',       'Supervisora Noemi'],
            ].map(([em, label]) => (
              <button
                key={em}
                type="button"
                onClick={() => { setEmail(em); setPassword('Admin@123'); }}
                className="credential-btn"
              >
                <strong style={{ color:'#93c5fd' }}>{label}</strong>
                <span style={{ marginLeft:'6px', opacity:0.5 }}>{em}</span>
              </button>
            ))}
          </div>

          {/* Footer */}
          <p style={{ textAlign:'center', color:'#1e3a5f', fontSize:'11px', marginTop:'1.5rem' }}>
            EVO Gestão © {new Date().getFullYear()} · Araucária · PR
          </p>
          <div style={{ textAlign:'center', marginTop:'0.75rem' }}>
            <p style={{ fontSize:'10px', color:'#999', marginBottom:'4px' }}>Produzido por</p>
            <img src="/logo-elephant.png" alt="Elephant.Lab" style={{ height:'18px', opacity:0.55, filter:'grayscale(20%)' }} />
          </div>
        </div>
      </div>
    </>
  );
}
