import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export function currencyValidationMessage(value: string, min?: number, max?: number) {
  if (!value.trim()) return "";
  const amount = parseCurrencyInput(value);
  if (!Number.isFinite(amount)) return "Digite um valor monetário válido.";
  if (min !== undefined && amount < min) return `O valor mínimo é ${formatCurrencyInput(min)}.`;
  if (max !== undefined && amount > max) return `O valor máximo é ${formatCurrencyInput(max)}.`;
  return "";
}

export function installFormValidation(doc: Document) {
  const tracked = new Map<Control, { message: HTMLSpanElement; invalid: string | null; error: string | null }>();
  let sequence = 0;
  function control(target: EventTarget | null): target is Control {
    return target instanceof Element && target.matches("input,select,textarea") && Boolean((target as Control).form);
  }
  function prepare(field: Control) {
    if (field.dataset.validationOwnedCustom === "true") {
      field.setCustomValidity("");
      delete field.dataset.validationOwnedCustom;
    }
    if (!field.willValidate) return;
    if (field.dataset.currencyInput === "true") {
      const min = field.dataset.currencyMin === undefined ? undefined : Number(field.dataset.currencyMin);
      const max = field.dataset.currencyMax === undefined ? undefined : Number(field.dataset.currencyMax);
      field.setCustomValidity(currencyValidationMessage(field.value, min, max));
      field.dataset.validationOwnedCustom = "true";
    } else if (field.required && field instanceof HTMLInputElement && !["checkbox", "radio", "file"].includes(field.type) && field.value && !field.value.trim()) {
      field.setCustomValidity("Preencha este campo obrigatório.");
      field.dataset.validationOwnedCustom = "true";
    } else if (field.required && field instanceof HTMLTextAreaElement && field.value && !field.value.trim()) {
      field.setCustomValidity("Preencha este campo obrigatório.");
      field.dataset.validationOwnedCustom = "true";
    }
  }
  function clear(field: Control) {
    const state = tracked.get(field);
    if (!state) return;
    state.message.remove();
    const descriptions = (field.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((id) => id && id !== state.message.id);
    if (descriptions.length) field.setAttribute("aria-describedby", descriptions.join(" "));
    else field.removeAttribute("aria-describedby");
    if (state.invalid === null) field.removeAttribute("aria-invalid");
    else field.setAttribute("aria-invalid", state.invalid);
    if (state.error === null) field.removeAttribute("aria-errormessage");
    else field.setAttribute("aria-errormessage", state.error);
    delete field.dataset.validationInvalid;
    tracked.delete(field);
  }
  function message(field: Control) {
    const validity = field.validity;
    if (validity.valueMissing) {
      if (field instanceof HTMLSelectElement || (field instanceof HTMLInputElement && field.type === "radio")) return "Selecione uma opção obrigatória.";
      if (field instanceof HTMLInputElement && field.type === "checkbox") return "Marque esta opção para continuar.";
      return "Preencha este campo obrigatório.";
    }
    if (validity.customError) return field.validationMessage;
    if (validity.typeMismatch) return field instanceof HTMLInputElement && field.type === "email" ? "Informe um e-mail válido." : "Informe um endereço válido.";
    if (validity.tooShort) return `Informe pelo menos ${field instanceof HTMLSelectElement ? 0 : field.minLength} caracteres.`;
    if (validity.rangeUnderflow || validity.rangeOverflow) return "Informe um valor dentro do intervalo permitido.";
    if (validity.patternMismatch) return "Confira o formato solicitado para este campo.";
    return "Confira o preenchimento deste campo.";
  }
  function refresh(field: Control, reveal = false) {
    prepare(field);
    if (!field.willValidate || field.validity.valid) { clear(field); return; }
    if (!reveal && !tracked.has(field)) return;
    let state = tracked.get(field);
    if (!state) {
      const span = doc.createElement("span");
      do { span.id = `vallex-field-error-${++sequence}`; } while (doc.getElementById(span.id));
      span.className = "vallex-field-error";
      span.setAttribute("aria-live", "polite");
      state = { message: span, invalid: field.getAttribute("aria-invalid"), error: field.getAttribute("aria-errormessage") };
      tracked.set(field, state);
      // Mantem a mensagem no bloco do campo sem criar outra coluna no formulario.
      const label = field.closest("label");
      if (label) label.append(span);
      else field.insertAdjacentElement("afterend", span);
      field.setAttribute("aria-describedby", [field.getAttribute("aria-describedby"), span.id].filter(Boolean).join(" "));
    }
    const text = message(field);
    if (state.message.textContent !== text) state.message.textContent = text;
    field.dataset.validationInvalid = "true";
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-errormessage", state.message.id);
  }
  function onInvalid(event: Event) { if (control(event.target)) refresh(event.target, true); }
  function onBlur(event: Event) {
    if (control(event.target)) { const field = event.target; queueMicrotask(() => { if (field.isConnected) refresh(field, true); }); }
  }
  function onInput(event: Event) {
    if (!control(event.target)) return;
    const field = event.target;
    queueMicrotask(() => {
      if (!field.isConnected) return;
      refresh(field);
      if (field instanceof HTMLInputElement && field.type === "radio" && field.name && field.form) {
        for (const other of Array.from(field.form.elements)) {
          if (other instanceof HTMLInputElement && other.type === "radio" && other.name === field.name) refresh(other);
        }
      }
    });
  }
  function onSubmit(event: Event) {
    if (!(event.target instanceof HTMLFormElement)) return;
    const form = event.target;
    for (const field of Array.from(form.elements)) if (control(field)) prepare(field);
    if (!form.checkValidity()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      form.querySelector<HTMLElement>('[data-validation-invalid="true"]')?.focus();
    }
  }
  function onClick(event: Event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement | HTMLInputElement>("button,input[type=submit],input[type=image]");
    if (!button?.form || button.disabled || !["submit", "image"].includes(button.type)) return;
    for (const field of Array.from(button.form.elements)) if (control(field)) prepare(field);
  }
  function onReset(event: Event) {
    if (!(event.target instanceof HTMLFormElement)) return;
    const form = event.target;
    queueMicrotask(() => {
      for (const field of Array.from(form.elements)) {
        if (!control(field)) continue;
        clear(field);
        if (field.dataset.validationOwnedCustom === "true") { field.setCustomValidity(""); delete field.dataset.validationOwnedCustom; }
      }
    });
  }
  doc.addEventListener("invalid", onInvalid, true);
  doc.addEventListener("focusout", onBlur);
  doc.addEventListener("input", onInput);
  doc.addEventListener("change", onInput);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("submit", onSubmit, true);
  doc.addEventListener("reset", onReset);
  const observer = new MutationObserver(() => {
    for (const field of [...tracked.keys()]) {
      if (!field.isConnected) clear(field);
      else refresh(field);
    }
  });
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["required", "disabled", "readonly", "min", "max", "data-currency-min", "data-currency-max"] });
  return () => {
    observer.disconnect();
    doc.removeEventListener("invalid", onInvalid, true);
    doc.removeEventListener("focusout", onBlur);
    doc.removeEventListener("input", onInput);
    doc.removeEventListener("change", onInput);
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("submit", onSubmit, true);
    doc.removeEventListener("reset", onReset);
    for (const field of [...tracked.keys()]) {
      clear(field);
      if (field.dataset.validationOwnedCustom === "true") { field.setCustomValidity(""); delete field.dataset.validationOwnedCustom; }
    }
  };
}
