import { useState } from "react";
import { Button } from "@/tep/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BOARD_TYPES } from "@/tep/lib/projects";

export function NewBoardDialog({
  open,
  onOpenChange,
  title,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  onCreate: (type: string, name: string) => Promise<void>;
}) {
  const [type, setType] = useState<string>("postit");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input placeholder="Nom du tableau" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid gap-2 sm:grid-cols-3">
          {BOARD_TYPES.map((b) => (
            <button
              key={b.type}
              type="button"
              onClick={() => setType(b.type)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                type === b.type ? "border-primary bg-accent" : "border-border hover:border-primary/50"
              }`}
            >
              <p className="font-medium">{b.label}</p>
              <p className="text-xs text-muted-foreground">{b.description}</p>
            </button>
          ))}
        </div>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const label = BOARD_TYPES.find((b) => b.type === type)!.label;
              await onCreate(type, name.trim() || label);
              setName("");
            } finally {
              setBusy(false);
            }
          }}
        >
          Créer
        </Button>
      </DialogContent>
    </Dialog>
  );
}
