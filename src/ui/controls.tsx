import { useId, type ReactNode } from 'react'

/**
 * Form primitives for the control panel.
 *
 * Every control is a real labelled input with a generated id. The PoC wired
 * controls with inline `oninput="..."` handlers and unlabelled inputs, which
 * meant nothing was reachable by screen reader and one typo — a tab id that did
 * not exist — silently broke a whole panel with no type checking to catch it.
 */

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="border-b border-[#1a1a1a] p-5 last:border-b-0">
      {title && (
        <h3 className="mb-3 font-mono text-[10px] font-bold uppercase tracking-wide text-white">
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[11px] leading-snug text-[#777]">{children}</p>
}

function Label({ htmlFor, children, value }: { htmlFor: string; children: ReactNode; value?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 flex items-baseline justify-between gap-3 font-mono text-[10px] uppercase text-[#888]"
    >
      <span>{children}</span>
      {value !== undefined && <span className="text-[#bbb] tabular-nums">{value}</span>}
    </label>
  )
}

const inputClass =
  'w-full rounded border border-[#333] bg-[#111] px-3 py-2 text-xs text-white outline-none transition-colors focus:border-[#777] focus-visible:ring-1 focus-visible:ring-white/40'

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  mono = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'password'
  mono?: boolean
}) {
  const id = useId()
  return (
    <div className="mb-3 last:mb-0">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type={type}
        className={`${inputClass} ${mono ? 'font-mono' : ''}`}
        value={value}
        placeholder={placeholder ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { id: T; label: string }[]
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className="mb-3 last:mb-0">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={`${inputClass} cursor-pointer`}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  disabled = false,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
  disabled?: boolean
  hint?: string
}) {
  const id = useId()
  return (
    <div className={`mb-4 last:mb-0 ${disabled ? 'opacity-40' : ''}`}>
      <Label htmlFor={id} value={format ? format(value) : String(value)}>
        {label}
      </Label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="mt-1 text-[10px] leading-snug text-[#666]">{hint}</p>}
    </div>
  )
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="flex-1">
      <label htmlFor={id} className="mb-1 block font-mono text-[9px] uppercase text-[#777]">
        {label}
      </label>
      <input
        id={id}
        type="color"
        className="h-8 w-full rounded"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="mt-1 block font-mono text-[9px] uppercase text-[#555]">{value}</span>
    </div>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-white"
      />
      <label htmlFor={id} className="cursor-pointer font-mono text-[11px] text-[#999]">
        {label}
      </label>
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled = false,
  busy = false,
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  busy?: boolean
}) {
  const base =
    'flex w-full items-center justify-center gap-2 rounded px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wide transition-[transform,opacity] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
  const skin =
    variant === 'primary'
      ? 'bg-white text-black hover:bg-[#e8e8e8]'
      : 'border border-[#333] bg-[#1c1c1c] text-white hover:bg-[#262626]'

  return (
    <button type="button" className={`${base} ${skin}`} onClick={onClick} disabled={disabled || busy}>
      {busy && (
        <span
          aria-hidden
          className={`h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent ${
            variant === 'primary' ? 'border-t-black/70 border-l-black/70' : 'border-t-white border-l-white'
          }`}
        />
      )}
      {children}
    </button>
  )
}

export function Alert({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  const skin =
    tone === 'error'
      ? 'border-[#5a2020] bg-[#2a1212] text-[#ff9d9d]'
      : 'border-[#2a2a2a] bg-[#141414] text-[#999]'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded border p-3 text-[11px] leading-snug ${skin}`}>
      {children}
    </div>
  )
}
