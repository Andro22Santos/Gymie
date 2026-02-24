import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Target, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password || !confirmPw) { setError('Preencha todos os campos'); return; }
    if (password !== confirmPw) { setError('Senhas nao conferem'); return; }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres'); return; }
    if (!terms) { setError('Aceite os termos para continuar'); return; }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/onboarding');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex items-center justify-center mb-8">
          <Target className="text-tactical mr-3" size={28} strokeWidth={1.5} />
          <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Criar Conta</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div data-testid="signup-error" className="flex items-center gap-2 bg-danger/10 border border-danger/30 text-danger text-sm p-3">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="font-heading text-xs uppercase tracking-wider text-txt-secondary mb-1.5 block">Nome</label>
            <input
              data-testid="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface border border-border-default text-txt-primary placeholder:text-txt-muted focus:border-tactical focus:ring-1 focus:ring-tactical px-4 py-3 outline-none transition-all"
              placeholder="Seu nome"
            />
          </div>

          <div>
            <label className="font-heading text-xs uppercase tracking-wider text-txt-secondary mb-1.5 block">Email</label>
            <input
              data-testid="signup-email"
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
                data-testid="signup-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface border border-border-default text-txt-primary placeholder:text-txt-muted focus:border-tactical focus:ring-1 focus:ring-tactical px-4 py-3 pr-12 outline-none transition-all"
                placeholder="Min. 6 caracteres"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-secondary">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="font-heading text-xs uppercase tracking-wider text-txt-secondary mb-1.5 block">Confirmar Senha</label>
            <input
              data-testid="signup-confirm-password"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full bg-surface border border-border-default text-txt-primary placeholder:text-txt-muted focus:border-tactical focus:ring-1 focus:ring-tactical px-4 py-3 outline-none transition-all"
              placeholder="Repita a senha"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              data-testid="signup-terms"
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="w-4 h-4 accent-tactical"
            />
            <span className="text-xs text-txt-secondary">Aceito os termos de uso e politica de privacidade</span>
          </label>

          <button
            data-testid="signup-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-tactical text-black font-bold uppercase tracking-wider py-3.5 hover:bg-tactical-dim active:scale-[0.98] transition-all disabled:opacity-50"
            style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
          >
            {loading ? 'Criando...' : 'Criar Conta'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link data-testid="login-link" to="/login" className="text-sm text-txt-secondary hover:text-tactical transition-colors">
            Ja tenho conta
          </Link>
        </div>
      </div>
    </div>
  );
}
