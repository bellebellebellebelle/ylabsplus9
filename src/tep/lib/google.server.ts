// Helpers Google (serveur uniquement) : OAuth 2.0 + Tasks + Calendar.

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/tasks.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export function googleCreds() {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  if (!clientId || !clientSecret) throw new Error("Identifiants Google manquants");
  return { clientId, clientSecret };
}

export function redirectUri(origin: string) {
  return `${origin}/api/public/tep-google/callback`;
}

export async function exchangeCode(code: string, origin: string) {
  const { clientId, clientSecret } = googleCreds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const body = (await res.json()) as {
    refresh_token?: string;
    access_token?: string;
    scope?: string;
    error_description?: string;
  };
  if (!res.ok) throw new Error(`Google token [${res.status}]: ${JSON.stringify(body)}`);
  return body;
}

async function accessTokenFor(refreshToken: string) {
  const { clientId, clientSecret } = googleCreds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json()) as { access_token?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Rafraîchissement Google échoué [${res.status}]: ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

export async function getRefreshToken(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("tep_google_connections")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Compte Google non connecté");
  return data.refresh_token;
}

export async function googleApi<T>(
  userId: string,
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const token = await accessTokenFor(await getRefreshToken(userId));
  const options: RequestInit = {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  };
  if (init?.body) options.body = JSON.stringify(init.body);
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok) throw new Error(`Google API [${res.status}]: ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}
