"use client";

export default function ActionNotice({ message, error = false, inline = false, onClose }: {
  message: string; error?: boolean; inline?: boolean; onClose: () => void;
}) {
  return <div role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}
    className={`${inline ? "mt-4 w-full" : "fixed right-4 top-24 z-[70] max-h-[40vh] w-[calc(100%-2rem)] max-w-lg"} flex items-start gap-3 overflow-auto rounded-xl border p-4 shadow-lg ${error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>
    <p className="min-w-0 flex-1 break-words text-sm font-semibold">{message}</p>
    <button type="button" onClick={onClose} aria-label="Fechar mensagem" className="shrink-0 rounded border border-current px-3 py-2 text-sm">Fechar</button>
  </div>;
}
