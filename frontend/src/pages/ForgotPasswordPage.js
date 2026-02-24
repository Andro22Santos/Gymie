import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Target, Mail, CheckCircle, AlertCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { setError('Informe seu email'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setSent(true);
      else setError('Erro ao enviar. Tente novamente.');
    } catch {
      setError('Erro de conexao.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex items-center justify-center mb-8">
          <Target className="text-tactical mr-3" size={28} strokeWidth={1.5} />
          <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Recuperar Senha</h1>
        </div>

        {sent ? (
          <div data-testid="forgot-success" className="text-center space-y-4">
            <CheckCircle className="text-tactical mx-auto" size={48} />
            <p className="text-txt-secondary">Se o email existir, enviaremos instrucoes de recuperacao.</p>
            <Link to="/login" className="text-tactical hover:text-tactical-dim text-sm font-semibold block mt-4">
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div data-testid="forgot-error" className="flex items-center gap-2 bg-danger/10 border border-danger/30 text-danger text-sm p-3">
                <AlertCircle size={16} /> {error}
              </div>
            )}
            <p className="text-sm text-txt-secondary">Informe seu email para receber instrucoes de recuperacao.</p>
            <div>
              <label className="font-heading text-xs uppercase tracking-wider text-txt-secondary mb-1.5 block">Email</label>
              <div className="relative">
                <input
                  data-testid="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface border border-border-default text-txt-primary placeholder:text-txt-muted focus:border-tactical focus:ring-1 focus:ring-tactical px-4 py-3 pl-10 outline-none transition-all"
                  placeholder="seu@email.com"
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" size={16} />
              </div>
            </div>

            <button
              data-testid="forgot-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-tactical text-black font-bold uppercase tracking-wider py-3.5 hover:bg-tactical-dim active:scale-[0.98] transition-all disabled:opacity-50"
              style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
            >
              {loading ? 'Enviando...' : 'Enviar'}
            </button>

            <Link to="/login" className="text-sm text-txt-secondary hover:text-tactical transition-colors block text-center">
              Voltar ao login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
