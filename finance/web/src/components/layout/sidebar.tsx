"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  User,
  Lightbulb,
  FileText,
  DollarSign,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Holdings",
    href: "/holdings",
    icon: Wallet,
  },
  {
    label: "Profile",
    href: "/profile",
    icon: User,
  },
  {
    label: "Advisor",
    href: "/advisor",
    icon: Lightbulb,
  },
  {
    label: "Statements",
    href: "/statements",
    icon: FileText,
  },
];

interface NavLinksProps {
  onNavigate?: () => void;
}

export function NavLinks({ onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-screen w-64 flex-col border-r bg-card",
        className
      )}
    >
      {/* Logo/Title */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <DollarSign className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">Finance</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        <NavLinks />
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          Local-first finance dashboard
        </p>
      </div>
    </aside>
  );
}
