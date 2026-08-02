import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getAccessToken } from '@/stores/authStore';
import { toast } from 'sonner';

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  streaming?: boolean;
}

const STORAGE_KEY = 'ost_ai_conversation_id';

export function useAiChat() {
  const [conversationId, setConversationId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Load history when conversation changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!conversationId) { setMessages([]); return; }
      try {
        const { data } = await api.get(`/ai-chat/conversations/${conversationId}/messages`);
        if (cancelled) return;
        setMessages((data.messages || []).map((m: any) => ({
          id: m.id, role: m.role, content: m.content, created_at: m.createdAt,
        })));
      } catch {
        if (!cancelled) setMessages([]);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [conversationId]);

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const tempUserId = `local-${Date.now()}`;
    const tempAsstId = `local-${Date.now()}-a`;
    setMessages(prev => [
      ...prev,
      { id: tempUserId, role: 'user', content: trimmed, created_at: new Date().toISOString() },
      { id: tempAsstId, role: 'assistant', content: '', created_at: new Date().toISOString(), streaming: true },
    ]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = getAccessToken();
      if (!token) throw new Error('Please sign in to use OurSchool AI.');

      const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
      const url = `${apiBase}/ai-chat`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId, message: trimmed }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => '');
        let errMsg = 'AI request failed';
        try { errMsg = JSON.parse(errBody).error || errMsg; } catch {}
        throw new Error(errMsg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const evt of events) {
          const lines = evt.split('\n');
          let type = 'message';
          let data = '';
          for (const l of lines) {
            if (l.startsWith('event:')) type = l.slice(6).trim();
            else if (l.startsWith('data:')) data += l.slice(5).trim();
          }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (type === 'meta' && parsed.conversationId) {
              if (parsed.conversationId !== conversationId) {
                setConversationId(parsed.conversationId);
                try { localStorage.setItem(STORAGE_KEY, parsed.conversationId); } catch {}
              }
            } else if (type === 'token' && parsed.text) {
              acc += parsed.text;
              setMessages(prev => prev.map(m => m.id === tempAsstId ? { ...m, content: acc } : m));
            } else if (type === 'error') {
              throw new Error(parsed.error || 'Stream error');
            }
          } catch (e) {
            if (type === 'error') throw e;
          }
        }
      }

      setMessages(prev => prev.map(m => m.id === tempAsstId ? { ...m, streaming: false } : m));
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setMessages(prev => prev.map(m => m.id === tempAsstId ? { ...m, streaming: false, content: m.content || '_Stopped._' } : m));
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempAsstId));
        toast.error(e.message || 'AI error');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [conversationId, isStreaming]);

  return { conversationId, messages, isStreaming, sendMessage, stop, startNewConversation };
}