"use client";
import { useId, useState, type InputHTMLAttributes } from "react";
export default function PasswordInput({ className, id, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const generatedId = useId();
  const [visible, setVisible] = useState(false);
  const inputId = id || generatedId;
  return <span className="relative block w-full">
    <input {...props} id={inputId} type={visible ? "text" : "password"} className={`${className || "w-full rounded-lg border border-slate-300 px-3 py-2.5"} w-full pr-14`} />
    <button type="button" disabled={props.disabled} onClick={() => setVisible(value => !value)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"} title={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible} aria-controls={inputId} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-violet-700 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:opacity-50">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visible && <path d="m3 3 18 18" />}</svg>
    </button>
  </span>;
}
