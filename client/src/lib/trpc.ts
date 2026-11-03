import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/error-message";
import type { AppRouter } from "../../../server/src/routers/index.js";

export const queryClient = new QueryClient({
  // Every failed mutation tells the user why, so no screen can fail silently.
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  }),
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/trpc" })],
});

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
