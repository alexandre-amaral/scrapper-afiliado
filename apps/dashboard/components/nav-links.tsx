"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Visão geral" },
  { href: "/aprovacao", label: "Aprovação" },
  { href: "/fontes", label: "Fontes" },
  { href: "/grupos", label: "Grupos" },
  { href: "/configuracoes", label: "Configurações" },
  { href: "/credenciais", label: "Credenciais" },
  { href: "/whatsapp", label: "WhatsApp" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-neutral-800 font-medium text-neutral-100"
                : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
