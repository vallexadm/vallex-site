
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";
import AccessDock from "@/components/AccessDock";

export default function Header() {
  const pathname = usePathname();
  const servicesDropdownRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeDropdownOnOutsidePointer(event: PointerEvent) {
      const dropdown = servicesDropdownRef.current;
      if (dropdown?.open && !dropdown.contains(event.target as Node)) {
        dropdown.open = false;
      }
    }

    document.addEventListener("pointerdown", closeDropdownOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeDropdownOnOutsidePointer);
  }, []);

  function isCurrentPage(href: string) {
    const route = href.split(/[?#]/, 1)[0];
    if (route === "/") return pathname === "/";
    if (route === "/servicos" && pathname.startsWith("/prestador/")) return true;
    return pathname === route || pathname.startsWith(`${route}/`);
  }

  function openOnMouseEnter(event: ReactPointerEvent<HTMLDetailsElement>) {
    if (event.pointerType === "mouse") event.currentTarget.open = true;
  }

  function closeOnMouseLeave(event: ReactPointerEvent<HTMLDetailsElement>) {
    if (event.pointerType === "mouse") event.currentTarget.open = false;
  }

  function keepOpenOnMouseClick(event: ReactMouseEvent<HTMLElement>) {
    if (event.detail > 0 && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      event.preventDefault();
      const dropdown = event.currentTarget.parentElement;
      if (dropdown instanceof HTMLDetailsElement) dropdown.open = true;
    }
  }

  return (
    <header className="site-header">
      <div className="container header-content">

        <Link href="/" className="brand" aria-label="VALLEX - Página inicial">
          <Image
            src="/vallex-logo.png"
            alt="VALLEX"
            width={7271}
            height={5879}
            priority
            className="brand-logo"
          />
          <span className="brand-subtitle">SERVIÇOFÁCIL</span>
        </Link>

        <nav aria-label="Navegação principal">
          <ul className="nav-list">
            {siteConfig.navigation.map((item) => (
              <li key={item.href}>
                {item.children ? (
                  <details
                    ref={servicesDropdownRef}
                    className="nav-dropdown"
                    onPointerEnter={openOnMouseEnter}
                    onPointerLeave={closeOnMouseLeave}
                  >
                    <summary className={
                      isCurrentPage(item.href) || (
                        !siteConfig.navigation.some((navigationItem) =>
                          navigationItem.href !== item.href &&
                          !navigationItem.children &&
                          isCurrentPage(navigationItem.href)
                        ) && item.children.some((child) => isCurrentPage(child.href))
                      )
                        ? "is-active"
                        : undefined
                    } onClick={keepOpenOnMouseClick}>
                      {item.label}
                    </summary>
                    <ul className="nav-dropdown-menu">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={isCurrentPage(child.href) && !child.href.includes("#") ? "is-active" : undefined}
                            aria-current={isCurrentPage(child.href) && !child.href.includes("#") ? "page" : undefined}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <Link
                    href={item.href}
                    className={isCurrentPage(item.href) ? "is-active" : undefined}
                    aria-current={isCurrentPage(item.href) ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

      </div>
      <AccessDock />
    </header>
  );
}
