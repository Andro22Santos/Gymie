import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import {
  Send, Loader2, UtensilsCrossed, Dumbbell, MessageSquare,
  TrendingUp, Camera, Droplet, Flame, ChevronDown,
  Sparkles, Check, Plus, Volume2, VolumeX, Paperclip, Mic, MicOff, X,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gymie font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

const MODES = [
  { id: 'companion', label: 'Gymie', icon: MessageSquare, color: '#00E04B', desc: 'Motivação e rotina' },
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
  const toast = useToast();
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('companion');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contextSummary, setContextSummary] = useState(null);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [pendingImage, setPendingImage] = useState(null); // { base64, preview }
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const imageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

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

  const startNewThread = async () => {
    try {
      const newThread = await api.post('/api/chat/threads');
      setThreads((prev) => [...prev, newThread.data]);
      setActiveThread(newThread.data.id);
      setMessages([]);
      setInput('');
      setShowModeSelector(false);
      toast('Nova conversa iniciada', 'info');
    } catch (err) { console.error(err); }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPendingImage({ base64: ev.target.result, preview: ev.target.result });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = (ev) => {
          sendMessage('', null, ev.target.result);
        };
        reader.readAsDataURL(blob);
        setRecording(false);
        mediaRecorderRef.current = null;
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      toast('Microfone não disponível ou permissão negada', 'error');
    }
  };

  const sendMessage = async (text, extraImageBase64 = null, extraAudioBase64 = null) => {
    const imgB64 = extraImageBase64 || pendingImage?.base64 || null;
    const hasContent = (text || '').trim() || imgB64 || extraAudioBase64;
    if (!hasContent || sending || !activeThread) return;
    const msgText = (text || '').trim();
    setInput('');
    setPendingImage(null);
    setSending(true);

    const displayContent = msgText || (extraAudioBase64 ? '🎤 Áudio' : imgB64 ? '📷 Imagem' : '');
    const tempUserMsg = {
      id: 'temp-user', role: 'user',
      content: displayContent,
      image_base64: imgB64,
      has_audio: !!extraAudioBase64,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await api.post(`/api/chat/threads/${activeThread}/messages`, {
        content: msgText,
        mode,
        image_base64: imgB64,
        audio_base64: extraAudioBase64,
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
      toast('Não foi possível enviar. Tente novamente.', 'error');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input, null, null);
    }
  };

  const speak = (text, msgId) => {
    if (!window.speechSynthesis) return;
    if (speakingId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const plain = text.replace(/<[^>]+>/g, '').replace(/\*+/g, '');
    const utt = new SpeechSynthesisUtterance(plain);
    utt.lang = 'pt-BR';
    utt.rate = 1.05;
    utt.onend = () => setSpeakingId(null);
    utt.onerror = () => setSpeakingId(null);
    setSpeakingId(msgId);
    window.speechSynthesis.speak(utt);
  };

  const currentMode = MODES.find(m => m.id === mode) || MODES[0];
  const ModeIcon = currentMode.icon;

  if (loading) return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-md mx-auto">
      {/* Header skeleton */}
      <div className="px-4 pt-3 pb-2 border-b border-border-subtle">
        <div className="skeleton h-14 w-full rounded-gymie mb-0" />
      </div>
      {/* Messages skeleton */}
      <div className="flex-1 overflow-hidden px-4 py-4 space-y-4">
        <div className="flex justify-start"><div className="skeleton h-16 w-3/4 rounded-gymie rounded-bl-sm" /></div>
        <div className="flex justify-end"><div className="skeleton h-10 w-1/2 rounded-gymie rounded-br-sm" /></div>
        <div className="flex justify-start"><div className="skeleton h-24 w-4/5 rounded-gymie rounded-bl-sm" /></div>
        <div className="flex justify-end"><div className="skeleton h-10 w-2/3 rounded-gymie rounded-br-sm" /></div>
      </div>
      {/* Input skeleton */}
      <div className="px-4 pt-3 pb-4 border-t border-border-subtle">
        <div className="skeleton h-12 w-full rounded-gymie-sm" />
      </div>
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
            <div className="flex items-center gap-2">
              {contextSummary.has_workout && <Dumbbell size={10} className="text-success" />}
              {contextSummary.has_checkin && <Check size={10} className="text-success" />}
              <button
                onClick={startNewThread}
                className="flex items-center gap-1 text-[10px] text-txt-muted hover:text-txt-secondary transition-colors pl-1 border-l border-border-subtle"
                title="Nova conversa"
              >
                <Plus size={11} /> Nova
              </button>
            </div>
          </div>
        )}

        {/* Mode Selector — destaque visual maior */}
        <button
          onClick={() => setShowModeSelector(!showModeSelector)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-gymie border transition-all"
          style={{ borderColor: `${currentMode.color}40`, backgroundColor: `${currentMode.color}08` }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${currentMode.color}20` }}
          >
            <ModeIcon size={18} style={{ color: currentMode.color }} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-xs text-txt-muted uppercase tracking-wider">Agente ativo</p>
            <p className="text-sm font-bold" style={{ color: currentMode.color }}>{currentMode.label}</p>
          </div>
          <ChevronDown
            size={18}
            className={`transition-transform`}
            style={{ color: currentMode.color, transform: showModeSelector ? 'rotate(180deg)' : 'rotate(0deg)' }}
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
                {/* AI avatar + name */}
                {!isUser && (
                  <div className="flex items-center gap-2 mb-1.5 ml-1">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                      style={{ backgroundColor: `${agentColor}25`, color: agentColor, border: `1px solid ${agentColor}40` }}
                    >
                      G
                    </div>
                    <span className="text-[10px] text-txt-muted">{msg.agent_name || 'Gymie'}</span>
                  </div>
                )}
                <div className={isUser ? 'msg-user' : 'msg-ai'} style={{ padding: '12px 16px' }}>
                  {/* Image attachment */}
                  {msg.image_base64 && (
                    <img
                      src={msg.image_base64}
                      alt="imagem"
                      className="w-full max-w-[200px] rounded-gymie-sm mb-2 object-cover block"
                    />
                  )}
                  {/* Audio indicator */}
                  {msg.has_audio && (
                    <div className="flex items-center gap-2 mb-2 py-1.5 px-2.5 bg-black/20 rounded-gymie-sm w-fit">
                      <Mic size={12} className="text-gymie" />
                      <span className="text-[11px] text-txt-secondary">Áudio</span>
                    </div>
                  )}
                  {msg.content && (
                    <p
                      className="text-sm leading-relaxed text-txt-primary"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-txt-muted font-data">
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {!isUser && window.speechSynthesis && (
                      <button
                        onClick={() => speak(msg.content, msg.id)}
                        className="flex items-center gap-1 text-[10px] text-txt-muted hover:text-txt-secondary transition-colors"
                        title={speakingId === msg.id ? 'Parar' : 'Ouvir'}
                      >
                        {speakingId === msg.id
                          ? <VolumeX size={12} className="text-gymie" />
                          : <Volume2 size={12} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-[85%]">
              <div className="flex items-center gap-2 mb-1.5 ml-1">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                  style={{ backgroundColor: `${currentMode.color}25`, color: currentMode.color, border: `1px solid ${currentMode.color}40` }}
                >
                  G
                </div>
                <span className="text-[10px] text-txt-muted">{currentMode.label} está digitando...</span>
              </div>
              <div className="msg-ai px-4 py-3.5">
                <div className="flex items-center gap-1" style={{ color: '#525252' }}>
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — área maior, bem separada do nav */}
      <div className="px-4 pt-3 pb-4 bg-bg/98 backdrop-blur-lg border-t border-border-subtle">
        {/* Quick Actions — visível sempre que o input estiver vazio */}
        {!input.trim() && !pendingImage && !recording && (
          <div className="relative mb-2">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {QUICK_ACTIONS.map((a, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(a.label)}
                  className="gymie-chip whitespace-nowrap touch-feedback flex-shrink-0"
                >
                  <a.icon size={12} className="text-gymie" />
                  <span className="text-txt-secondary">{a.label}</span>
                </button>
              ))}
            </div>
            <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-bg to-transparent pointer-events-none" />
          </div>
        )}

        {/* Pending image preview */}
        {pendingImage && (
          <div className="flex items-center gap-3 mb-2 p-2 bg-surface rounded-gymie-sm border border-border-subtle animate-fade-in">
            <img src={pendingImage.preview} alt="preview" className="w-12 h-12 rounded-gymie-sm object-cover flex-shrink-0" />
            <p className="text-xs text-txt-secondary flex-1">Imagem pronta para enviar</p>
            <button onClick={() => setPendingImage(null)} className="p-1 hover:bg-surface-hl rounded-full">
              <X size={14} className="text-txt-muted" />
            </button>
          </div>
        )}

        {/* Recording indicator */}
        {recording && (
          <div className="flex items-center gap-2 mb-2 p-2.5 bg-danger/5 rounded-gymie-sm border border-danger/20 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse flex-shrink-0" />
            <p className="text-xs text-danger flex-1">Gravando… toque no microfone para parar</p>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Image attach */}
          <input ref={imageInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
          <button
            onClick={() => imageInputRef.current?.click()}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-surface-hl hover:bg-surface-elevated transition-colors"
            title="Anexar imagem"
          >
            <Paperclip size={16} className="text-txt-muted" />
          </button>

          {/* Mic */}
          <button
            onClick={toggleRecording}
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${recording ? 'bg-danger/15 text-danger animate-pulse' : 'bg-surface-hl hover:bg-surface-elevated text-txt-muted'}`}
            title={recording ? 'Parar gravação' : 'Gravar áudio'}
          >
            {recording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          <textarea
            ref={inputRef}
            data-testid="chat-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={pendingImage ? 'Adicionar legenda (opcional)…' : 'Digite sua mensagem…'}
            className="flex-1 gymie-input resize-none text-sm leading-relaxed"
            style={{ minHeight: '48px', maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            data-testid="chat-send"
            onClick={() => sendMessage(input, null, null)}
            disabled={(!input.trim() && !pendingImage) || sending || recording}
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
            style={{ backgroundColor: (input.trim() || pendingImage) ? currentMode.color : '#1A1A1A', color: (input.trim() || pendingImage) ? '#000' : '#525252' }}
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <p className="text-[10px] text-txt-disabled mt-1.5 text-center">Enter envia · 📎 Imagem · 🎤 Áudio</p>
      </div>
    </div>
  );
}
