import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/tep/components/contenu/AppShell";
import { Button } from "@/tep/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Brand } from "@/tep/lib/contenu/data";
import { useWorkspace } from "@/tep/lib/contenu/useWorkspace";

export const Route = createFileRoute("/_tep/_tepauth/contenu/marque")({
  head: () => ({
    meta: [
      { title: "Identité de marque — Nova Studio" },
      {
        name: "description",
        content:
          "Définissez ton de voix, audience, piliers de contenu et couleurs pour guider l’IA.",
      },
      { property: "og:title", content: "Identité de marque — Nova Studio" },
      {
        property: "og:description",
        content: "Votre ligne éditoriale alimente toutes les générations de contenu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrandPage,
});

function BrandPage() {
  const { user, brand, setBrand } = useWorkspace();
  const [form, setForm] = useState<Brand | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (brand) setForm(brand);
  }, [brand]);

  function set<K extends keyof Brand>(key: K, value: Brand[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    const { error } = await supabase
      .from("tep_brands")
      .update({
        name: form.name,
        description: form.description,
        tone: form.tone,
        audience: form.audience,
        pillars: form.pillars,
        hashtags: form.hashtags,
        font: form.font,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
      })
      .eq("id", form.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBrand(form);
    toast.success("Identité de marque enregistrée");
  }

  return (
    <AppShell email={user?.email}>
      <div className="h-full overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-5">
          <div>
            <h1 className="text-xl font-semibold">Identité de marque</h1>
            <p className="text-xs text-muted-foreground">
              Ces informations guident chaque génération de contenu.
            </p>
          </div>

          {form && (
            <div className="glass space-y-4 rounded-2xl p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nom de la marque</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="font">Typographie</Label>
                  <Input
                    id="font"
                    value={form.font}
                    placeholder="Ex. Satoshi / Inter"
                    onChange={(e) => set("font", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  placeholder="Que fait la marque, pour qui, avec quelle promesse ?"
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tone">Ton de voix</Label>
                  <Textarea
                    id="tone"
                    value={form.tone}
                    placeholder="Direct, expert, chaleureux…"
                    onChange={(e) => set("tone", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="audience">Audience</Label>
                  <Textarea
                    id="audience"
                    value={form.audience}
                    placeholder="Qui lit vos contenus ?"
                    onChange={(e) => set("audience", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pillars">Piliers de contenu</Label>
                <Textarea
                  id="pillars"
                  value={form.pillars}
                  placeholder="Éducation, coulisses, preuve sociale…"
                  onChange={(e) => set("pillars", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hashtags">Hashtags de marque</Label>
                <Input
                  id="hashtags"
                  value={form.hashtags}
                  placeholder="#marque #secteur"
                  onChange={(e) => set("hashtags", e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="primary">Couleur principale</Label>
                  <Input
                    id="primary"
                    type="color"
                    className="h-10 w-full p-1"
                    value={form.primary_color}
                    onChange={(e) => set("primary_color", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="secondary">Couleur secondaire</Label>
                  <Input
                    id="secondary"
                    type="color"
                    className="h-10 w-full p-1"
                    value={form.secondary_color}
                    onChange={(e) => set("secondary_color", e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={save} disabled={busy} className="w-full sm:w-auto">
                {busy ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
