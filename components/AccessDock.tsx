"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";

export default function AccessDock() {
  const disclosureRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const disclosure = disclosureRef.current;
      if (disclosure && !disclosure.contains(event.target as Node)) {
        disclosure.removeAttribute("open");
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  function openOnMouseEnter(event: ReactPointerEvent<HTMLDetailsElement>) {
    if (event.pointerType === "mouse") disclosureRef.current?.setAttribute("open", "");
  }

  function closeOnMouseLeave(event: ReactPointerEvent<HTMLDetailsElement>) {
    if (event.pointerType === "mouse") disclosureRef.current?.removeAttribute("open");
  }

  function keepOpenOnMouseClick(event: ReactMouseEvent<HTMLElement>) {
    if (event.detail > 0 && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      event.preventDefault();
      disclosureRef.current?.setAttribute("open", "");
    }
  }

  return (
    <aside className="access-dock" aria-label="Acessos rápidos">
      <details
        ref={disclosureRef}
        className="access-dock-disclosure"
        onPointerEnter={openOnMouseEnter}
        onPointerLeave={closeOnMouseLeave}
      >
        <summary className="access-dock-trigger" onClick={keepOpenOnMouseClick}>Acessos</summary>
        <div className="access-dock-panel">
          <strong>Acessos rápidos</strong>
          <Link href="/sistema/login">Área do prestador</Link>
          <Link href="/admin">Administração VALLEX</Link>
        </div>
      </details>
    </aside>
  );
}
