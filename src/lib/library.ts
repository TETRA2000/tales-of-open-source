// The library as loaded for the site build. Loaded once per build process.

import { join } from "node:path";
import { loadLibrary, type Library } from "./content.ts";

let cached: Library | undefined;

export function getLibrary(): Library {
  cached ??= loadLibrary({ contentDir: join(process.cwd(), "content") });
  return cached;
}
