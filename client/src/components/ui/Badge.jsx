const variants = {
  bbva:    'bg-blue-500/10   text-blue-400   border border-blue-500/20',
  amex:    'bg-amber-500/10  text-amber-400  border border-amber-500/20',
  emerald: 'bg-green-500/10  text-green-400  border border-green-500/20',
  red:     'bg-red-500/10    text-red-400    border border-red-500/20',
  gray:    'bg-white/[0.04]  text-slate-400  border border-white/[0.06]',
  warning: 'bg-amber-500/10  text-amber-400  border border-amber-500/20',
  blue:    'bg-blue-500/10   text-blue-400   border border-blue-500/20',
}

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
