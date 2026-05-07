import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function buildSystemPrompt(context: {
  projects: { name: string; amount: number; status: string; date: string }[]
  expenses: { name: string; amount: number; category: string; date: string; project_id: string | null }[]
  settings: { starting_capital: number; monthly_overhead: number; currency_symbol: string; business_name: string }
}): string {
  const { projects, expenses, settings } = context

  const confirmedRevenue = projects
    .filter(p => p.status === 'Confirmed' || p.status === 'Paid')
    .reduce((s, p) => s + p.amount, 0)

  const pendingRevenue = projects
    .filter(p => p.status === 'Pending')
    .reduce((s, p) => s + p.amount, 0)

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  const now = new Date()
  const ym  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const monthExpenses = expenses.filter(e => e.date.startsWith(ym)).reduce((s, e) => s + e.amount, 0)
  const monthRevenue  = projects
    .filter(p => p.date.startsWith(ym) && (p.status === 'Confirmed' || p.status === 'Paid'))
    .reduce((s, p) => s + p.amount, 0)

  const netProfit     = confirmedRevenue - totalExpenses
  const capitalLeft   = settings.starting_capital - totalExpenses
  const sym           = settings.currency_symbol

  return `You are the finance AI for ${settings.business_name}, a web design and digital agency in India. You have full access to the business's real-time financial data and can answer any questions about expenses, revenue, profits, and business health.

=== CURRENT FINANCIALS ===
All-time confirmed revenue:  ${sym}${confirmedRevenue.toLocaleString('en-IN')}
Pending (unconfirmed):       ${sym}${pendingRevenue.toLocaleString('en-IN')}
All-time total expenses:     ${sym}${totalExpenses.toLocaleString('en-IN')}
Net profit (all-time):       ${sym}${netProfit.toLocaleString('en-IN')}
Starting capital:            ${sym}${settings.starting_capital.toLocaleString('en-IN')}
Capital remaining:           ${sym}${capitalLeft.toLocaleString('en-IN')}
Monthly overhead:            ${sym}${settings.monthly_overhead.toLocaleString('en-IN')}

=== THIS MONTH ===
Revenue this month:  ${sym}${monthRevenue.toLocaleString('en-IN')}
Expenses this month: ${sym}${monthExpenses.toLocaleString('en-IN')}
Net this month:      ${sym}${(monthRevenue - monthExpenses - settings.monthly_overhead).toLocaleString('en-IN')}

=== PROJECTS (${projects.length} total) ===
${projects.length > 0
  ? projects.map(p => `• ${p.name}: ${sym}${p.amount.toLocaleString('en-IN')} — ${p.status} (${p.date})`).join('\n')
  : 'No projects yet.'}

=== EXPENSES (last 15) ===
${expenses.slice(0, 15).length > 0
  ? expenses.slice(0, 15).map(e => `• ${e.date} | ${e.name}: ${sym}${e.amount.toLocaleString('en-IN')} [${e.category}${e.project_id && e.project_id !== 'General' ? ` → ${e.project_id}` : ''}]`).join('\n')
  : 'No expenses yet.'}

=== INSTRUCTIONS ===
- Be concise and direct. Use ${sym} for currency.
- Give specific numbers, not vague advice.
- If asked about a specific project's profit, calculate: project revenue minus its linked expenses.
- Today's date: ${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.
- You're speaking to the business owner, Qais. Be professional but friendly.`
}

export async function POST(req: NextRequest) {
  try {
    const { message, history, context } = await req.json() as {
      message: string
      history: { role: 'user' | 'assistant'; content: string }[]
      context: Parameters<typeof buildSystemPrompt>[0]
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 })
    }

    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-12),       // keep last 12 turns for context
      { role: 'user', content: message },
    ]

    // Save user message to Supabase (fire-and-forget)
    supabase.from('chat_messages').insert({ role: 'user', content: message }).then(() => {})

    const stream = anthropic.messages.stream({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:     buildSystemPrompt(context),
      messages,
    })

    const encoder = new TextEncoder()
    let   fullResponse = ''

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullResponse += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        // Save assistant message to Supabase after stream ends
        supabase.from('chat_messages').insert({ role: 'assistant', content: fullResponse }).then(() => {})
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 })
  }
}
