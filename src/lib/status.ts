import type { Status } from "./content.ts";

export const STATUS_LABEL: Record<Status, string> = {
  up_to_date: "Up to date",
  drifted: "Drifted",
  planned: "Planned",
};
