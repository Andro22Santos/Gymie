import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Dumbbell, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

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
    if (password !== confirmPw) { setError('Senhas não conferem'); return; }
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
        {/* Back link */}
        <Link to="/login" className="flex items-center gap-1 text-txt-muted hover:text-txt-secondary mb-8 transition-colors">
          <ArrowLeft size={16} /> Voltar
        </Link>

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gymie/10 flex items-center justify-center mb-4">
            <Dumbbell className="text-gymie" size={32} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-txt-primary">Criar conta</h1>
          <p className="text-sm text-txt-muted mt-1">Comece sua jornada no Gymie</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div data-testid="signup-error" className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-gymie-sm text-danger text-sm p-3">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-txt-muted uppercase tracking-wider mb-2 block">Nome</label>
            <input
              data-testid="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full gymie-input"
              placeholder="Seu nome"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-txt-muted uppercase tracking-wider mb-2 block">Email</label>
            <input
              data-testid="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full gymie-input"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-txt-muted uppercase tracking-wider mb-2 block">Senha</label>
            <div className="relative">
              <input
                data-testid="signup-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full gymie-input pr-12"
                placeholder="Min. 6 caracteres"
              />
              <button 
                type="button" 
                onClick={() => setShowPw(!showPw)} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-secondary transition-colors"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-txt-muted uppercase tracking-wider mb-2 block">Confirmar Senha</label>
            <input
              data-testid="signup-confirm-password"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full gymie-input"
              placeholder="Repita a senha"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer py-2">
            <input
              data-testid="signup-terms"
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="w-5 h-5 rounded bg-surface-hl border-border-default accent-gymie mt-0.5"
            />
            <span className="text-xs text-txt-secondary leading-relaxed">
              Aceito os termos de uso e política de privacidade do Gymie
            </span>
          </label>

          <button
            data-testid="signup-submit"
            type="submit"
            disabled={loading}
            className="w-full gymie-btn-primary flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Criando...
              </>
            ) : (
              'Criar conta'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link data-testid="login-link" to="/login" className="text-sm text-txt-muted hover:text-gymie transition-colors">
            Já tenho conta
          </Link>
        </div>
      </div>
    </div>
  );
}
