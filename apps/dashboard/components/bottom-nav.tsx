"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { sair } from "@/app/login/actions";

const primary = [
  { href: "/", label: "Visão", icon: IconHome },
  { href: "/aprovacao", label: "Aprovar", icon: IconCheck },
  { href: "/grupos", label: "Grupos", icon: IconUsers },
  { href: "/whatsapp", label: "WhatsApp", icon: IconPhone },
] as const;

const more = [
  { href: "/fontes", label: "Fontes" },
  { href: "/configuracoes", label: "Configurações" },
  { href: "/credenciais", label: "Credenciais" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Navegação inferior no mobile — 4 destinos + menu Mais. */
export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-bg/70 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      {open ? (
        <div className="fixed bottom-16 left-3 right-3 z-50 rounded-xl border border-border bg-surface p-2 shadow-lg md:hidden">
          {more.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm ${
                isActive(pathname, link.href)
                  ? "bg-elevated font-medium text-ink"
                  : "text-mute hover:bg-elevated hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <form action={sair}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-mute hover:bg-elevated hover:text-ink"
            >
              Sair
            </button>
          </form>
        </div>
      ) : null}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur md:hidden"
        aria-label="Navegação principal"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          {primary.map((link) => {
            const active = isActive(pathname, link.href);
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium ${
                    active ? "text-accent" : "text-mute"
                  }`}
                >
                  <Icon active={active} />
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={`flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium ${
                open || more.some((l) => isActive(pathname, l.href))
                  ? "text-accent"
                  : "text-mute"
              }`}
              aria-expanded={open}
            >
              <IconMore active={open} />
              Mais
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke={active ? "currentColor" : "currentColor"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity={active ? 1 : 0.9}
      />
      <path
        d="m8 12 2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconUsers({ active: _active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 19c.8-2.4 2.8-4 5.5-4s4.7 1.6 5.5 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M15 15.2c1.7.4 3 1.6 3.6 3.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPhone({ active: _active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="7"
        y="3"
        width="10"
        height="18"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M10 17h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMore({ active: _active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
