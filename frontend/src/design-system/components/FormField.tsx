import type { ReactNode } from 'react'
import { cn } from '../utils/cn'
import { Tooltip } from './Tooltip'

type FormFieldProps = {
  label?: string
  hint?: string
  /** Short help shown in a ? tooltip next to the label. */
  tooltip?: ReactNode
  error?: string
  required?: boolean
  htmlFor?: string
  className?: string
  children: ReactNode
}

export function FormField({
  label,
  hint,
  tooltip,
  error,
  required,
  htmlFor,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <div className="flex items-center gap-1.5">
          <label
            htmlFor={htmlFor}
            className="block text-sm font-black text-slate-700"
          >
            {label}
            {required ? <span className="ml-0.5 text-orange-500">*</span> : null}
          </label>
          {tooltip ? <Tooltip content={tooltip} label={`Ayuda: ${label}`} /> : null}
        </div>
      ) : null}
      {children}
      {error ? (
        <p role="alert" className="text-xs font-semibold text-orange-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs font-semibold text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}
