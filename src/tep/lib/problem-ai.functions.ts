import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runBubbleAi, suggestBubbles, nextMove, clarifyProblem } from "./board-ai.server";

export const runBubble = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bubbleId: string }) => input)
  .handler(async ({ data, context }) => runBubbleAi(context.supabase as any, data.bubbleId));

export const getSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { boardId: string }) => input)
  .handler(async ({ data, context }) => ({
    suggestions: await suggestBubbles(context.supabase as any, data.boardId),
  }));

export const getNextMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { boardId: string }) => input)
  .handler(async ({ data, context }) => nextMove(context.supabase as any, data.boardId));

export const getClarification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { boardId: string }) => input)
  .handler(async ({ data, context }) => clarifyProblem(context.supabase as any, data.boardId));
