"use client";

import { useState } from "react";
import { currencyValueInWords, formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";

type CurrencyInputProps = {
  value: string | number;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
};

export default function CurrencyInput({ value, onChange, className, placeholder = "0,00", min, max, required, readOnly, disabled, id, name }: CurrencyInputProps) {
  const valueText = String(value ?? "");
  const [display, setDisplay] = useState(valueText);
  const [previousValue, setPreviousValue] = useState(valueText);
  const parsed = parseCurrencyInput(display);
  const words = currencyValueInWords(display);

  if (valueText !== previousValue) {
    setPreviousValue(valueText);
    setDisplay(valueText);
  }

  function speakValue() {
    if (!words || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(words);
    utterance.lang = "pt-BR";
    window.speechSynthesis.speak(utterance);
  }

  function validate(input: HTMLInputElement, currentValue: string) {
    const amount = parseCurrencyInput(currentValue);
    input.setCustomValidity("");
    if (currentValue && !Number.isFinite(amount)) input.setCustomValidity("Digite um valor monetário válido.");
    else if (currentValue && min !== undefined && amount < min) input.setCustomValidity(`O valor mínimo é ${formatCurrencyInput(min)}.`);
    else if (currentValue && max !== undefined && amount > max) input.setCustomValidity(`O valor máximo é ${formatCurrencyInput(max)}.`);
  }

  return <div className="w-full">
    <input id={id} name={name} type="text" inputMode="decimal" autoComplete="off" value={display} onChange={(event) => { setDisplay(event.target.value); onChange(event.target.value); event.currentTarget.setCustomValidity(""); }} onBlur={(event) => { const formatted = formatCurrencyInput(display); if (Number.isFinite(parsed)) { setDisplay(formatted); onChange(formatted); } validate(event.currentTarget, display); }} placeholder={placeholder} required={required} readOnly={readOnly} disabled={disabled} className={className} aria-invalid={Boolean(display && !Number.isFinite(parsed))} />
    {words && <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500"><span aria-live="polite">Por extenso: {words}</span><button type="button" onClick={speakValue} className="rounded px-1.5 py-0.5 font-medium text-purple-700 hover:bg-purple-50" aria-label={`Ouvir valor: ${words}`}>🔊 Ouvir</button></div>}
  </div>;
}
