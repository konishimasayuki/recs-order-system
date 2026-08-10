import fs from "fs";
import path from "path";
import { AppState, DEFAULT_SELLER } from "./types";
import { hashPassword } from "./password";

/**
 * 状態はアプリ全体で1つの JSON ドキュメントとして保持する。
 * 取引件数が業務上限られるためこの構成で十分であり、
 * 読み取り→変更→書き込みを1トランザクションに閉じ込められる利点がある。
 *
 * - POSTGRES_URL / DATABASE_URL があれば Postgres（本番・Vercel）
 * - なければ .data/state.json（ローカル検証用フォールバック）
 */

const CONNECTION_STRING =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

export const STORAGE_MODE: "postgres" | "file" = CONNECTION_STRING ? "postgres" : "file";

const FILE_PATH = path.join(process.cwd(), ".data", "state.json");

function initialState(): AppState {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: "u_miami",
        loginId: "info@miamihoidings.co.jp",
        passwordHash: hashPassword("miami0383"),
        role: "admin",
        companyName: "MIAMIホールディングス株式会社",
        contactName: "",
        email: "info@miamihoidings.co.jp",
        postalCode: "",
        address: "",
        tel: "",
        defaultUnitPrice: null,
        active: true,
        createdAt: now
      },
      {
        id: "u_engine",
        loginId: "engine",
        passwordHash: hashPassword("miami0383"),
        role: "customer",
        companyName: "株式会社エンジン",
        contactName: "",
        email: "",
        postalCode: "",
        address: "",
        tel: "",
        defaultUnitPrice: null,
        active: true,
        createdAt: now
      },
      {
        id: "u_kcar",
        loginId: "kcar",
        passwordHash: hashPassword("3333"),
        role: "customer",
        companyName: "株式会社ThreeEight",
        contactName: "",
        email: "",
        postalCode: "",
        address: "",
        tel: "",
        defaultUnitPrice: null,
        active: true,
        createdAt: now
      }
    ],
    orders: [],
    deliveries: [],
    seller: { ...DEFAULT_SELLER },
    counters: { order: 0, invoice: 0 }
  };
}

/** 後から追加したフィールドの欠落を埋める（既存データの前方互換） */
function normalize(state: AppState): AppState {
  return {
    users: state.users ?? [],
    orders: (state.orders ?? []).map((o) => ({
      ...o,
      note: o.note ?? "",
      desiredDeliveryDate: o.desiredDeliveryDate ?? "",
      invoiceNumber: o.invoiceNumber ?? null,
      invoicedAt: o.invoicedAt ?? null
    })),
    deliveries: state.deliveries ?? [],
    seller: { ...DEFAULT_SELLER, ...(state.seller ?? {}) },
    counters: {
      order: state.counters?.order ?? 0,
      invoice: state.counters?.invoice ?? 0
    }
  };
}

// ---------------- File backend ----------------

function fileRead(): AppState {
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    return normalize(JSON.parse(raw) as AppState);
  } catch {
    const fresh = initialState();
    fileWrite(fresh);
    return fresh;
  }
}

function fileWrite(state: AppState): void {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(state, null, 2), "utf8");
}

// ---------------- Postgres backend ----------------

type PgPool = import("pg").Pool;
let poolPromise: Promise<PgPool> | null = null;

async function getPool(): Promise<PgPool> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const { Pool } = await import("pg");
      const needsSsl = !/localhost|127\.0\.0\.1/.test(CONNECTION_STRING);
      const pool = new Pool({
        connectionString: CONNECTION_STRING,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        max: 3
      });
      const client = await pool.connect();
      try {
        await client.query(
          `CREATE TABLE IF NOT EXISTS recsgps_state (
             id INT PRIMARY KEY,
             data JSONB NOT NULL,
             updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
           )`
        );
        await client.query(
          `INSERT INTO recsgps_state (id, data) VALUES (1, $1::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [JSON.stringify(initialState())]
        );
      } finally {
        client.release();
      }
      return pool;
    })();
  }
  return poolPromise;
}

// ---------------- Public API ----------------

/** 読み取り専用でスナップショットを取得する */
export async function readState(): Promise<AppState> {
  if (STORAGE_MODE === "file") return fileRead();
  const pool = await getPool();
  const res = await pool.query<{ data: AppState }>(
    "SELECT data FROM recsgps_state WHERE id = 1"
  );
  return normalize(res.rows[0].data);
}

/**
 * 状態を排他的に読み取り、mutator の変更を書き戻す。
 * Postgres では SELECT ... FOR UPDATE により同時更新の取りこぼしを防ぐ。
 */
export async function mutateState<T>(
  mutator: (state: AppState) => T | Promise<T>
): Promise<T> {
  if (STORAGE_MODE === "file") {
    const state = fileRead();
    const result = await mutator(state);
    fileWrite(state);
    return result;
  }

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query<{ data: AppState }>(
      "SELECT data FROM recsgps_state WHERE id = 1 FOR UPDATE"
    );
    const state = normalize(res.rows[0].data);
    const result = await mutator(state);
    await client.query(
      "UPDATE recsgps_state SET data = $1::jsonb, updated_at = now() WHERE id = 1",
      [JSON.stringify(state)]
    );
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export function nextOrderNumber(state: AppState): string {
  state.counters.order += 1;
  const y = new Date().getFullYear();
  return `RG-${y}-${String(state.counters.order).padStart(4, "0")}`;
}

export function nextInvoiceNumber(state: AppState): string {
  state.counters.invoice += 1;
  const y = new Date().getFullYear();
  return `INV-${y}-${String(state.counters.invoice).padStart(4, "0")}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
