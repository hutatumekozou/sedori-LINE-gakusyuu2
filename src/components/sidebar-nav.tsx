"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/",
    label: "ダッシュボード",
  },
  {
    href: "/items/new",
    label: "新規登録",
  },
  {
    href: "/items",
    label: "問題一覧",
  },
  {
    href: "/items/deleted",
    label: "削除した問題",
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === item.href
            : item.href === "/items"
              ? pathname === "/items" ||
                (pathname.startsWith("/items/") && !pathname.startsWith("/items/deleted"))
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-2xl border px-4 py-3 text-sm font-medium transition",
              isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
