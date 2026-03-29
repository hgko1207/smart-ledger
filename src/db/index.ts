import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

// 환경변수가 없으면 로컬 SQLite 파일 사용
const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient(
  authToken ? { url, authToken } : { url }
);

export const db = drizzle(client, { schema });
