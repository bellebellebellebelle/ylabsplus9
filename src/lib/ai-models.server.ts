import { isCentralModel, RECOMMENDED, type AiAppKey } from "./ai-models";

/** Returns the model the user chose for an app in Settings, or `fallback` (default: the recommended model). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveAppAiModel(db: any, userId: string, app: AiAppKey, fallback: string = RECOMMENDED[app]): Promise<string> {
  try {
    const { data } = await db.from("user_app_models").select("model_id").eq("user_id", userId).eq("app_key", app).maybeSingle();
    return isCentralModel(data?.model_id) ? data.model_id : fallback;
  } catch {
    return fallback;
  }
}
