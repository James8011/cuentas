import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
} from 'react'
import {
  caretFromDigitCount,
  countDigitsBefore,
  formatDecimal,
  formatDecimalLive,
  getLocaleSeparators,
  MONEY_DISPLAY_SCALE,
  normalizeDecimal,
  parseDecimalInput,
} from '../../lib/money'
import { Input } from './Input'

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'defaultValue'
> & {
  value?: string
  onChange?: (value: string) => void
  /** Visible fraction digits. Default 2. */
  scale?: number
  /** Canonical scale for the form/API. Default 4. */
  apiScale?: number
  locale?: string
}

/**
 * Formats thousands/decimals while typing (2 decimals by default).
 * Emits a canonical API string (`digits.apiScale`) on each valid change.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      value = '',
      onChange,
      onBlur,
      onFocus,
      scale = MONEY_DISPLAY_SCALE,
      apiScale = 4,
      locale = 'es-CO',
      placeholder,
      ...props
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const { decimal } = getLocaleSeparators(locale)
    const [focused, setFocused] = useState(false)
    const [text, setText] = useState(() =>
      value ? formatDecimal(value, locale, scale) : '',
    )

    useEffect(() => {
      if (!focused) {
        setText(value ? formatDecimal(value, locale, scale) : '')
      }
    }, [value, focused, locale, scale])

    const setRefs = (node: HTMLInputElement | null) => {
      inputRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    }

    const emitCanonical = (formatted: string) => {
      if (!formatted) {
        onChange?.('')
        return
      }
      const forParse = formatted.endsWith(decimal)
        ? formatted.slice(0, -1)
        : formatted
      if (!forParse) {
        onChange?.('')
        return
      }
      const parsed = parseDecimalInput(forParse, scale)
      if (parsed !== null) {
        onChange?.(normalizeDecimal(parsed, apiScale))
      }
    }

    return (
      <Input
        {...props}
        ref={setRefs}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder ?? formatDecimal('0', locale, scale)}
        value={focused ? text : value ? formatDecimal(value, locale, scale) : ''}
        onFocus={(event) => {
          setFocused(true)
          setText(value ? formatDecimal(value, locale, scale) : '')
          onFocus?.(event)
        }}
        onChange={(event) => {
          const raw = event.target.value
          const caret = event.target.selectionStart ?? raw.length
          const digitsBefore = countDigitsBefore(raw, caret)
          const sepIndex = raw.indexOf(decimal)
          const intDigits = sepIndex >= 0 ? countDigitsBefore(raw, sepIndex) : digitsBefore
          const afterDecimal = sepIndex >= 0 && caret > sepIndex

          const formatted = formatDecimalLive(raw, locale, scale)
          setText(formatted)
          emitCanonical(formatted)

          requestAnimationFrame(() => {
            const el = inputRef.current
            if (!el) return
            let pos = caretFromDigitCount(formatted, digitsBefore)
            if (afterDecimal && digitsBefore <= intDigits) {
              const nextSep = formatted.indexOf(decimal)
              if (nextSep >= 0) pos = nextSep + 1
            }
            el.setSelectionRange(pos, pos)
          })
        }}
        onBlur={(event) => {
          setFocused(false)
          if (!text) {
            onChange?.('')
            setText('')
          } else {
            const parsed = parseDecimalInput(
              text.endsWith(decimal) ? text.slice(0, -1) : text,
              scale,
            )
            if (parsed !== null) {
              const canonical = normalizeDecimal(parsed, apiScale)
              onChange?.(canonical)
              setText(formatDecimal(canonical, locale, scale))
            }
          }
          onBlur?.(event)
        }}
      />
    )
  },
)

MoneyInput.displayName = 'MoneyInput'
