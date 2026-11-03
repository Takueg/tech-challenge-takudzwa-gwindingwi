import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DropdownMenu } from "radix-ui";
import { useNavigate } from "react-router-dom";
import { useAppDialogs } from "@/components/app/app-dialogs";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCurrentUser, useCurrentUserRecord } from "@/context/current-user";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

function AccountMenu() {
  const navigate = useNavigate();
  const { logout } = useCurrentUser();
  const { user } = useCurrentUserRecord();
  const name = user?.name ?? "";
  const avatarColors = "bg-ink text-honeydew";

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`${name}, account menu`}
        className="group flex h-12 flex-none cursor-pointer items-center gap-2.5 rounded-3xl border-0 bg-honeydew pr-3.5 pl-1.5 [font:500_15px/1_var(--font-poppins)] text-ink"
      >
        <Avatar size={36} src={user?.avatarUrl || undefined} name={name} className="bg-ink" fallbackClassName={avatarColors} />
        <span>{name}</span>
        <Icon name="expand_more" size={16} className="group-data-[state=open]:rotate-180" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          aria-label="Account"
          className="z-40 box-border flex w-[280px] flex-col gap-0.5 rounded-[20px] bg-dialog p-2.5 text-foreground"
        >
          <div className="flex items-center gap-3 px-3.5 pt-2.5 pb-3.5">
            <Avatar size={40} src={user?.avatarUrl || undefined} name={name} className="bg-ink" fallbackClassName={avatarColors} />
            <span className="flex min-w-0 flex-col gap-[3px]">
              <strong className="[font:600_15px/20px_var(--font-poppins)]">{name}</strong>
              <span className="truncate [font:400_13px/18px_var(--font-poppins)] text-muted-foreground">{user?.email}</span>
            </span>
          </div>
          <DropdownMenu.Item className="app-option" onSelect={() => navigate("/settings")}>
            <Icon name="account_circle" size={20} />
            <span>Profile &amp; Settings</span>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="mx-2.5 my-1.5 h-px bg-[var(--rule)]" />
          <DropdownMenu.Item
            className="app-option"
            onSelect={() => {
              logout();
              navigate("/login");
            }}
          >
            <Icon name="logout" size={20} />
            <span>Log Out</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Search and account, right-aligned in every page's top row. */
export function HeaderActions({ className }: { className?: string }) {
  const { openPalette } = useAppDialogs();
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-3", className)}>
      <button
        type="button"
        className="app-navsearch min-w-[200px] flex-[0_1_360px]"
        aria-label="Search groups, expenses and actions (Command K)"
        onClick={openPalette}
      >
        <Icon name="search" size={18} />
        <span>Search groups, expenses, actions</span>
        <kbd className="app-kbd">⌘K</kbd>
      </button>
      <AccountMenu />
    </div>
  );
}

function OfflineBanner() {
  const queryClient = useQueryClient();
  return (
    <div role="alert" className="mb-7 flex flex-wrap items-center gap-3.5 rounded-[22px] bg-danger-soft px-5 py-4 text-danger-ink">
      <Icon name="wifi_off" size={24} />
      <span className="flex-[1_1_240px] [font:400_14px/20px_var(--font-poppins)]">
        <strong className="font-semibold">You’re offline.</strong> Balances may be out of date. Changes are paused until
        you reconnect.
      </span>
      <Button
        variant="text"
        className="text-danger-ink shadow-[inset_0_0_0_2px_var(--danger)]"
        onClick={() => queryClient.refetchQueries({ type: "active" })}
      >
        Retry
      </Button>
    </div>
  );
}

/** A page's `main`: the header band on the green, then the sheet with the page content. */
export function PageLayout({
  header,
  busy,
  sheetClassName,
  headerClassName,
  children,
}: {
  header: ReactNode;
  busy?: boolean;
  sheetClassName?: string;
  headerClassName?: string;
  children: ReactNode;
}) {
  const online = useOnline();
  return (
    <main aria-busy={busy ? true : undefined} className="flex min-w-0 flex-1 flex-col">
      <header className={cn("px-[37px] pt-[30px] pb-9 text-on-screen", headerClassName)}>
        <div className="mx-auto max-w-[1200px]">{header}</div>
      </header>
      <div className={cn("grow rounded-tl-[70px] bg-sheet px-[37px] pt-12 pb-[72px] text-foreground", sheetClassName)}>
        <div className="mx-auto max-w-[1200px]">
          {!online && <OfflineBanner />}
          {children}
        </div>
      </div>
    </main>
  );
}
