import { TRPCError } from "@trpc/server";

export const notFound = (message: string) => new TRPCError({ code: "NOT_FOUND", message });
export const badRequest = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });
export const conflict = (message: string) => new TRPCError({ code: "CONFLICT", message });
export const forbidden = (message: string) => new TRPCError({ code: "FORBIDDEN", message });
export const unauthorized = (message: string) => new TRPCError({ code: "UNAUTHORIZED", message });
