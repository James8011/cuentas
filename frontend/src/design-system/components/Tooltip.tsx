import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { CircleHelp } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

type TooltipProps = {
  content: ReactNode
  children?: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
  /** Accessible label for the default help trigger. */
  label?: string
}

export function Tooltip({
  content,
  children,
  side = 'top',
  className,
  label = 'Más información',
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          {children ?? (
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
              aria-label={label}
            >
              <CircleHelp className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          )}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={8}
            className={cn(
              'z-[130] max-w-64 rounded-2xl border border-slate-200 bg-slate-900 px-3 py-2 text-xs font-semibold leading-relaxed text-white shadow-panel',
              className,
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-slate-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
