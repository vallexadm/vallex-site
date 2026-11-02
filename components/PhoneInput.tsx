"use client";
import type { InputHTMLAttributes } from "react";
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "").slice(0, 11);
export default function PhoneInput({ onChange, value, defaultValue, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={11} minLength={10} pattern="[0-9]{10,11}" title="Informe DDD e telefone, somente números (10 ou 11 dígitos)." {...(value !== undefined ? {value: digits(value)} : defaultValue !== undefined ? {defaultValue: digits(defaultValue)} : {})} onChange={event => { event.target.value = digits(event.target.value); onChange?.(event); }} />;
}
