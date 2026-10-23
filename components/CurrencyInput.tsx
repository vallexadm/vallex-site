"use client";

import { currencyValueInWords, formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import { currencyValidationMessage } from "@/lib/form-validation";

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
  const display = String(value ?? "");
  const parsed = parseCurrencyInput(display);
  const words = currencyValueInWords(display);


  function speakValue() {
    if (!words || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(words);
    utterance.lang = "pt-BR";
    window.speechSynthesis.speak(utterance);
  }

  function validate(input: HTMLInputElement, currentValue: string) {
    input.setCustomValidity(currencyValidationMessage(currentValue, min, max));
  }

  return <div className="w-full">
    <input id={id} name={name} type="text" inputMode="decimal" autoComplete="off" data-currency-input="true" data-currency-min={min} data-currency-max={max} value={display} onChange={(event) => { onChange(event.target.value); validate(event.currentTarget, event.target.value); }} onBlur={(event) => { const formatted = formatCurrencyInput(display); if (Number.isFinite(parsed)) { onChange(formatted); } validate(event.currentTarget, display); }} placeholder={placeholder} required={required} readOnly={readOnly} disabled={disabled} className={className} />
    {words && <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500"><span aria-live="polite">Por extenso: {words}</span><button type="button" onClick={speakValue} className="rounded px-1.5 py-0.5 font-medium text-purple-700 hover:bg-purple-50" aria-label={`Ouvir valor: ${words}`}>🔊 Ouvir</button></div>}
  </div>;
}
