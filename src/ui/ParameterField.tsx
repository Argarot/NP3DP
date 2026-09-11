import { useEffect, useId, useState } from 'react';
import type { ParameterSpec } from '../domain/recipe';

export function ParameterField({ value, spec, onChange }: { value: number; spec: ParameterSpec; onChange: (value: number) => boolean }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setDraft(String(value)); setInvalid(false); }, [value]);
  const commit = () => {
    const n = Number(draft);
    if (!draft.trim() || !Number.isFinite(n) || n < spec.min || n > spec.max) { setInvalid(true); return; }
    setInvalid(false);
    if (n !== value && !onChange(n)) setDraft(String(value));
  };
  return <div className="parameter">
    <div className="parameter-label"><label htmlFor={id}>{spec.label}</label><div className="number-with-unit">
      <input aria-label={`${spec.label} value`} type="number" min={spec.min} max={spec.max} step={spec.step}
        value={draft} aria-invalid={invalid} onChange={(event) => setDraft(event.target.value)} onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') { commit(); event.currentTarget.blur(); } if (event.key === 'Escape') { setDraft(String(value)); setInvalid(false); event.currentTarget.blur(); } }} />
      <span>{spec.unit}</span></div></div>
    <input id={id} type="range" min={spec.min} max={spec.max} step={spec.step} value={value}
      style={{ '--fill': `${(value - spec.min) / (spec.max - spec.min) * 100}%` } as React.CSSProperties}
      onChange={(event) => { setInvalid(false); onChange(Number(event.target.value)); }} />
    {invalid && <span className="field-error">Enter {spec.min}–{spec.max} {spec.unit}.</span>}
  </div>;
}
