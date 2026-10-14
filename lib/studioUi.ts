// Labels shared by the studio pages.
export const STATUS_LABEL = { draft: "טיוטה", published: "פורסמה לתלמידים", archived: "בארכיון" } as const;
export const STATUS_STYLE = {
  draft: "bg-warn-soft text-warn",
  published: "bg-ok-soft text-ok",
  archived: "bg-paper text-muted",
} as const;
export type TaskStatusUi = keyof typeof STATUS_LABEL;
