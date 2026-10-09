import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver } from "./types";

const baseDir = path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || ".data/media");
const publicPath = process.env.LOCAL_STORAGE_PUBLIC_PATH || "/media";

function resolveKeyPath(key: string): string {
  const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(baseDir, normalized);
}

export const localStorageDriver: StorageDriver = {
  async put(key, data) {
    const filePath = resolveKeyPath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return { key, url: this.publicUrl(key) };
  },
  async delete(key) {
    const filePath = resolveKeyPath(key);
    await rm(filePath, { force: true });
  },
  publicUrl(key) {
    return `${publicPath}/${key}`;
  },
};

export async function readLocalObject(key: string): Promise<Buffer> {
  return readFile(resolveKeyPath(key));
}
