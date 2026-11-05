import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMailConfig } from "@/lib/mail.functions";

export function useMailbox() {
  return useQuery({
    queryKey: ["mailbox"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("mailboxes").select("*").eq("user_id", u.user.id).maybeSingle();
      return data;
    },
  });
}

export function useMailConfig() {
  const fn = useServerFn(getMailConfig);
  return useQuery({ queryKey: ["mail-config"], queryFn: () => fn() });
}
