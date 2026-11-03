import { createCallerFactory } from "../trpc.js";
import { appRouter } from "../routers/index.js";

const createCaller = createCallerFactory(appRouter);

export function testCaller(): ReturnType<typeof createCaller> {
  return createCaller({});
}
