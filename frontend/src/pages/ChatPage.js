import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import { Send, Loader2, UtensilsCrossed, Dumbbell, MessageSquare, TrendingUp, Camera, Zap, Droplet, Target, Smile, Bug, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-tactical font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

const MODES = [
  { id: 'companion', label: 'Companheiro', icon: MessageSquare, color: '#D4FF00', desc: 'Motivacao e rotina' },
  { id: 'nutrition', label: 'Alimentacao', icon: UtensilsCrossed, color: '#FF9500', desc: 'Refeicoes e macros' },
  { id: 'workout', label: 'Treino', icon: Dumbbell, color: '#A855F7', desc: 'Exercicios e carga' },
];

const ICON_MAP = {
  companion: MessageSquare,
  nutrition: UtensilsCrossed,
  workout: Dumbbell,
  analysis: TrendingUp,
  photo: Camera,
  droplet: Droplet,
  utensils: UtensilsCrossed,
  dumbbell: Dumbbell,
  target: Target,
  smile: Smile,
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
  const [actionableInsights, setActionableInsights] = useState([]);
  const [debugMode, setDebugMode] = useState(false);
  const [debugData, setDebugData] = useState(null);
  const [showInsights, setShowInsights] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchThreads = useCallback(async () => {
    try {
      const [threadsRes, insightsRes] = await Promise.all([
        api.get('/api/chat/threads'),
        api.get('/api/agents/insights'),
      ]);
      const t = threadsRes.data.threads || [];
      setThreads(t);
      setActionableInsights(insightsRes.data.actionable || []);
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

  // Fetch debug data when debug mode is enabled
  useEffect(() => {
    if (debugMode) {
      api.get('/api/agents/debug').then((res) => {
        setDebugData(res.data);
      }).catch(console.error);
    }
  }, [debugMode, messages]);

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
      
      // Refresh insights after conversation
      const insightsRes = await api.get('/api/agents/insights');
      setActionableInsights(insightsRes.data.actionable || []);
      
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
      <div className="w-10 h-10 border-2 border-tactical border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Active Mode Header */}
      <div className="px-4 pt-3 pb-2 border-b border-border-default bg-bg/95 backdrop-blur">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div 
              className="w-8 h-8 flex items-center justify-center border"
              style={{ borderColor: `${currentMode.color}40`, background: `${currentMode.color}10` }}
            >
              <ModeIcon size={14} style={{ color: currentMode.color }} strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-ui uppercase tracking-widest text-txt-muted">Modo:</span>
                <span 
                  data-testid="current-mode-label"
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: currentMode.color }}
                >
                  {currentMode.label}
                </span>
              </div>
              <p className="text-[9px] text-txt-muted">{currentMode.desc}</p>
            </div>
          </div>
          
          {/* Debug Toggle */}
          <button
            data-testid="debug-toggle"
            onClick={() => setDebugMode(!debugMode)}
            className={`p-1.5 border transition-all ${debugMode ? 'border-tactical bg-tactical/10 text-tactical' : 'border-border-default text-txt-muted hover:border-txt-muted'}`}
            title="Debug Mode"
          >
            <Bug size={14} />
          </button>
        </div>
        
        {/* Mode Selector */}
        <div className="flex gap-1.5">
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                data-testid={`chat-mode-${m.id}`}
                onClick={() => setMode(m.id)}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-ui uppercase tracking-wider transition-all border"
                style={isActive 
                  ? { borderColor: m.color, background: `${m.color}15`, color: m.color } 
                  : { borderColor: '#27272A', color: '#52525B' }
                }
              >
                <Icon size={10} strokeWidth={isActive ? 2 : 1.5} /> {m.label}
              </button>
            );
          })}
        </div>
        
        {/* Context Note */}
        <p className="text-[9px] text-txt-muted mt-2 flex items-center gap-1">
          <Zap size={8} className="text-tactical" />
          Todos os modos compartilham seu contexto: perfil, refeicoes, treinos e insights.
        </p>
      </div>

      {/* Debug Panel */}
      {debugMode && debugData && (
        <div data-testid="debug-panel" className="px-4 py-2 bg-surface-hl border-b border-border-default text-[10px] font-mono">
          <div className="flex items-center justify-between mb-1">
            <span className="text-tactical uppercase tracking-wider font-bold">Debug: Orquestracao</span>
            <span className="text-txt-muted">{debugData.timestamp?.slice(11, 19)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-txt-secondary">
            <div>
              <span className="text-txt-muted">Status:</span> {debugData.orchestration_status}
            </div>
            <div>
              <span className="text-txt-muted">Fallback:</span> {debugData.fallback_agent}
            </div>
            <div>
              <span className="text-txt-muted">Persona:</span> {debugData.context_loaded?.persona_style}
            </div>
            <div>
              <span className="text-txt-muted">Fatos:</span> {debugData.context_loaded?.memory_facts_count}
            </div>
          </div>
          {debugData.recent_decisions?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border-default">
              <span className="text-txt-muted">Ultimas decisoes:</span>
              {debugData.recent_decisions.slice(0, 2).map((d, i) => (
                <div key={i} className="flex items-center gap-2 mt-1">
                  <span className="text-tactical">[{d.agent_routed}]</span>
                  <span className="text-txt-secondary truncate">{d.message_preview}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actionable Insights */}
      {actionableInsights.length > 0 && messages.length === 0 && (
        <div className="px-4 py-2 border-b border-border-default bg-surface/50">
          <button 
            onClick={() => setShowInsights(!showInsights)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-1.5">
              <AlertCircle size={12} className="text-tactical" />
              <span className="text-[10px] font-ui uppercase tracking-wider text-txt-secondary">
                Insights Acionaveis ({actionableInsights.length})
              </span>
            </div>
            {showInsights ? <ChevronUp size={12} className="text-txt-muted" /> : <ChevronDown size={12} className="text-txt-muted" />}
          </button>
          
          {showInsights && (
            <div data-testid="actionable-insights" className="mt-2 space-y-1.5">
              {actionableInsights.map((insight, idx) => {
                const InsightIcon = ICON_MAP[insight.icon] || Target;
                return (
                  <div 
                    key={idx}
                    data-testid={`insight-${insight.type}`}
                    className="flex items-center gap-2 p-2 border"
                    style={{ borderColor: `${insight.color}30`, background: `${insight.color}08` }}
                  >
                    <InsightIcon size={14} style={{ color: insight.color }} strokeWidth={1.5} />
                    <span className="text-xs text-txt-primary flex-1">{insight.message}</span>
                    {insight.priority === 'high' && (
                      <span className="text-[8px] font-bold uppercase px-1 py-0.5 bg-danger/20 text-danger">
                        Prioridade
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div 
              className="w-16 h-16 mx-auto mb-4 border-2 flex items-center justify-center"
              style={{ borderColor: `${currentMode.color}30`, background: `${currentMode.color}08` }}
            >
              <ModeIcon size={28} style={{ color: currentMode.color }} strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-heading uppercase tracking-tight text-txt-primary mb-1">
              Modo {currentMode.label}
            </h3>
            <p className="text-xs text-txt-muted max-w-xs mx-auto">
              {mode === 'companion' && 'Converse sobre sua rotina, receba motivacao e acompanhe seu dia.'}
              {mode === 'nutrition' && 'Tire duvidas sobre refeicoes, macros e planejamento alimentar.'}
              {mode === 'workout' && 'Pergunte sobre treinos, progressao de carga e recuperacao.'}
            </p>
            <p className="text-[10px] text-txt-muted mt-3 flex items-center justify-center gap-1">
              <Zap size={10} className="text-tactical" />
              Contexto compartilhado entre todos os modos
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
                {/* Mode indicator for AI messages */}
                {!isUser && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <AgentIcon size={10} style={{ color: agentColor }} strokeWidth={2} />
                    <span className="text-[9px] font-ui uppercase tracking-wider text-txt-muted">
                      Modo: <span style={{ color: agentColor }}>{msg.agent_name || currentMode.label}</span>
                    </span>
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
              <Loader2 size={14} className="animate-spin" style={{ color: currentMode.color }} />
              <span className="text-xs text-txt-muted flex items-center gap-1">
                <span style={{ color: currentMode.color }}>{currentMode.label}</span> processando...
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
      <div className="px-4 py-3 border-t border-border-default bg-bg/95 backdrop-blur">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={`Pergunte ao modo ${currentMode.label}...`}
            className="flex-1 bg-surface border border-border-default text-txt-primary placeholder:text-txt-muted focus:border-tactical px-4 py-2.5 outline-none resize-none text-sm max-h-24"
            style={{ minHeight: '42px' }}
          />
          <button
            data-testid="chat-send"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="p-2.5 hover:opacity-80 active:scale-95 transition-all disabled:opacity-30"
            style={{ backgroundColor: currentMode.color, color: '#000' }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
