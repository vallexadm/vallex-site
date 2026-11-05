"use client";

import { useState } from "react";
import ActionNotice from "@/components/ActionNotice";

export default function RecommendLink({ path, title, label }: {
  path: string;
  title: string;
  label: string;
}) {
  const [manualUrl, setManualUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function recommend() {
    const url = new URL(path, window.location.origin).href;
    setCopied(false);
    setManualUrl("");

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: "Minha indicação no ServiçoFácil", url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setManualUrl(url);
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => void recommend()}
        className="rounded-lg border border-purple-300 px-4 py-2.5 text-sm font-semibold text-purple-800 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-600"
      >
        {label}
      </button>
      {copied && <ActionNotice inline message="Link copiado. Cole na conversa para enviar sua indicação." onClose={() => setCopied(false)} />}
      {manualUrl && <label className="mt-2 block text-sm font-medium">
        Copie este link para enviar sua indicação
        <input className="mt-1 w-full rounded-lg border border-slate-300 p-2" readOnly value={manualUrl} onFocus={event => event.currentTarget.select()} />
      </label>}
    </div>
  );
}
