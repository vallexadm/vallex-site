"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { siteConfig } from "@/config/site";
import Icon from "./MarketplaceIcon";
import styles from "./Marketplace.module.css";

const navIcons: Record<string, string> = { "/": "home", "/sobre": "info", "/servicos": "tool", "/solucoes": "sparkles", "/experiencias": "star", "/contato": "contact" };

export default function MarketplaceHeader({ initialSearch = "", initialLocation = "" }: { initialSearch?: string; initialLocation?: string }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const overflow = useRef("");
  function close() { dialog.current?.close(); }
  function restore() { document.body.style.overflow = overflow.current; opener.current?.focus(); }
  function open() {
    dialog.current?.querySelectorAll("details").forEach(group => { group.open = false; });
    overflow.current = document.body.style.overflow;
    dialog.current?.showModal();
    document.body.style.overflow = "hidden";
  }
  useEffect(() => () => { if (dialog.current?.open) document.body.style.overflow = overflow.current; }, []);
  return <>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <button ref={opener} type="button" className={styles.iconButton} aria-label="Abrir menu de navegação" aria-haspopup="dialog" aria-controls="vallex-site-menu" onClick={open}><Icon name="menu" /></button>
        <Link href="/" className={styles.brand} aria-label="VALLEX ServiçoFácil — Página inicial"><span className={styles.logoBackdrop}><Image src="/vallex-logo.png" alt="" width={56} height={46} priority /></span><span><strong>VALLEX</strong><small>ServiçoFácil</small></span></Link>
        <form action="/#prestadores" method="get" role="search" className={styles.headerSearch}>
          <label className={styles.searchField}><Icon name="search" /><span className={styles.srOnly}>Qual serviço você precisa?</span><input key={initialSearch} type="search" name="buscar" defaultValue={initialSearch} placeholder="Qual serviço você precisa?" maxLength={160} /></label>
          <label className={styles.locationField}><Icon name="pin" /><span className={styles.srOnly}>Cidade ou região</span><input key={initialLocation} name="localidade" defaultValue={initialLocation} placeholder="Cidade ou região" maxLength={120} /></label>
          <button type="submit" className={styles.searchButton} aria-label="Buscar prestadores"><Icon name="search" /></button>
        </form>
        <Link className={styles.loginLink} href="/sistema/login"><Icon name="user" />Entrar</Link>
        <Link className={styles.primaryButton} href="/sistema/login?cadastro=1">Sou prestador</Link>
      </div>
    </header>
    <dialog id="vallex-site-menu" ref={dialog} className={styles.drawer} aria-labelledby="vallex-menu-title" onClose={restore} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.drawerTop}><h2 id="vallex-menu-title">Explore a VALLEX<small>Serviços, soluções e oportunidades</small></h2><button autoFocus type="button" className={styles.iconButton} aria-label="Fechar menu" onClick={close}><Icon name="close" /></button></div>
      <nav aria-label="Navegação principal" className={styles.drawerNav} onClick={event => { if ((event.target as Element).closest("a")) close(); }}>
        {siteConfig.navigation.map(item => item.children ? <details key={item.href} className={styles.menuGroup}><summary><Icon name={navIcons[item.href]} />{item.label}</summary><div>{item.children.map(child => <Link key={child.href} href={child.href}>{child.label}</Link>)}</div></details> : <Link key={item.href} href={item.href} className={pathname === item.href ? styles.activeLink : undefined} aria-current={pathname === item.href ? "page" : undefined}><Icon name={navIcons[item.href]} />{item.label}</Link>)}
        <div className={styles.menuSecondary}><Link href="/catalogo">Todos os prestadores</Link><Link href="/faq">Perguntas frequentes</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos de uso</Link></div>
        <div className={styles.menuAccounts}><Link className={styles.primaryButton} href="/sistema/login"><Icon name="user" />Acessar minha conta</Link><Link href="/admin">Administração VALLEX</Link></div>
      </nav>
    </dialog>
  </>;
}
