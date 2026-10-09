import { localStorageDriver } from "./local";
import { s3StorageDriver } from "./s3";
import type { StorageDriver } from "./types";

export const storage: StorageDriver =
  process.env.STORAGE_DRIVER === "s3" ? s3StorageDriver : localStorageDriver;

export * from "./types";
