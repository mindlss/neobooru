import { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
}

export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`ui-button ui-button--${variant} ${className}`}
      {...props}
    />
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="ui-input" {...props} />
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return <textarea className="ui-textarea" {...props} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="ui-select" {...props} />
}

export function Field({
  children,
  label,
}: {
  children: ReactNode
  label: ReactNode
}) {
  return (
    <label className="ui-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'accent' | 'danger' | 'muted'
}) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>
}

export function Panel({ children }: { children: ReactNode }) {
  return <section className="ui-panel">{children}</section>
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ id: T; label: ReactNode; disabled?: boolean }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="ui-tabs" role="tablist">
      {items.map((item) => (
        <button
          aria-selected={value === item.id}
          className={value === item.id ? 'active' : ''}
          disabled={item.disabled}
          key={item.id}
          role="tab"
          type="button"
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function IconButton({
  className = '',
  variant = 'ghost',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`ui-icon-button ui-button--${variant} ${className}`}
      {...props}
    />
  )
}

export function Avatar({
  alt,
  size = 'md',
  src,
}: {
  alt: string
  size?: 'sm' | 'md' | 'lg'
  src?: string | null
}) {
  const initial = alt.trim().charAt(0).toUpperCase() || '?'

  if (src) {
    return <img className={`ui-avatar ui-avatar--${size}`} src={src} alt={alt} />
  }

  return <span className={`ui-avatar ui-avatar--${size}`}>{initial}</span>
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="ui-toolbar">{children}</div>
}

export function Pager({
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  canPrev?: boolean
  canNext?: boolean
  onPrev?: () => void
  onNext?: () => void
}) {
  return (
    <div className="ui-pager">
      <Button disabled={!canPrev} type="button" variant="ghost" onClick={onPrev}>
        <ChevronLeft size={16} /> Назад
      </Button>
      <Button disabled={!canNext} type="button" variant="ghost" onClick={onNext}>
        Дальше <ChevronRight size={16} />
      </Button>
    </div>
  )
}

export function InlinePreview({ children }: { children: ReactNode }) {
  return <div className="inline-preview">{children}</div>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>
}

export function Skeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton" key={index} />
      ))}
    </>
  )
}
