"use client";

import Link from "next/link";

export default function AccessDock() {
  return (
    <aside className="access-dock" aria-label="Acessos rápidos">
      <details className="access-dock-disclosure">
        <summary className="access-dock-trigger">Acessos</summary>
        <div className="access-dock-panel">
          <strong>Acessos rápidos</strong>
          <Link href="/sistema/login">Área do prestador</Link>
          <Link href="/contato">Solicitar orçamento</Link>
          <Link href="/admin">Administração VALLEX</Link>
        </div>
      </details>
    </aside>
  );
}
