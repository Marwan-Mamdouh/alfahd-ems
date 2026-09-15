"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { SidebarContent } from "./sidebar-content";

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 💻 Desktop Sidebar */}
      <aside className="hidden h-screen w-64 flex-col border-l bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarContent />
      </aside>

      {/* 📱 Mobile Menu Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="fixed right-3 top-3 z-40 lg:hidden"
        aria-label="فتح القائمة"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* 📱 Mobile Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <SheetTitle className="sr-only">قائمة التنقل</SheetTitle>

          <div className="flex h-full flex-col">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
