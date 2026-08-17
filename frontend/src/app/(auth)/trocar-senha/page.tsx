'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TrocarSenhaPage() {
  const router = useRouter();
  const { token, user, logout } = useAuthStore();
  const [form, setForm] = useState({ current: '', newPw: '', confirm: '' });
  const [show, setShow] = useState({ current: false, newPw: false, confirm: false });
  const [loading, setLoading] = useState(false);

  const strength = (() => {
    const p = form.newPw;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthLabel = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'][strength];
  const strengthColor = ['#ef4444','#f97316','#eab308','#22c55e','#16a34a'][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPw !== form.confirm) { toast.error('Senhas não coincidem.'); return; }
    if (form.newPw.length < 8) { toast.error('Mínimo 8 caracteres.'); return; }
    if (form.newPw === form.current) { toast.error('Nova senha deve ser diferente da atual.'); return; }

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.newPw }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao trocar senha.'); return; }

      // Marca must_change_password como false no store
      useAuthStore.setState({ mustChangePassword: false });
      toast.success('Senha alterada com sucesso!');

      if (user?.role === 'FUNCIONARIO') {
        router.push('/meu-portal');
      } else {
        router.push('/dashboard');
      }
    } catch {
      toast.error('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-md">
        <div className="card p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: '#eff6ff', border: '2px solid #bfdbfe' }}>
              <Lock className="w-8 h-8" style={{ color: '#2563eb' }} />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Troque sua senha
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Por segurança, é necessário criar uma nova senha no primeiro acesso.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Senha atual */}
            {[
              { key: 'current', label: 'Senha atual (CPF)', placeholder: 'Digite sua senha atual' },
              { key: 'newPw',   label: 'Nova senha',        placeholder: 'Mínimo 8 caracteres' },
              { key: 'confirm', label: 'Confirmar nova senha', placeholder: 'Repita a nova senha' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <div className="relative">
                  <input
                    type={show[key as keyof typeof show] ? 'text' : 'password'}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="input pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow(s => ({ ...s, [key]: !s[key as keyof typeof show] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {show[key as keyof typeof show] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Força da senha */}
                {key === 'newPw' && form.newPw && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ background: i <= strength ? strengthColor : 'var(--border)' }} />
                      ))}
                    </div>
                    <p className="text-xs" style={{ color: strengthColor }}>{strengthLabel}</p>
                  </div>
                )}
              </div>
            ))}

            {/* Requisitos */}
            <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
              {[
                { ok: form.newPw.length >= 8,         text: 'Mínimo 8 caracteres' },
                { ok: /[A-Z]/.test(form.newPw),       text: 'Uma letra maiúscula' },
                { ok: /[0-9]/.test(form.newPw),       text: 'Um número' },
              ].map(({ ok, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: ok ? '#22c55e' : 'var(--text-muted)' }} />
                  <span style={{ color: ok ? 'var(--text-primary)' : 'var(--text-muted)' }}>{text}</span>
                </div>
              ))}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>

          <button
            onClick={() => { logout(); router.push('/login'); }}
            className="mt-4 w-full text-center text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            Sair e voltar ao login
          </button>
        </div>
      </div>
    </div>
  );
}
