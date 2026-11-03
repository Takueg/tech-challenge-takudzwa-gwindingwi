import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AddExpenseDialog } from "@/components/app/add-expense-dialog";
import { CommandPalette } from "@/components/app/command-palette";
import { NewGroupDialog } from "@/components/app/new-group-dialog";
import { SettleUpDialog } from "@/components/app/settle-up-dialog";

type OpenDialog = { kind: "palette" | "settle" | "group" } | { kind: "add"; groupId?: string } | null;

type AppDialogs = {
  openPalette: () => void;
  openAddExpense: (groupId?: string) => void;
  openSettleUp: () => void;
  openNewGroup: () => void;
  /** The expense just added or edited, highlighted briefly in whichever table shows it. */
  newExpenseId: string | null;
  markNewExpense: (expenseId: string) => void;
};

const NEW_ROW_HIGHLIGHT_MS = 4000;

const AppDialogsContext = createContext<AppDialogs | null>(null);

/** The dialogs any screen can open, from the nav, the palette or a page. */
export function AppDialogsProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [newExpenseId, setNewExpenseId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const close = useCallback(() => setDialog(null), []);
  const markNewExpense = useCallback((expenseId: string) => {
    clearTimeout(highlightTimer.current);
    setNewExpenseId(expenseId);
    highlightTimer.current = setTimeout(() => setNewExpenseId(null), NEW_ROW_HIGHLIGHT_MS);
  }, []);
  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  const value = useMemo<AppDialogs>(
    () => ({
      openPalette: () => setDialog({ kind: "palette" }),
      openAddExpense: (groupId) => setDialog({ kind: "add", groupId }),
      openSettleUp: () => setDialog({ kind: "settle" }),
      openNewGroup: () => setDialog({ kind: "group" }),
      newExpenseId,
      markNewExpense,
    }),
    [newExpenseId, markNewExpense]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setDialog((current) => (current?.kind === "palette" ? null : { kind: "palette" }));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <AppDialogsContext.Provider value={value}>
      {children}
      {dialog?.kind === "palette" && (
        <CommandPalette
          onClose={close}
          onAddExpense={() => value.openAddExpense()}
          onSettleUp={value.openSettleUp}
          onNewGroup={value.openNewGroup}
        />
      )}
      {dialog?.kind === "add" && (
        <AddExpenseDialog initialGroupId={dialog.groupId} onClose={close} onAdded={markNewExpense} />
      )}
      {dialog?.kind === "settle" && <SettleUpDialog onClose={close} />}
      {dialog?.kind === "group" && <NewGroupDialog onClose={close} />}
    </AppDialogsContext.Provider>
  );
}

export function useAppDialogs() {
  const ctx = useContext(AppDialogsContext);
  if (!ctx) throw new Error("useAppDialogs must be used within AppDialogsProvider");
  return ctx;
}
