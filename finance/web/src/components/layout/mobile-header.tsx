"use client";

import { useState } from "react";
import { Menu, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavLinks } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  className?: string;
}

export function MobileHeader({ className }: MobileHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4",
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-primary" />
        <span className="font-semibold">Finance</span>
      </div>

      {/* Menu Button */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-64 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Finance
            </SheetTitle>
          </SheetHeader>
          <nav className="space-y-1 p-4">
            <NavLinks onNavigate={() => setOpen(false)} />
          </nav>
          <div className="absolute bottom-0 left-0 right-0 border-t p-4">
            <p className="text-xs text-muted-foreground">
              Local-first finance dashboard
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
