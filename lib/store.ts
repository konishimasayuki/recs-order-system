import fs from "fs";
import os from "os";
import path from "path";
import { AppState, DEFAULT_SELLER } from "./types";
import { hashPassword } from "./password";

/**
 * 状態はアプリ全体で1つの JSON ドキュメントとして保持する。
 * 取引件数が業務上限られるためこの構成で十分であり、
 * 読み取り→変更→書き込みを1トランザクションに閉じ込められる利点がある。
 *
 * - POSTGRES_URL / DATABASE_URL があれば Postgres（本番・Vercel）
 * - なければ JSON ファイル（ローカル検証用フォールバック）
 */

const CONNECTION_STRING =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

export const STORAGE_MODE: "postgres" | "file" = CONNECTION_STRING ? "postgres" : "file";

/** 保存層の失敗。原因を握りつぶさず、運用者向けの日本語メッセージを添える */
export class StorageError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "StorageError";
    this.cause = cause;
  }
}

function initialState(): AppState {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: "u_miami",
        loginId: "info@miamiholdings.co.jp",
        passwordHash: hashPassword("miami0383"),
        role: "admin",
        companyName: "MIAMIホールディングス株式会社",
        contactName: "",
        email: "info@miamiholdings.co.jp",
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

/**
 * 綴りを誤っていた受注アカウントのログインIDを正しいドメインへ移行する。
 * 初期データを直しただけでは、既に作成済みのDBには反映されないため
 * 読み込みのたびに旧IDを置き換える。
 */
const LOGIN_ID_MIGRATIONS: Record<string, string> = {
  "info@miamihoidings.co.jp": "info@miamiholdings.co.jp"
};

function migrateUsers(users: AppState["users"]): AppState["users"] {
  return users.map((u) => {
    const renamed = LOGIN_ID_MIGRATIONS[u.loginId.toLowerCase()];
    if (!renamed) return u;
    return {
      ...u,
      loginId: renamed,
      // 連絡先が旧IDと同じままなら合わせて直す（個別に変更済みなら触らない）
      email: LOGIN_ID_MIGRATIONS[u.email.toLowerCase()] ?? u.email
    };
  });
}

/** 後から追加したフィールドの欠落を埋める（既存データの前方互換） */
function normalize(state: AppState): AppState {
  return {
    users: migrateUsers(state.users ?? []),
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

/**
 * 保存先ディレクトリを実行時に決める。
 * Vercel のようにアプリのディレクトリが読み取り専用の環境では
 * `.data` を作れず EROFS で落ちるため、書き込める場所まで順に試す。
 */
const EPHEMERAL_DIR = path.join(os.tmpdir(), "recsgps-data");

const DIR_CANDIDATES = [
  process.env.RECSGPS_DATA_DIR,
  path.join(process.cwd(), ".data"),
  EPHEMERAL_DIR
].filter((d): d is string => Boolean(d));

let dataDir: string | null = null;

function resolveDataDir(): string {
  if (dataDir) return dataDir;

  const failures: string[] = [];
  for (const dir of DIR_CANDIDATES) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      dataDir = dir;
      if (dir === EPHEMERAL_DIR) {
        console.warn(
          `[recsgps] データを一時ディレクトリ (${dir}) に保存しています。` +
            "コールドスタートで消えるため、本番では POSTGRES_URL を設定してください。"
        );
      }
      return dir;
    } catch (err) {
      failures.push(`${dir}: ${(err as Error).message}`);
    }
  }

  throw new StorageError(
    "書き込み可能なデータ保存先が見つかりません。POSTGRES_URL（または DATABASE_URL）を設定してください。\n" +
      failures.join("\n")
  );
}

function filePath(): string {
  return path.join(resolveDataDir(), "state.json");
}

function fileRead(): AppState {
  const target = filePath();
  try {
    const raw = fs.readFileSync(target, "utf8");
    return normalize(JSON.parse(raw) as AppState);
  } catch {
    const fresh = initialState();
    fileWrite(fresh);
    return fresh;
  }
}

function fileWrite(state: AppState): void {
  const target = filePath();
  // 書き込み中に落ちても既存データを壊さないよう、一時ファイル経由で差し替える
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    // 解決済みのディレクトリが後から消えている場合に備えて作り直す
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tmp, target);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw new StorageError(`データの保存に失敗しました（${target}）。`, err);
  }
}

