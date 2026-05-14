'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fromCache, cache } from '@/lib/cache'
import type { Project, Expense, Settings } from '@/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface SRInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart:  (() => void) | null
  onend:    (() => void) | null
  onerror:  (() => void) | null
  onresult: ((e: SREvent) => void) | null
  start: () => void
  stop:  () => void
}
interface SRResult   { transcript: string }
interface SREvent    { results: ArrayLike<{ [i: number]: SRResult; isFinal: boolean }> }
type SRConstructor = new () => SRInstance
type WindowWithSR  = typeof window & { webkitSpeechRecognition?: SRConstructor; SpeechRecognition?: SRConstructor }

const DEFAULT_SETTINGS: Settings = {
  starting_capital: 20000,
  monthly_overhead: 2000,
  weekly_ad_budget: 1500,
  currency_symbol:  '₹',
  business_name:    'Webbes',
}

const SUGGESTIONS = [
  "What's my profit this month?",
  "Which project made the most money?",
  "How much have I spent on ads?",
  "Am I on track for ₹25k this month?",
  "What's my runway?",
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput]    = useState('')
  const [sending,  setSending]  = useState(false)
  const [projects, setProjects] = useState<Project[]>(() => fromCache('projects', []))
  const [expenses, setExpenses] = useState<Expense[]>(() => fromCache('expenses', []))
  const [settings, setSettings] = useState<Settings>(() => fromCache('settings_parsed', DEFAULT_SETTINGS))
  const [ready,    setReady]    = useState(false)

  // Voice input state
  const [listening,   setListening]   = useState(false)
  const [speechAvailable, setSpeechAvailable] = useState(false)
  const recognitionRef = useRef<SRInstance | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const didMount   = useRef(false)

  // Detect SpeechRecognition support
  useEffect(() => {
    const w = window as WindowWithSR
    const SR = w.webkitSpeechRecognition ?? w.SpeechRecognition ?? null
    if (SR) setSpeechAvailable(true)
  }, [])

  const loadAll = useCallback(async () => {
    const [
      { data: proj },
      { data: exp },
      { data: sett },
      { data: history },
    ] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('settings').select('*'),
      supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(100),
    ])

    if (proj)  { setProjects(proj as Project[]); cache.set('projects', proj) }
    if (exp)   { setExpenses(exp as Expense[]);  cache.set('expenses', exp) }
    if (sett) {
      const s = { ...DEFAULT_SETTINGS }
      for (const r of (sett as { key: string; value: string }[])) {
        if (r.key === 'starting_capital') s.starting_capital = parseFloat(r.value)
        if (r.key === 'monthly_overhead') s.monthly_overhead = parseFloat(r.value)
        if (r.key === 'weekly_ad_budget') s.weekly_ad_budget = parseFloat(r.value)
        if (r.key === 'currency_symbol')  s.currency_symbol  = r.value
        if (r.key === 'business_name')    s.business_name    = r.value
      }
      setSettings(s)
      cache.set('settings_parsed', s)
    }
    if (history) {
      setMessages((history as { role: 'user' | 'assistant'; content: string }[])
        .map(m => ({ role: m.role, content: m.content })))
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (didMount.current) return
    didMount.current = true
    loadAll()
  }, [loadAll])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Voice input ───────────────────────────────────────────────────────────
  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const w = window as WindowWithSR
    const SR = w.webkitSpeechRecognition ?? w.SpeechRecognition ?? null
    if (!SR) return

    const recognition = new SR()
    recognition.lang           = 'en-IN'
    recognition.continuous     = false
    recognition.interimResults = true

    recognition.onstart  = () => setListening(true)
    recognition.onend    = () => setListening(false)
    recognition.onerror  = () => setListening(false)

    recognition.onresult = (e: SREvent) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('')
      setInput(transcript)
      // If final result, auto-send
      if (e.results[e.results.length - 1].isFinal) {
        recognition.stop()
        // Small delay to let state update
        setTimeout(() => sendMessage(transcript), 100)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || sending) return

    setInput('')
    setSending(true)

    const userMsg: Message   = { role: 'user',      content }
    const placeholder: Message = { role: 'assistant', content: '', streaming: true }

    setMessages(prev => [...prev, userMsg, placeholder])

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history: messages.slice(-12).map(m => ({ role: m.role, content: m.content })),
          context: {
            projects: projects.map(p => ({ name: p.name, amount: p.amount, status: p.status, date: p.date })),
            expenses: expenses.slice(0, 50).map(e => ({ name: e.name, amount: e.amount, category: e.category, date: e.date, project_id: e.project_id })),
            settings: {
              starting_capital: settings.starting_capital,
              monthly_overhead: settings.monthly_overhead,
              currency_symbol:  settings.currency_symbol,
              business_name:    settings.business_name,
            },
          },
        }),
      })

      if (!res.ok || !res.body) throw new Error('API error')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   full    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: full, streaming: true }
          return copy
        })
      }

      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: full }
        return copy
      })
    } catch {
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = {
          role:    'assistant',
          content: 'Something went wrong. Check that ANTHROPIC_API_KEY is set and restart the dev server.',
        }
        return copy
      })
    }

    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col max-w-md mx-auto" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b border-bdf" style={{ background: 'rgb(var(--bg))' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-tx">Ask AI</h1>
            <p className="text-xs text-t4 mt-0.5">
              {ready ? `${settings.business_name} Finance Assistant` : 'Loading…'}
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-[11px] text-t4 border border-bds px-3 py-1.5 rounded-full hover:border-ac hover:text-tx transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-none" style={{ paddingBottom: '90px' }}>
        {isEmpty && ready && (
          <div className="flex flex-col gap-2.5 mt-2">
            <p className="text-xs uppercase tracking-widest text-t5 mb-1">Suggested</p>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="text-left text-sm bg-surface border border-bdr rounded-2xl px-4 py-3 text-t2 hover:border-ac hover:text-tx transition-colors active:scale-98"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-ac text-acf rounded-br-sm'
                  : 'bg-surface border border-bdr text-tx rounded-bl-sm'
              }`}
            >
              {msg.role === 'user' ? (
                <span>{msg.content}</span>
              ) : msg.content ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : msg.streaming ? (
                <span className="flex gap-1 py-1">
                  <span className="w-1.5 h-1.5 bg-t3 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-t3 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-t3 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </span>
              ) : null}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-bdf px-4 py-3"
        style={{
          background:    'rgb(var(--bg))',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          maxWidth:      '448px',
          left:          '50%',
          transform:     'translateX(-50%)',
          width:         '100%',
        }}
      >
        {listening && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-t3">Listening… speak now</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          {/* Voice button */}
          {speechAvailable && (
            <button
              onClick={toggleVoice}
              disabled={sending}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                listening
                  ? 'bg-red-500 text-white scale-110'
                  : 'bg-surface border border-bdr text-t3 hover:text-tx hover:border-ac'
              }`}
              aria-label={listening ? 'Stop recording' : 'Voice input'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={listening ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8"  y1="23" x2="16" y2="23" />
              </svg>
            </button>
          )}

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={listening ? 'Listening…' : 'Ask anything about your finances…'}
            rows={1}
            disabled={!ready || sending}
            className="flex-1 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none"
            style={{
              background: 'var(--surface)',
              border:     '1px solid var(--bdr)',
              color:      'var(--tx)',
              maxHeight:  '120px',
              overflow:   'auto',
            }}
          />

          {/* Send button */}
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending || !ready}
            className="w-11 h-11 rounded-2xl bg-ac text-acf flex items-center justify-center shrink-0 disabled:opacity-30 transition-opacity active:scale-95"
          >
            {sending ? (
              <div
                className="w-4 h-4 rounded-full"
                style={{ border: '2px solid rgb(var(--acf) / 0.3)', borderTopColor: 'rgb(var(--acf))' }}
              />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
