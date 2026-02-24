import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import { Send, Loader2, UtensilsCrossed, Dumbbell, MessageSquare, Brain, TrendingUp, Camera, Zap } from 'lucide-react';

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-tactical font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

const MODES = [
  { id: 'companion', label: 'Companheiro', icon: MessageSquare, color: '#D4FF00' },
  { id: 'nutrition', label: 'Alimentacao', icon: UtensilsCrossed, color: '#FF9500' },
  { id: 'workout', label: 'Treino', icon: Dumbbell, color: '#A855F7' },
];

const AGENT_ICONS = {
  companion: MessageSquare,
  nutrition: UtensilsCrossed,
  workout: Dumbbell,
  analysis: TrendingUp,
  photo: Camera,
};

const QUICK_SUGGESTIONS = [
  'Como estao meus macros?',
  'Sugestao de refeicao agora',
  'Analise meu progresso',
  'Dica pro treino de hoje',
  'Preciso de motivacao',
];

export default function ChatPage() {
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('companion');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchThreads = useCallback(async () => {
    try {
      const [threadsRes, agentsRes] = await Promise.all([
        api.get('/api/chat/threads'),
        api.get('/api/agents'),
      ]);
      const t = threadsRes.data.threads || [];
      setThreads(t);
      setAgents(agentsRes.data.agents || []);
      if (t.length > 0) {
        setActiveThread(t[0].id);
      } else {
        const newThread = await api.post('/api/chat/threads');
        setThreads([newThread.data]);
        setActiveThread(newThread.data.id);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  useEffect(() => {
    if (activeThread) {
      api.get(`/api/chat/threads/${activeThread}/messages`).then((res) => {
        setMessages(res.data.messages || []);
        setTimeout(scrollToBottom, 100);
      });
    }
  }, [activeThread]);

  const sendMessage = async (text) => {
    if (!text.trim() || sending || !activeThread) return;
    const msgText = text.trim();
    setInput('');
    setSending(true);

    const tempUserMsg = { id: 'temp-user', role: 'user', content: msgText, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, tempUserMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await api.post(`/api/chat/threads/${activeThread}/messages`, {
        content: msgText,
        mode,
      });
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== 'temp-user'),
        res.data.user_message,
        res.data.ai_message,
      ]);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== 'temp-user'));
      console.error(err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-10 h-10 border-2 border-tactical border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Mode Chips */}
      <div className="px-4 pt-4 pb-2 flex gap-2 border-b border-border-default bg-bg/90 backdrop-blur">
        {MODES.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              data-testid={`chat-mode-${m.id}`}
              onClick={() => setMode(m.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-ui uppercase tracking-wider transition-all border"
              style={mode === m.id ? { borderColor: m.color, background: `${m.color}15`, color: m.color } : { borderColor: '#27272A', color: '#52525B' }}
            >
              <Icon size={12} strokeWidth={1.5} /> {m.label}
            </button>
          );
        })}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="flex justify-center gap-3 mb-4">
              {agents.filter(a => a.id !== 'photo').map((a) => {
                const Icon = AGENT_ICONS[a.id] || Brain;
                return (
                  <div key={a.id} className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 border flex items-center justify-center" style={{ borderColor: `${a.color}40`, background: `${a.color}10` }}>
                      <Icon size={16} style={{ color: a.color }} strokeWidth={1.5} />
                    </div>
                    <span className="text-[9px] font-ui uppercase tracking-wider text-txt-muted">{a.name}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-txt-secondary mb-1">Agentes especializados com contexto compartilhado</p>
            <p className="text-[10px] text-txt-muted">Cada agente conhece seu perfil, rotina e insights dos outros agentes.</p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const agentColor = msg.agent_color || '#D4FF00';
          const AgentIcon = AGENT_ICONS[msg.agent_id] || MessageSquare;

          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className="max-w-[85%]">
                {/* Agent badge for AI messages */}
                {!isUser && msg.agent_name && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <AgentIcon size={10} style={{ color: agentColor }} strokeWidth={2} />
                    <span className="text-[9px] font-ui uppercase tracking-wider" style={{ color: agentColor }}>
                      {msg.agent_code || 'AI'}
                    </span>
                    <span className="text-[9px] text-txt-muted">| {msg.agent_name}</span>
                  </div>
                )}
                <div
                  data-testid={`chat-msg-${msg.role}`}
                  className={`px-4 py-3 ${isUser
                    ? 'bg-tactical/15 border border-tactical/30 text-txt-primary'
                    : 'bg-surface border text-txt-primary'
                  }`}
                  style={!isUser ? { borderColor: `${agentColor}25` } : {}}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  <p className="font-data text-[10px] text-txt-muted mt-2">
                    {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-surface border border-border-default px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="text-tactical animate-spin" />
              <span className="text-xs text-txt-muted flex items-center gap-1">
                <Zap size={10} className="text-tactical" /> Agente processando...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {messages.length === 0 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          {QUICK_SUGGESTIONS.map((s) => (
            <button
              key={s}
              data-testid="quick-suggestion"
              onClick={() => sendMessage(s)}
              className="whitespace-nowrap px-3 py-1.5 text-xs border border-border-default text-txt-secondary hover:border-tactical hover:text-tactical transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-border-default bg-bg/90 backdrop-blur">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-surface border border-border-default text-txt-primary placeholder:text-txt-muted focus:border-tactical px-4 py-2.5 outline-none resize-none text-sm max-h-24"
            style={{ minHeight: '42px' }}
          />
          <button
            data-testid="chat-send"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="bg-tactical text-black p-2.5 hover:bg-tactical-dim active:scale-95 transition-all disabled:opacity-30"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
