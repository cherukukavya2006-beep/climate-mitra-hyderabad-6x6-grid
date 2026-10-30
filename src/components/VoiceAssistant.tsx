import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PhoneCall, PhoneOff, Mic, MicOff, Loader2, Bot, X } from 'lucide-react';

type CallState = 'idle' | 'requesting-mic' | 'listening' | 'processing' | 'speaking' | 'error';

interface VoiceMessage {
  role: 'user' | 'bot';
  content: string;
}

// Detect browser Speech API support
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const hasSpeechRecognition = !!SpeechRecognition;
const hasSpeechSynthesis = !!(window.speechSynthesis);

export default function VoiceAssistant({ onClose }: { onClose: () => void }) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isActiveRef = useRef(false); // track if call session is still active

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    return () => {
      stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const stopEverything = useCallback(() => {
    isActiveRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    if (synthRef.current) {
      try { synthRef.current.cancel(); } catch {}
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!hasSpeechSynthesis || !isActiveRef.current) {
        resolve();
        return;
      }
      synthRef.current?.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-IN';
      utter.rate = 0.95;
      utter.pitch = 1.0;
      utter.volume = 1.0;

      // Prefer an Indian English voice if available
      const voices = synthRef.current?.getVoices() || [];
      const preferred = voices.find(v =>
        v.lang === 'en-IN' || v.name.toLowerCase().includes('india')
      ) || voices.find(v => v.lang.startsWith('en')) || null;
      if (preferred) utter.voice = preferred;

      utter.onstart = () => { if (isActiveRef.current) setIsSpeaking(true); };
      utter.onend = () => { setIsSpeaking(false); resolve(); };
      utter.onerror = () => { setIsSpeaking(false); resolve(); };
      synthRef.current?.speak(utter);
    });
  }, []);

  const askBackend = useCallback(async (question: string): Promise<string> => {
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `Server error (${res.status})`);
    if (!data?.answer) throw new Error('No answer received');
    return data.answer as string;
  }, []);

  const startListening = useCallback(() => {
    if (!isActiveRef.current) return;
    if (!hasSpeechRecognition) {
      setErrorMsg('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      setCallState('error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    setTranscript('');
    setCallState('listening');

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript;
      setTranscript(text);
      if (result.isFinal) {
        recognition.stop();
        handleFinalTranscript(text);
      }
    };

    recognition.onerror = (event: any) => {
      if (!isActiveRef.current) return;
      if (event.error === 'no-speech') {
        // No speech detected - go back to listening
        setTranscript('');
        startListening();
        return;
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setErrorMsg('Microphone access was denied. Please allow microphone access in your browser settings and try again.');
        setCallState('error');
        return;
      }
      // Transient error - retry listening
      setTranscript('');
      setTimeout(() => { if (isActiveRef.current) startListening(); }, 500);
    };

    recognition.onend = () => {
      // If we reach here without a final transcript and still active, go back to listening
      if (isActiveRef.current && callState !== 'processing' && callState !== 'speaking') {
        // Will be re-called by onerror or handleFinalTranscript
      }
    };

    try {
      recognition.start();
    } catch (err) {
      if (isActiveRef.current) {
        setTimeout(() => { if (isActiveRef.current) startListening(); }, 300);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

  const handleFinalTranscript = useCallback(async (text: string) => {
    if (!isActiveRef.current || !text.trim()) {
      if (isActiveRef.current) startListening();
      return;
    }

    const question = text.trim();
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setTranscript('');
    setCallState('processing');

    try {
      const answer = await askBackend(question);
      if (!isActiveRef.current) return;
      setMessages(prev => [...prev, { role: 'bot', content: answer }]);
      setCallState('speaking');
      await speak(answer);
      if (isActiveRef.current) {
        startListening();
      }
    } catch (err: any) {
      if (!isActiveRef.current) return;
      const errText = err?.message || 'Failed to get a response. Please try again.';
      setMessages(prev => [...prev, { role: 'bot', content: `⚠️ ${errText}` }]);
      setCallState('speaking');
      await speak('Sorry, I had trouble connecting. Please try again.');
      if (isActiveRef.current) startListening();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askBackend, speak]);

  const startCall = useCallback(async () => {
    setErrorMsg('');
    setMessages([]);
    setTranscript('');

    if (!hasSpeechRecognition) {
      setErrorMsg('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge on desktop.');
      setCallState('error');
      return;
    }

    setCallState('requesting-mic');

    try {
      // Explicitly request mic permission first so we can give a clean error
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately – SpeechRecognition manages its own mic access
      stream.getTracks().forEach(t => t.stop());
    } catch (err: any) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setErrorMsg(
        denied
          ? 'Microphone access denied. Click the mic icon in your browser\'s address bar to allow access, then try again.'
          : 'Could not access your microphone. Please check your device and browser settings.'
      );
      setCallState('error');
      return;
    }

    isActiveRef.current = true;

    // Greet the user
    setMessages([{ role: 'bot', content: 'Hello! I am Climate Mitra. Ask me anything about weather, farming, or climate change.' }]);
    setCallState('speaking');
    await speak('Hello! I am Climate Mitra. Ask me anything about weather, farming, or climate change.');
    if (isActiveRef.current) startListening();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak]);

  const endCall = useCallback(() => {
    stopEverything();
    setCallState('idle');
    setTranscript('');
    setErrorMsg('');
    setMessages([]);
  }, [stopEverything]);

  const handleClose = useCallback(() => {
    stopEverything();
    onClose();
  }, [stopEverything, onClose]);

  // ---- UI helpers ----
  const stateLabel: Record<CallState, string> = {
    idle: 'Ready to connect',
    'requesting-mic': 'Requesting microphone…',
    listening: transcript ? `Heard: "${transcript}"` : 'Listening… speak now',
    processing: 'Climate Mitra is thinking…',
    speaking: 'Climate Mitra is speaking…',
    error: errorMsg || 'An error occurred',
  };

  const isCallActive = callState !== 'idle' && callState !== 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card rounded-3xl w-full max-w-md shadow-2xl border border-brand-border flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-brand-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-primary/15 text-brand-primary flex items-center justify-center">
              <Bot size={22} />
            </div>
            <div>
              <h3 className="font-bold text-brand-dark text-lg leading-tight">Climate Mitra Voice</h3>
              <p className="text-xs text-brand-dark/50">Voice AI Assistant</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-brand-border/40 smooth-transition text-brand-dark/50 hover:text-brand-dark"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Chat area */}
        {messages.length > 0 && (
          <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-brand-surface/30 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-brand-secondary text-white rounded-tr-none'
                      : 'bg-white border border-brand-border text-brand-dark rounded-tl-none shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Status area */}
        <div className="p-5 border-t border-brand-border/50 bg-white/60 shrink-0">
          {/* Status label */}
          <div className={`flex items-center gap-2 mb-5 text-sm min-h-[1.5rem] ${callState === 'error' ? 'text-red-500' : 'text-brand-dark/60'}`}>
            {callState === 'requesting-mic' || callState === 'processing' ? (
              <Loader2 size={15} className="animate-spin shrink-0" />
            ) : callState === 'listening' ? (
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            ) : callState === 'speaking' ? (
              <span className="flex gap-0.5 items-end h-4 shrink-0">
                {[1,2,3].map(n => (
                  <span
                    key={n}
                    className="w-1 bg-brand-primary rounded-full animate-bounce"
                    style={{ height: `${8 + n * 4}px`, animationDelay: `${n * 0.15}s` }}
                  />
                ))}
              </span>
            ) : null}
            <span className="truncate">{stateLabel[callState]}</span>
          </div>

          {/* Call controls */}
          <div className="flex justify-center gap-4">
            {!isCallActive ? (
              <button
                onClick={startCall}
                className="flex items-center gap-2 px-8 py-3.5 bg-brand-primary text-white rounded-full font-bold shadow-lg hover:bg-brand-primary/90 hover:-translate-y-0.5 smooth-transition"
              >
                <PhoneCall size={20} />
                Start Voice Call
              </button>
            ) : (
              <>
                {/* Mic status indicator */}
                <div
                  className={`flex items-center gap-2 px-5 py-3 rounded-full border font-medium text-sm ${
                    callState === 'listening'
                      ? 'bg-red-50 border-red-200 text-red-600'
                      : 'bg-brand-light border-brand-border text-brand-dark/50'
                  }`}
                >
                  {callState === 'listening' ? <Mic size={16} /> : <MicOff size={16} />}
                  {callState === 'listening' ? 'Mic On' : 'Mic Off'}
                </div>

                {/* End call */}
                <button
                  onClick={endCall}
                  className="flex items-center gap-2 px-5 py-3 bg-red-500 text-white rounded-full font-bold shadow hover:bg-red-600 hover:-translate-y-0.5 smooth-transition"
                >
                  <PhoneOff size={18} />
                  End Call
                </button>
              </>
            )}
          </div>

          {/* Browser support note */}
          {!hasSpeechRecognition && callState === 'idle' && (
            <p className="text-center text-xs text-red-400 mt-3">
              ⚠️ Your browser does not support voice input. Please use Google Chrome or Microsoft Edge.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

