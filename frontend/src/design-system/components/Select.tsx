import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '../utils/cn'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type SelectProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  options: SelectOption[]
  disabled?: boolean
  name?: string
  id?: string
  className?: string
  'aria-invalid'?: boolean
  'aria-label'?: string
}

const triggerClass =
  'flex w-full items-center justify-between gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-slate-400'

const contentClass =
  'relative z-[120] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-panel'

const itemClass =
  'relative flex cursor-pointer select-none items-center rounded-xl py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-brand-500 data-[highlighted]:text-white data-[disabled]:opacity-40'

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      value,
      defaultValue,
      onValueChange,
      onBlur,
      placeholder = 'Selecciona…',
      options,
      disabled,
      name,
      id,
      className,
      'aria-invalid': ariaInvalid,
      'aria-label': ariaLabel,
    },
    ref,
  ) => (
    <SelectPrimitive.Root
      value={value === '' || value === undefined ? undefined : value}
      defaultValue={defaultValue || undefined}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
    >
      <SelectPrimitive.Trigger
        ref={ref}
        id={id}
        onBlur={onBlur}
        aria-invalid={ariaInvalid}
        aria-label={ariaLabel}
        className={cn(triggerClass, className)}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className={contentClass}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  ),
)

Select.displayName = 'Select'

const SelectItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & { children: ReactNode }
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(itemClass, className)}
    {...props}
  >
    <span className="absolute left-2.5 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))

SelectItem.displayName = 'SelectItem'
