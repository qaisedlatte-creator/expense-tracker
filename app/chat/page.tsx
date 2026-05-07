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

const DEFAULT_SETTINGS: Settings = {
  starting_capital: 20000,
  monthly_overhead: 2000,
  weekly_ad_budget: 1500,
  currency_symbol:  '₹',
  business_name:    'Webbes',
}

const SUGGESTIONS = [
  'What\'s my profit this month?',
  'Which project made the most money?',
  'How much have I spent on ads?',
  'Am I on track for ₹25k this month?',
  'What\'s my runway?',
]

export default function ChatPage() {
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [projects,  setProjects]  = useState<Project[]>(() => fromCache('projects', []))
  const [expenses,  setExpenses]  = useState<Expense[]>(() => fromCache('expenses', []))
  const [settings,  setSettings]  = useState<Settings>(() => fromCache('settings_parsed', DEFAULT_SETTINGS))
  const [ready,     setReady]     = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const didMount   = useRef(false)

  // Load financial context + chat history
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

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || sending) return

    setInput('')
    setSending(true)

    const userMsg: Message = { role: 'user', content }
    setMessages(prev => [...prev, userMsg])

    // Add streaming placeholder
    const placeholderIndex = messages.length + 1
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history: messages.slice(-12).map(m => ({ role: m.role, content: m.content })),
          context: {
            projects:  projects.map(p => ({ name: p.name, amount: p.amount, status: p.status, date: p.date })),
            expenses:  expenses.slice(0, 50).map(e => ({ name: e.name, amount: e.amount, category: e.category, date: e.date, project_id: e.project_id })),
            settings:  { starting_capital: settings.starting_capital, monthly_overhead: settings.monthly_overhead, currency_symbol: settings.currency_symbol, business_name: settings.business_name },
          },
        }),
      })

      if (!res.ok || !res.body) throw new Error('API error')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   text    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: text, streaming: true }
          return updated
        })
      }

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: text }
        return updated
      })
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Something went wrong. Make sure ANTHROPIC_API_KEY is set in your environment.',
        }
        return updated
      })
    }

    setSending(false)
    void placeholderIndex
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-[100dvh] max-w-md mx-auto">
      {/* Header */}
      <div
        className="px-4 pt-6 pb-3 border-b border-bdf"
        style={{ background: 'rgb(var(--bg))' }}
      >
        <h1 className="text-xl font-bold text-tx">Ask AI</h1>
        <p className="text-xs text-t4 mt-0.5">
          {ready ? `${settings.business_name} Finance Assistant` : 'Loading data…'}
        </p>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 scrollbar-none"
        style={{ paddingBottom: '80px' }}
      >
        {isEmpty && ready && (
          <div className="flex flex-col gap-3 mt-4">
            <p className="text-xs uppercase tracking-widest text-t5 mb-2">Suggested questions</p>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="text-left text-sm bg-surface border border-bdr rounded-2xl px-4 py-3 text-t2 hover:border-ac hover:text-tx transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-ac text-acf rounded-br-sm'
                  : 'bg-surface border border-bdr text-tx rounded-bl-sm'
              }`}
            >
              {msg.content || (msg.streaming && (
                <span className="flex gap-1 py-1">
                  <span className="w-1.5 h-1.5 bg-t3 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-t3 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-t3 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </span>
              ))}
              {msg.content && msg.role === 'assistant' && (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
              {msg.content && msg.role === 'user' && msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-bdf px-4 py-3 max-w-md mx-auto"
        style={{
          background:    'rgb(var(--bg))',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '448px',
        }}
      >
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your finances…"
            rows={1}
            disabled={!ready || sending}
            className="flex-1 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none"
            style={{
              background:  'var(--surface)',
              border:      '1px solid var(--bdr)',
              color:       'var(--tx)',
              maxHeight:   '120px',
              overflow:    'auto',
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending || !ready}
            className="w-11 h-11 rounded-2xl bg-ac text-acf flex items-center justify-center shrink-0 disabled:opacity-30 transition-opacity active:scale-95"
          >
            {sending ? (
              <div className="w-4 h-4 rounded-full" style={{ border: '2px solid rgb(var(--acf) / 0.3)', borderTopColor: 'rgb(var(--acf))' }} />
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
