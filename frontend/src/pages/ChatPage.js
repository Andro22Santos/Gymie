import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import { 
  Send, Loader2, UtensilsCrossed, Dumbbell, MessageSquare, 
  TrendingUp, Camera, Droplet, Target, Flame, ChevronDown,
  Sparkles, Check, Clock
} from 'lucide-react';

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gymie font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

const MODES = [
  { id: 'companion', label: 'Gymie', icon: MessageSquare, color: '#F5A623', desc: 'Motivação e rotina' },
  { id: 'nutrition', label: 'Alimentação', icon: UtensilsCrossed, color: '#FB923C', desc: 'Refeições e macros' },
  { id: 'workout', label: 'Treino', icon: Dumbbell, color: '#A855F7', desc: 'Exercícios e carga' },
];

const ICON_MAP = {
  companion: MessageSquare,
  nutrition: UtensilsCrossed,
  workout: Dumbbell,
  analysis: TrendingUp,
  photo: Camera,
};

const QUICK_ACTIONS = [
  { label: 'Meus macros', icon: Flame },
  { label: 'Sugerir refeição', icon: UtensilsCrossed },
  { label: 'Dica pro treino', icon: Dumbbell },
  { label: 'Motivação', icon: Sparkles },
];

export default function ChatPage() {
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('companion');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contextSummary, setContextSummary] = useState(null);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchData = useCallback(async () => {
    try {
      const [threadsRes, insightsRes] = await Promise.all([
        api.get('/api/chat/threads'),
        api.get('/api/agents/insights'),
      ]);
      const t = threadsRes.data.threads || [];
      setThreads(t);
      setContextSummary(insightsRes.data.context_summary || null);
      
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

  useEffect(() => { fetchData(); }, [fetchData]);

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
      
      // Refresh context
      const insightsRes = await api.get('/api/agents/insights');
      setContextSummary(insightsRes.data.context_summary || null);
      
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

  const currentMode = MODES.find(m => m.id === mode) || MODES[0];
  const ModeIcon = currentMode.icon;

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-8 h-8 border-2 border-gymie border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-md mx-auto">
      {/* Header with Context Bar */}
      <div className="px-4 pt-3 pb-2 bg-bg/95 backdrop-blur-lg border-b border-border-subtle sticky top-0 z-10">
        {/* Context Summary Bar */}
        {contextSummary && (
          <div className="flex items-center gap-3 mb-3 py-2 px-3 bg-surface rounded-gymie-sm">
            <div className="flex items-center gap-1.5">
              <Droplet size={12} className="text-sky-400" />
              <span className="text-[11px] font-data text-txt-secondary">{contextSummary.water_pct}%</span>
            </div>
            <div className="w-px h-3 bg-border-default" />
            <div className="flex items-center gap-1.5">
              <Flame size={12} className="text-gymie" />
              <span className="text-[11px] font-data text-txt-secondary">{contextSummary.calories_pct}%</span>
            </div>
            <div className="w-px h-3 bg-border-default" />
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-info" />
              <span className="text-[11px] font-data text-txt-secondary">{contextSummary.protein_pct}%</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              {contextSummary.has_workout && <Dumbbell size={10} className="text-success" />}
              {contextSummary.has_checkin && <Check size={10} className="text-success" />}
            </div>
          </div>
        )}

        {/* Mode Selector */}
        <button 
          onClick={() => setShowModeSelector(!showModeSelector)}
          className="w-full flex items-center gap-3 p-2 rounded-gymie-sm hover:bg-surface-hl transition-colors"
        >
          <div 
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${currentMode.color}15` }}
          >
            <ModeIcon size={16} style={{ color: currentMode.color }} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-txt-primary">Modo: {currentMode.label}</p>
            <p className="text-[10px] text-txt-muted">{currentMode.desc}</p>
          </div>
          <ChevronDown 
            size={18} 
            className={`text-txt-muted transition-transform ${showModeSelector ? 'rotate-180' : ''}`} 
          />
        </button>

        {/* Mode Options */}
        {showModeSelector && (
          <div className="mt-2 p-2 bg-surface rounded-gymie border border-border-subtle animate-scale-in">
            {MODES.map((m) => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              return (
                <button
                  key={m.id}
                  data-testid={`chat-mode-${m.id}`}
                  onClick={() => { setMode(m.id); setShowModeSelector(false); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-gymie-sm transition-all ${
                    isActive ? 'bg-surface-hl' : 'hover:bg-surface-hl'
                  }`}
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${m.color}15` }}
                  >
                    <Icon size={14} style={{ color: m.color }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-txt-primary">{m.label}</p>
                    <p className="text-[10px] text-txt-muted">{m.desc}</p>
                  </div>
                  {isActive && <Check size={16} style={{ color: m.color }} />}
                </button>
              );
            })}
            <p className="text-[10px] text-txt-muted text-center mt-2 px-2">
              Todos os modos compartilham seu contexto
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4 animate-pulse-glow"
              style={{ backgroundColor: `${currentMode.color}10` }}
            >
              <ModeIcon size={32} style={{ color: currentMode.color }} />
            </div>
            <h3 className="text-lg font-semibold text-txt-primary mb-1">
              Olá! Sou o Gymie
            </h3>
            <p className="text-sm text-txt-muted text-center max-w-[280px]">
              Seu companheiro de rotina. Pergunte sobre treino, alimentação ou peça motivação.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const agentColor = msg.agent_color || currentMode.color;
          const AgentIcon = ICON_MAP[msg.agent_id] || MessageSquare;

          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className="max-w-[85%]">
                {/* AI badge */}
                {!isUser && (
                  <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                    <AgentIcon size={10} style={{ color: agentColor }} />
                    <span className="text-[10px] text-txt-muted">
                      {msg.agent_name || 'Gymie'}
                    </span>
                  </div>
                )}
                <div className={isUser ? 'msg-user' : 'msg-ai'} style={{ padding: '12px 16px' }}>
                  <p 
                    className="text-sm leading-relaxed text-txt-primary" 
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} 
                  />
                  <p className="text-[10px] text-txt-muted mt-2 font-data">
                    {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex justify-start animate-fade-in">
            <div className="msg-ai px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" style={{ color: currentMode.color }} />
              <span className="text-xs text-txt-muted">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {QUICK_ACTIONS.map((a, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(a.label)}
                className="gymie-chip whitespace-nowrap touch-feedback"
              >
                <a.icon size={12} className="text-gymie" />
                <span className="text-txt-secondary">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-bg/95 backdrop-blur-lg border-t border-border-subtle pb-safe">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Digite sua mensagem..."
            className="flex-1 gymie-input resize-none text-sm"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            data-testid="chat-send"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="gymie-btn-primary p-3 disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
