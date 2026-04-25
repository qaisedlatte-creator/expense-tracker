'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface SettingsForm {
  starting_capital: string
  monthly_overhead: string
  weekly_ad_budget: string
  currency_symbol: string
  business_name: string
}

const DEFAULTS: SettingsForm = {
  starting_capital: '20000',
  monthly_overhead: '2000',
  weekly_ad_budget: '1500',
  currency_symbol: '₹',
  business_name: 'Webbes',
}

export default function SettingsPage() {
  const router = useRouter()
  const [form, setForm] = useState<SettingsForm>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resetStep, setResetStep] = useState(0)
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*')
    if (data) {
      const f = { ...DEFAULTS }
      for (const row of data) {
        if (row.key in f) f[row.key as keyof SettingsForm] = row.value
      }
      setForm(f)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    setSaving(true)
    const entries = Object.entries(form).map(([key, value]) => ({ key, value }))
    await Promise.all(
      entries.map(({ key, value }) =>
        supabase
          .from('settings')
          .upsert({ key, value, updated_at: new Date().toISOString() })
          .eq('key', key)
      )
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleReset() {
    if (resetStep === 0) {
      setResetStep(1)
      return
    }
    if (resetStep === 1) {
      setResetStep(2)
      return
    }
    setResetting(true)
    await Promise.all([
      supabase.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('ad_spend').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    ])
    const defaults = Object.entries(DEFAULTS).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }))
    await supabase.from('settings').upsert(defaults)
    setForm(DEFAULTS)
    setResetStep(0)
    setResetting(false)
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-5 h-5 border border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const resetLabels = ['Reset All Data', 'Are you sure?', 'Tap again — this cannot be undone']

  return (
    <div className="px-4 pt-6 pb-32 max-w-md mx-auto">
      <h1 className="text-xl font-bold tracking-tight mb-1">Settings</h1>
      <p className="text-xs text-[#555] mb-6">Shared across all devices</p>

      <div className="flex flex-col gap-4 mb-8">
        <Field
          label="Business Name"
          type="text"
          value={form.business_name}
          onChange={(v) => setForm({ ...form, business_name: v })}
          placeholder="Webbes"
        />
        <Field
          label="Currency Symbol"
          type="text"
          value={form.currency_symbol}
          onChange={(v) => setForm({ ...form, currency_symbol: v })}
          placeholder="₹"
        />

        <div className="border-t border-[#1a1a1a] pt-4">
          <p className="text-[11px] uppercase tracking-widest text-[#444] mb-3">Financial</p>
          <div className="flex flex-col gap-4">
            <Field
              label="Starting Capital (₹)"
              type="number"
              value={form.starting_capital}
              onChange={(v) => setForm({ ...form, starting_capital: v })}
              placeholder="20000"
              hint="The initial budget you started with"
            />
            <Field
              label="Monthly Overhead (₹)"
              type="number"
              value={form.monthly_overhead}
              onChange={(v) => setForm({ ...form, monthly_overhead: v })}
              placeholder="2000"
              hint="Fixed recurring costs per month (tools, subscriptions)"
            />
            <Field
              label="Weekly Ad Budget Cap (₹)"
              type="number"
              value={form.weekly_ad_budget}
              onChange={(v) => setForm({ ...form, weekly_ad_budget: v })}
              placeholder="1500"
              hint="Total weekly cap across all ad platforms"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-white text-black font-bold py-3 rounded-lg text-sm disabled:opacity-40 mb-3"
      >
        {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Settings'}
      </button>

      {/* Reset */}
      <div className="border-t border-[#1a1a1a] pt-5 mt-5">
        <p className="text-[11px] uppercase tracking-widest text-[#444] mb-3">Danger Zone</p>
        <button
          onClick={handleReset}
          disabled={resetting}
          className={`w-full py-3 rounded-lg text-sm font-bold border transition-all disabled:opacity-40 ${
            resetStep === 0
              ? 'border-[#333] text-[#666]'
              : resetStep === 1
              ? 'border-white text-white'
              : 'bg-white text-black border-white'
          }`}
        >
          {resetting ? 'Resetting...' : resetLabels[resetStep]}
        </button>
        {resetStep > 0 && (
          <button
            onClick={() => setResetStep(0)}
            className="w-full text-xs text-[#555] mt-2 py-2"
          >
            Cancel
          </button>
        )}
        <p className="text-[10px] text-[#333] mt-2 text-center">
          Deletes all projects, expenses, and ad spend data
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  hint?: string
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-[#666] block mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-white"
      />
      {hint && <p className="text-[10px] text-[#444] mt-1">{hint}</p>}
    </div>
  )
}
