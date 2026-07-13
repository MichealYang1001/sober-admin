'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectControlProps {
  value: string
  options: readonly SelectOption[]
  onValueChange: (value: string) => void
  ariaLabel: string
  containerClassName?: string
  disabled?: boolean
}

export function SelectControl({
  value,
  options,
  onValueChange,
  ariaLabel,
  containerClassName = '',
  disabled = false,
}: SelectControlProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxId = useId()
  const selectedIndex = options.findIndex((option) => option.value === value)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : options[0]

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [])

  function openMenu() {
    if (disabled || options.length === 0) return
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  function selectOption(index: number) {
    const option = options[index]
    if (!option) return
    onValueChange(option.value)
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function moveActive(direction: 1 | -1) {
    setActiveIndex((current) => {
      const next = current + direction
      if (next < 0) return options.length - 1
      if (next >= options.length) return 0
      return next
    })
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled || options.length === 0) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openMenu()
      } else {
        moveActive(event.key === 'ArrowDown' ? 1 : -1)
      }
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) selectOption(activeIndex)
      else openMenu()
      return
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      return
    }

    if (open && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault()
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1)
    }
  }

  return (
    <div ref={rootRef} className={`select-shell ${containerClassName}`.trim()}>
      <button
        ref={triggerRef}
        className={open ? 'select-trigger open' : 'select-trigger'}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="none"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={handleKeyDown}
      >
        <span className="select-value">{selectedOption?.label || '请选择'}</span>
        <ChevronDown className="select-chevron" size={16} aria-hidden="true" />
      </button>

      {open && (
        <div className="select-menu" id={listboxId} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => {
            const selected = option.value === value
            const active = index === activeIndex
            return (
              <button
                key={option.value}
                id={`${listboxId}-option-${index}`}
                className={`select-option${selected ? ' selected' : ''}${active ? ' active' : ''}`}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => selectOption(index)}
                onPointerEnter={() => setActiveIndex(index)}
              >
                <span>{option.label}</span>
                {selected && <Check className="select-check" size={16} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
