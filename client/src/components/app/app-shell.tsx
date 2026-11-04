import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppDialogsProvider } from "@/components/app/app-dialogs";
import { LogoMark } from "@/components/app/logo";
import { SideNav } from "@/components/app/side-nav";
import { Dialog, DialogCard, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";

/** Below 1024px the nav collapses into a top bar with a drawer. */
function MobileBar() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-between px-5 pt-5 text-on-screen lg:hidden">
      <span className="flex items-center gap-3">
        <LogoMark />
        <span className="type-p700-22-1 tracking-[-0.01em]">SplitwiseLite</span>
      </span>
      <button type="button" className="app-iconbtn text-on-screen" aria-label="Open menu" onClick={() => setOpen(true)}>
        <Icon name="menu" size={24} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogCard className="fixed inset-y-0 left-0 m-0 flex w-[264px] overflow-y-auto bg-screen" width={264}>
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <DialogDescription className="sr-only">Main navigation</DialogDescription>
          <SideNav onNavigate={() => setOpen(false)} className="min-h-full" />
        </DialogCard>
      </Dialog>
    </div>
  );
}

export function AppShell() {
  return (
    <AppDialogsProvider>
      <div className="relative flex min-h-screen flex-col bg-screen text-foreground lg:flex-row">
        <SideNav className="hidden flex-none lg:flex" />
        <MobileBar />
        <Outlet />
      </div>
    </AppDialogsProvider>
  );
}
