import { useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogCard, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { useCurrentUser } from "@/context/current-user";
import { useMyExpenses, useMyGroups } from "@/hooks/use-data";
import { searchExpenses } from "@/lib/expense-table";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = { id: string; label: string; icon: string; hint: string; action?: boolean; run: () => void };

/** Search groups and run actions, with the arrow keys and Enter. */
export function CommandPalette({
  onClose,
  onAddExpense,
  onSettleUp,
  onNewGroup,
}: {
  onClose: () => void;
  onAddExpense: () => void;
  onSettleUp: () => void;
  onNewGroup: () => void;
}) {
  const navigate = useNavigate();
  const { logout } = useCurrentUser();
  const { data: groups } = useMyGroups();
  const { data: expenses } = useMyExpenses();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (item: Item) => !needle || item.label.toLowerCase().includes(needle);
    const go = (to: string) => () => {
      onClose();
      navigate(to);
    };
    const actions: Item[] = [
      { id: "add", label: "Add An Expense", icon: "add", hint: "You paid", action: true, run: onAddExpense },
      { id: "settle", label: "Settle Up", icon: "handshake", hint: "Record a payment", action: true, run: onSettleUp },
      { id: "group", label: "Create A Group", icon: "group", hint: "New Group", action: true, run: onNewGroup },
    ];
    const groupItems: Item[] = (groups ?? []).map((group) => ({
      id: group.id,
      label: group.name,
      icon: "group",
      hint: `${group.memberIds.length} members`,
      run: go(`/groups/${group.id}`),
    }));
    const expenseItems: Item[] = searchExpenses(expenses ?? [], query).map((expense) => ({
      id: `expense-${expense.id}`,
      label: expense.description,
      icon: "receipt_long",
      hint: `${expense.groupName} · ${formatCents(expense.amountCents)}`,
      run: go(`/groups/${expense.groupId}`),
    }));
    const links: Item[] = [
      { id: "dashboard", label: "Dashboard", icon: "home", hint: "Totals, expenses", run: go("/") },
      { id: "settings", label: "Settings", icon: "settings", hint: "Profile, theme", run: go("/settings") },
      {
        id: "logout",
        label: "Log Out",
        icon: "logout",
        hint: "",
        run: () => {
          onClose();
          logout();
          navigate("/login");
        },
      },
    ];
    return [
      { title: "Actions", items: actions.filter(matches) },
      { title: "Groups", items: groupItems.filter(matches) },
      { title: "Expenses", items: expenseItems },
      { title: "Go To", items: links.filter(matches) },
    ].filter((section) => section.items.length > 0);
  }, [query, groups, expenses, navigate, logout, onClose, onAddExpense, onSettleUp, onNewGroup]);

  const flat = sections.flatMap((section) => section.items);
  const active = Math.min(activeIndex, Math.max(flat.length - 1, 0));

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (flat.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = (active + step + flat.length) % flat.length;
      setActiveIndex(next);
      document.getElementById(`pal-${flat[next].id}`)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      flat[active]?.run();
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogCard
        top
        width={600}
        className="flex flex-col gap-3 rounded-[20px] bg-dialog p-[18px] text-foreground"
      >
        <DialogTitle className="sr-only">Search and jump to</DialogTitle>
        <DialogDescription className="sr-only">Jump to a group or an expense, or run an action.</DialogDescription>
        <div className="swl-field__box h-[52px]">
          <span aria-hidden="true" className="flex pl-[18px] text-field-text">
            <Icon name="search" size={20} />
          </span>
          <label htmlFor="pal-input" className="sr-only">
            Search groups, expenses and actions
          </label>
          <input
            id="pal-input"
            className="swl-field__input !pl-3 !text-[17px]"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="pal-results"
            aria-activedescendant={flat[active] ? `pal-${flat[active].id}` : undefined}
            placeholder="Jump to a group, expense or action…"
            autoFocus
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
          />
          <kbd className="app-kbd mr-3">Esc</kbd>
        </div>
        <div id="pal-results" role="listbox" aria-label="Results" className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.title} role="group" aria-label={section.title} className="flex flex-col gap-0.5">
              <h3 className="mx-3.5 mt-1.5 mb-1 [font:600_12px/1_var(--font-poppins)] text-muted-foreground">
                {section.title}
              </h3>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  id={`pal-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={flat[active]?.id === item.id}
                  tabIndex={-1}
                  className={cn("app-option", flat[active]?.id === item.id && "is-active")}
                  onMouseMove={(event) => {
                    // A pointer resting where the palette opened shouldn't take the highlight.
                    if (event.movementX || event.movementY) setActiveIndex(flat.indexOf(item));
                  }}
                  onClick={item.run}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-[34px] flex-none items-center justify-center rounded-xl",
                      item.action ? "bg-primary text-ink" : "bg-sunken"
                    )}
                  >
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <span className="[font:400_13px/1_var(--font-poppins)] text-muted-foreground">{item.hint}</span>
                </button>
              ))}
            </div>
          ))}
          {flat.length === 0 && (
            <p role="status" className="m-0 px-3.5 py-7 text-center [font:400_15px/22px_var(--font-spartan)] text-muted-foreground">
              Nothing matches “{query}”. Try a group, an expense, or “add”.
            </p>
          )}
        </div>
      </DialogCard>
    </Dialog>
  );
}
