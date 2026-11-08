import type { ComponentChildren } from 'preact';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  return (
    <div class="scrim" onClick={onClose}>
      <div class="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div class="grab" />
        <h3>{title}</h3>
        <div class="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Stepper({ label, value, set, min = 1, max = 999, step = 1, unit }: { label: string; value: number; set: (n: number) => void; min?: number; max?: number; step?: number; unit?: string }) {
  return (
    <div class="stepper">
      <span class="grow">{label}</span>
      <button class="step-btn" aria-label={`Decrease ${label}`} onClick={() => set(Math.max(min, value - step))}>−</button>
      <b class="step-val" aria-live="polite">{value}{unit ? ` ${unit}` : ''}</b>
      <button class="step-btn" aria-label={`Increase ${label}`} onClick={() => set(Math.min(max, value + step))}>+</button>
    </div>
  );
}
