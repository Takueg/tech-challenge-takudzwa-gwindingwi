import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { errorMessage, httpStatusOf } from "@/lib/error-message";
import { notify } from "@/lib/notify";
import type { AppRouter } from "../../../server/src/routers/index.js";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** The screen shows this failure itself (a banner or a field error), so no toast. */
      handlesError?: boolean;
      errorTitle?: string;
    };
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx won't change on retry, so show the error state straight away.
      retry: (failureCount, error) => (httpStatusOf(error) ?? 500) >= 500 && failureCount < 2,
    },
  },
  // Every failed mutation tells the user why, so no screen can fail silently.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.handlesError) return;
      notify.error({ title: mutation.meta?.errorTitle ?? "That Didn’t Work", body: errorMessage(error) });
    },
  }),
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/trpc" })],
});

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export type RouterOutputs = inferRouterOutputs<AppRouter>;
