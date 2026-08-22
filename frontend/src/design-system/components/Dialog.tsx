import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

type DialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
  /** Use when this dialog opens above another dialog (e.g. camera). */
  nested?: boolean
}

export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  className,
  nested = false,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      ) : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 bg-slate-900/40 backdrop-blur-sm',
            nested ? 'z-[110]' : 'z-[90]',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl outline-none',
            nested ? 'z-[120]' : 'z-[100]',
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-6 pb-4 pt-6">
            <div className="min-w-0 pr-2">
              <DialogPrimitive.Title className="text-xl font-black text-slate-900">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm font-semibold text-slate-500">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          {children ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
              <div className="space-y-3">{children}</div>
            </div>
          ) : null}
          {footer ? (
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-6 pb-6 pt-4">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
