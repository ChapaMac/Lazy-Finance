export default function Card({ children, className = '', onClick, variant = 'default' }) {
  const base = 'rounded-2xl transition-all duration-200 ease-out'

  const variants = {
    default: 'bg-card border border-white/[0.06] p-5 shadow-card',
    elevated: 'bg-card border border-white/[0.06] p-5 shadow-card-md',
    ghost:    'bg-white/[0.02] border border-white/[0.04] p-5',
    hero:     'bg-card border border-white/[0.06] p-6 shadow-card-lg gradient-card-top',
  }

  const interactive = onClick
    ? 'cursor-pointer hover:border-white/[0.12] hover:-translate-y-0.5 hover:shadow-card-md active:translate-y-0 active:shadow-card'
    : ''

  return (
    <div onClick={onClick} className={`${base} ${variants[variant]} ${interactive} ${className}`}>
      {children}
    </div>
  )
}
