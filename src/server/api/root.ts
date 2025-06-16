import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";

export const appRouter = createTRPCRouter({
  hello: publicProcedure.query(() => {
    return {
      greeting: `Hello from tRPC`,
    };
  }),
});

export type AppRouter = typeof appRouter;
