import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { blake3 } from "@noble/hashes/blake3.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { RepoFile } from "./schema.js";

export function cacheKey(files: RepoFile[], promptVersion: string, modelId: string): string {
  const material = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => `${file.path}\0${file.content}`)
    .join("\0");
  return bytesToHex(blake3(new TextEncoder().encode(`${material}\0${promptVersion}\0${modelId}`)));
}

export interface CacheStore {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export class DiskCache implements CacheStore {
  constructor(private readonly directory: string) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return JSON.parse(await readFile(join(this.directory, `${key}.json`), "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async put<T>(key: string, value: T): Promise<void> {
    const target = join(this.directory, `${key}.json`);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value)}\n`, "utf8");
    await rename(temporary, target);
  }
}

export class MemoryCache implements CacheStore {
  private readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T): Promise<void> { this.values.set(key, value); }
}
