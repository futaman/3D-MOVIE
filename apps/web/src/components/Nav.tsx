"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/forge", label: "Forge", hint: "作る" },
  { href: "/studio", label: "Studio", hint: "動かす" },
  { href: "/library", label: "Library" },
  { href: "/jobs", label: "Jobs" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="flex items-center gap-1 px-4 h-12 border-b" style={{ borderColor: "var(--border)" }}>
      <span className="font-semibold mr-4">3D-MOVIE</span>
      {items.map((it) => {
        const active = path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href}
            className={`px-3 py-1 rounded-md text-sm ${active ? "bg-[var(--panel)]" : "muted hover:text-[var(--text)]"}`}>
            {it.label}{it.hint && <span className="muted ml-1 text-xs">{it.hint}</span>}
          </Link>
        );
      })}
    </header>
  );
}
