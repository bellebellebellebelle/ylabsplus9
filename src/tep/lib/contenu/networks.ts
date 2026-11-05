export type NetworkId = "instagram" | "tiktok" | "linkedin" | "x" | "youtube";

export type NetworkConfig = {
  id: NetworkId;
  label: string;
  ratio: string;
  imageSize: "1024x1024" | "1024x1536" | "1536x1024";
  captionLimit: number;
  hashtags: number;
  tone: string;
  colorVar: string;
};

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  instagram: {
    id: "instagram",
    label: "Instagram",
    ratio: "4:5 (1080×1350)",
    imageSize: "1024x1536",
    captionLimit: 2200,
    hashtags: 12,
    tone: "visuel, inspirant, storytelling court, emojis mesurés",
    colorVar: "var(--ig)",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    ratio: "9:16 (1080×1920)",
    imageSize: "1024x1536",
    captionLimit: 150,
    hashtags: 5,
    tone: "punchy, hook en 3 secondes, langage natif, script en plans",
    colorVar: "var(--tt)",
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    ratio: "1.91:1 (1200×628)",
    imageSize: "1536x1024",
    captionLimit: 3000,
    hashtags: 5,
    tone: "expert, valeur business, phrases courtes, sans emoji excessif",
    colorVar: "var(--li)",
  },
  x: {
    id: "x",
    label: "X",
    ratio: "16:9 (1600×900)",
    imageSize: "1536x1024",
    captionLimit: 280,
    hashtags: 2,
    tone: "incisif, une idée forte, format thread possible",
    colorVar: "var(--x)",
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    ratio: "16:9 (1920×1080)",
    imageSize: "1536x1024",
    captionLimit: 1000,
    hashtags: 3,
    tone: "titre cliquable, description SEO, chapitres",
    colorVar: "var(--yt)",
  },
};

export const NETWORK_LIST = Object.values(NETWORKS);

export type NoteKind = "post" | "trends" | "idea" | "hooks" | "repurpose" | "calendar";

export const KIND_LABELS: Record<NoteKind, string> = {
  post: "Studio de post",
  trends: "Tendances",
  idea: "Idée libre",
  hooks: "Accroches",
  repurpose: "Recyclage",
  calendar: "Planification",
};

export const STATUSES = ["idea", "draft", "ready", "scheduled", "published"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  idea: "Idée",
  draft: "Brouillon",
  ready: "Prêt",
  scheduled: "Planifié",
  published: "Publié",
};
