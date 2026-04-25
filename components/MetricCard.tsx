interface Props {
  label: string
  value: string
  sub?: string
  warn?: boolean
  negative?: boolean
}

export default function MetricCard({ label, value, sub, warn, negative }: Props) {
  return (
    <div className={`bg-[#111] rounded-xl p-4 border ${warn ? 'border-white' : 'border-[#222]'}`}>
      <p className="text-[11px] uppercase tracking-widest text-[#666] mb-1">{label}</p>
      <p className={`text-2xl font-bold leading-none tracking-tight ${negative ? 'text-white' : 'text-white'}`}>
        {negative && !value.startsWith('−') ? <span>−</span> : null}
        {value}
      </p>
      {sub && (
        <p className={`text-xs mt-1 ${warn ? 'italic text-[#999]' : 'text-[#555]'}`}>{sub}</p>
      )}
    </div>
  )
}
