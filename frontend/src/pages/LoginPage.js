import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Target, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Preencha todos os campos'); return; }
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.onboarding_completed) navigate('/');
      else navigate('/onboarding');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex items-center justify-center mb-10">
          <div className="w-14 h-14 border-2 border-tactical flex items-center justify-center mr-3" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
            <Target className="text-tactical" size={28} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-txt-primary">Shape</h1>
            <p className="font-ui text-xs tracking-widest uppercase text-tactical">Inexplicavel</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div data-testid="login-error" className="flex items-center gap-2 bg-danger/10 border border-danger/30 text-danger text-sm p-3">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="font-heading text-xs uppercase tracking-wider text-txt-secondary mb-1.5 block">Email</label>
            <input
              data-testid="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-border-default text-txt-primary placeholder:text-txt-muted focus:border-tactical focus:ring-1 focus:ring-tactical px-4 py-3 outline-none transition-all"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="font-heading text-xs uppercase tracking-wider text-txt-secondary mb-1.5 block">Senha</label>
            <div className="relative">
              <input
                data-testid="login-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface border border-border-default text-txt-primary placeholder:text-txt-muted focus:border-tactical focus:ring-1 focus:ring-tactical px-4 py-3 pr-12 outline-none transition-all"
                placeholder="Sua senha"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-secondary">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            data-testid="login-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-tactical text-black font-bold uppercase tracking-wider py-3.5 hover:bg-tactical-dim active:scale-[0.98] transition-all disabled:opacity-50"
            style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <Link data-testid="forgot-password-link" to="/forgot-password" className="text-sm text-txt-secondary hover:text-tactical transition-colors block">
            Esqueci minha senha
          </Link>
          <Link data-testid="signup-link" to="/signup" className="text-sm text-tactical hover:text-tactical-dim transition-colors block font-semibold">
            Criar conta
          </Link>
        </div>
      </div>
    </div>
  );
}
