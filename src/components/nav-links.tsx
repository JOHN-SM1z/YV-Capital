"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export type NavItem = { href: string; label: string; exact?: boolean; badgeKey?: "unread" };

export function NavLinks({ items, unread }: { items: NavItem[]; unread?: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((item) => {
        const active = item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active ? "bg-white/10 font-medium text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
            )}
          >
            {item.label}
            {item.badgeKey === "unread" && !!unread && <span className="ml-2 rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">{unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
