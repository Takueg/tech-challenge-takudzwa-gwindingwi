import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DropdownMenu } from "radix-ui";
import { Link, NavLink } from "react-router-dom";
import { useAppDialogs } from "@/components/app/app-dialogs";
import { LogoMark } from "@/components/app/logo";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/context/current-user";
import { useTRPC } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type SortMode = "recent" | "name" | "balance";

const SORT_OPTIONS: { value: SortMode; label: string; icon: string }[] = [
  { value: "recent", label: "Recent Activity", icon: "history" },
  { value: "name", label: "Name A–Z", icon: "sort" },
  { value: "balance", label: "Biggest Balance", icon: "balance" },
];

const navItemClass = (isActive: boolean, extra?: string) => cn("swl-side__item", isActive && "is-active", extra);

function RoundIcon({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 items-center justify-center rounded-full bg-honeydew text-ink"
    >
      <Icon name={name} size={18} />
    </span>
  );
}

export function SideNav({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const trpc = useTRPC();
  const { currentUserId } = useCurrentUser();
  const { openNewGroup } = useAppDialogs();
  const [sort, setSort] = useState<SortMode>("recent");
  const groups = useQuery(trpc.groups.list.queryOptions({ userId: currentUserId ?? "" }));
  const balances = useQuery({
    ...trpc.stats.myBalances.queryOptions({ userId: currentUserId ?? "" }),
    enabled: Boolean(currentUserId),
  });

  const netOf = (groupId: string) =>
    Math.abs(balances.data?.perGroup.find((g) => g.groupId === groupId)?.netCents ?? 0);
  const sorted = [...(groups.data ?? [])].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "balance") return netOf(b.id) - netOf(a.id);
    return b.lastActivityAt.localeCompare(a.lastActivityAt);
  });
  const current = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];
  const sortName = current.label.toLowerCase().replace("a–z", "A–Z");

  return (
    <nav
      aria-label="Main"
      className={cn(
        "box-border flex w-[264px] flex-col gap-1.5 bg-screen px-5 pt-8 pb-7 text-on-screen",
        className
      )}
    >
      <Link
        to="/"
        onClick={onNavigate}
        aria-label="SplitwiseLite, go to dashboard"
        className="flex items-center gap-3 px-3 pb-[26px] text-on-screen no-underline"
      >
        <LogoMark />
        <span className="whitespace-nowrap [font:700_22px/1_var(--font-poppins)] tracking-[-0.01em]">SplitwiseLite</span>
      </Link>

      <NavLink to="/" end onClick={onNavigate} className={({ isActive }) => navItemClass(isActive)}>
        <Icon name="home" size={22} />
        <span>Dashboard</span>
      </NavLink>

      <div className="relative mt-[18px] mb-1 flex items-center gap-0.5 pl-4">
        <h2
          id="nav-groups"
          className="m-0 flex flex-1 flex-col gap-1 [font:600_13px/1_var(--font-poppins)] tracking-[.02em]"
        >
          Groups
          <span className="[font:400_12px/1_var(--font-poppins)] tracking-normal">By {sortName}</span>
        </h2>
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger className="app-iconbtn" aria-label={`Sort groups, currently by ${sortName}`} title="Sort groups">
            <RoundIcon name="sort" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              alignOffset={-46}
              sideOffset={6}
              aria-label="Sort groups"
              className="z-40 box-border flex w-[224px] flex-col gap-0.5 rounded-[20px] bg-dialog p-2 text-foreground"
            >
              <DropdownMenu.Label className="px-3 pt-2 pb-1.5 [font:600_12px/1_var(--font-poppins)] text-muted-foreground">
                Sort Groups By
              </DropdownMenu.Label>
              <DropdownMenu.RadioGroup value={sort} onValueChange={(value) => setSort(value as SortMode)}>
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenu.RadioItem key={option.value} value={option.value} className="app-option min-h-11">
                    <Icon name={option.icon} size={18} />
                    <span className="flex-1">{option.label}</span>
                    <DropdownMenu.ItemIndicator className="flex">
                      <Icon name="check" size={18} />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <button type="button" className="app-iconbtn" aria-label="New group" title="New group" onClick={openNewGroup}>
          <RoundIcon name="add" />
        </button>
      </div>

      {groups.isLoading ? (
        <div aria-hidden="true" className="flex flex-col gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex h-11 items-center gap-3 pl-4">
              <Skeleton onScreen width={26} height={26} radius={9} />
              <Skeleton onScreen line width={110} height={12} />
            </div>
          ))}
        </div>
      ) : groups.isError ? (
        <button type="button" className="swl-side__item swl-side__item--group" onClick={() => groups.refetch()}>
          <Icon name="cloud_off" size={20} />
          Couldn’t load. Try again
        </button>
      ) : (
        <ul aria-labelledby="nav-groups" className="m-0 flex list-none flex-col gap-0.5 p-0">
          {sorted.map((group) => (
            <li key={group.id}>
              <NavLink
                to={`/groups/${group.id}`}
                onClick={onNavigate}
                className={({ isActive }) => navItemClass(isActive, "swl-side__item--group")}
              >
                <span
                  aria-hidden="true"
                  className="flex size-[26px] flex-none items-center justify-center rounded-[9px] bg-honeydew [font:600_12px/1_var(--font-poppins)] text-ink"
                >
                  {group.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{group.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}

      <div className="min-h-8 grow" />

      <NavLink
        to="/settings"
        onClick={onNavigate}
        className={({ isActive }) => navItemClass(isActive, isActive ? undefined : "app-side-pin")}
      >
        <Icon name="settings" size={22} />
        <span>Settings</span>
      </NavLink>
    </nav>
  );
}