// ---------------- Postgres backend ----------------

type PgPool = import("pg").Pool;
let poolPromise: Promise<PgPool> | null = null;

async function createPool(): Promise<PgPool> {
  const { Pool } = await import("pg");
  const needsSsl = !/localhost|127\.0\.0\.1/.test(CONNECTION_STRING);
  const pool = new Pool({
    connectionString: CONNECTION_STRING,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 3
  });
  // プール側の異常でプロセスごと落ちるのを防ぐ（idle client のエラーは致命的ではない）
  pool.on("error", (err) => console.error("[recsgps] postgres pool error:", err));

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
}

async function getPool(): Promise<PgPool> {
  if (!poolPromise) {
    // 失敗した Promise をキャッシュすると、DBが復旧しても再デプロイまで復活しない。
    // 失敗時はキャッシュを捨てて次のリクエストで再接続できるようにする。
    poolPromise = createPool().catch((err) => {
      poolPromise = null;
      throw new StorageError(
        "データベースに接続できません。Vercel の POSTGRES_URL（または DATABASE_URL）を確認してください。",
        err
      );
    });
  }
  return poolPromise;
}

/** Pool と PoolClient のどちらも受け取れる最小の口 */
type Queryable = { query: (text: string, values?: any[]) => Promise<any> };

/** 行が消えている場合に初期状態を入れ直す（手動削除やDB再作成からの復旧） */
async function reseed(db: Queryable): Promise<AppState> {
  const fresh = initialState();
  await db.query(
    `INSERT INTO recsgps_state (id, data) VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [JSON.stringify(fresh)]
  );
  return fresh;
}

// ---------------- Public API ----------------

export interface StorageStatus {
  mode: "postgres" | "file";
  /** file モードでの保存先。まだ解決していなければ null */
  directory: string | null;
  /** 再起動・コールドスタートで消える場所に保存しているか */
  ephemeral: boolean;
}

/**
 * いま何処にデータを保存しているかを返す。
 * DB未接続のまま運用してデータを失う事故を管理画面で気づけるようにするためのもの。
 * 保存先はアクセスして初めて確定するため、readState() の後に呼ぶこと。
 */
export function getStorageStatus(): StorageStatus {
  if (STORAGE_MODE === "postgres") {
    return { mode: "postgres", directory: null, ephemeral: false };
  }
  return {
    mode: "file",
    directory: dataDir,
    ephemeral: dataDir !== null && dataDir === EPHEMERAL_DIR
  };
}

/** 読み取り専用でスナップショットを取得する */
export async function readState(): Promise<AppState> {
  if (STORAGE_MODE === "file") return fileRead();
  const pool = await getPool();
  const res = await pool.query<{ data: AppState }>(
    "SELECT data FROM recsgps_state WHERE id = 1"
  );
  const row = res.rows[0];
  if (!row) return normalize(await reseed(pool));
  return normalize(row.data);
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
    const row = res.rows[0];
    const state = normalize(row ? row.data : await reseed(client));
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

/**
 * 使われていない一番小さい番号を採る。
 * 単純な連番だと、削除したレコードの番号が二度と使えないため、
 * 現在使用中の番号を見て空き番号を割り当てる。
 */
function allocateNumber(prefix: string, used: Set<string>): string {
  let n = 1;
  while (used.has(`${prefix}${String(n).padStart(4, "0")}`)) n += 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export function nextOrderNumber(state: AppState): string {
  const prefix = `RG-${new Date().getFullYear()}-`;
  const number = allocateNumber(
    prefix,
    new Set(state.orders.map((o) => o.orderNumber))
  );
  // counters は「これまでの最大値」の控えとして残す
  state.counters.order = Math.max(state.counters.order, Number(number.slice(prefix.length)));
  return number;
}

export function nextInvoiceNumber(state: AppState): string {
  const prefix = `INV-${new Date().getFullYear()}-`;
  const number = allocateNumber(
    prefix,
    new Set(
      state.orders
        .map((o) => o.invoiceNumber)
        .filter((n): n is string => Boolean(n))
    )
  );
  state.counters.invoice = Math.max(
    state.counters.invoice,
    Number(number.slice(prefix.length))
  );
  return number;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
