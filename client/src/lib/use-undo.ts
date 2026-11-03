import { errorMessage } from "@/lib/error-message";
import { notify } from "@/lib/notify";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";

/** Runs a toast's Undo. Uses a promise rather than a mutation hook, because the screen that showed it may be gone. */
export function useUndo() {
  const invalidate = useInvalidateExpenseData();

  return async (run: () => Promise<unknown>, done?: { title: string; body?: string }) => {
    try {
      await run();
      invalidate();
      if (done) notify.info(done);
    } catch (error) {
      notify.error({ title: "Couldn’t Undo", body: errorMessage(error) });
    }
  };
}
