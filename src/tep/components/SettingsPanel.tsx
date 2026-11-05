import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/tep/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (rapide)" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (approfondi)" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 mini (équilibré)" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  email: string;
};

export function SettingsPanel({ open, onOpenChange, userId, email }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [model, setModel] = useState(MODELS[0]!.id);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("tep_user_settings")
      .select("display_name, ai_model")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? "");
          setModel(data.ai_model);
        }
      });
  }, [open, userId]);

  const save = async (patch: { display_name?: string; ai_model?: string }) => {
    const { error } = await supabase
      .from("tep_user_settings")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    if (error) toast.error(error.message);
    else toast.success("Paramètres enregistrés");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Paramètres</SheetTitle>
          <SheetDescription>Configuration de votre tableau et de vos connexions.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="space-y-2">
            <Label htmlFor="displayName">Nom affiché</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => save({ display_name: displayName })}
              placeholder="Votre nom"
            />
            <p className="text-xs text-muted-foreground">Compte : {email}</p>
          </section>

          <p className="text-xs text-muted-foreground">
            Modèle IA : choisi dans Laboratoire → Paramètres → Modèles d’IA.
          </p>

          <section className="space-y-2 rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium">Apps SKY</h3>
            <p className="text-xs text-muted-foreground">
              Les post-it tâches vont dans SKY Task, les rendez-vous dans Calendsky et les e-mails
              partent via Sendy. Aucune connexion supplémentaire n'est nécessaire.
            </p>
          </section>

          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
          >
            <LogOut className="size-4" /> Se déconnecter
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
