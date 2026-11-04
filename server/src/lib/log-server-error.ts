import type { TRPCError } from "@trpc/server";

/** Only crashes are worth logging: a 4xx is the app working. Inputs stay out, since they hold passwords and emails. */
export function logServerError({ error, path }: { error: TRPCError; path?: string }): void {
  if (error.code !== "INTERNAL_SERVER_ERROR") return;
  console.error(`tRPC ${path ?? "unknown path"} failed:`, error.cause ?? error);
}
