import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const appRouter = createTRPCRouter({
  hello: publicProcedure.query(() => {
    return {
      greeting: `Hello from tRPC`,
    };
  }),
});

export type AppRouter = typeof appRouter;
