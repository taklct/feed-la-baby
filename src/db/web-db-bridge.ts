import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { DATABASE_NAME, initDatabase } from "./database";

type Params = Parameters<SQLiteDatabase["runAsync"]>[1];
type Op = "run" | "all" | "first" | "exec" | "txBegin" | "txEnd";

type Request = {
  kind: "req";
  id: string;
  from: string;
  op: Op;
  sql?: string;
  params?: Params;
  commit?: boolean;
};

type Reply = {
  kind: "res";
  id: string;
  to: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

type Message = Request | Reply;

const CHANNEL_NAME = "feedla-db";
const LEADER_LOCK = "feedla-db-leader";
const TX_TIMEOUT_MS = 5000;
const RETRY_MS = 1000;
const REPLY_CACHE_SIZE = 500;

function toPlain(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

let instance: SQLiteDatabase | null = null;

function assertBrowserSupport() {
  const missing: string[] = [];
  if (typeof BroadcastChannel === "undefined") missing.push("BroadcastChannel");
  if (typeof navigator === "undefined" || !navigator.locks)
    missing.push("navigator.locks");
  if (
    typeof crypto === "undefined" ||
    typeof crypto.randomUUID !== "function"
  ) {
    missing.push("crypto.randomUUID");
  }
  if (missing.length > 0) {
    throw new Error(`This browser is missing: ${missing.join(", ")}`);
  }
}

// The first open tab owns the real database; other tabs send their queries to it.
export function getWebDb(): SQLiteDatabase {
  // Server render has no database; effects that query it never run there.
  if (typeof window === "undefined") return null as unknown as SQLiteDatabase;
  if (!instance) {
    assertBrowserSupport();
    instance = createBridge();
  }
  return instance;
}

function createBridge(): SQLiteDatabase {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const clientId = crypto.randomUUID();
  const waiting = new Map<string, (reply: Reply) => void>();
  const replies = new Map<string, Promise<Reply>>();
  const openTx = new Map<
    string,
    { release: () => void; timer: ReturnType<typeof setTimeout> }
  >();

  let isLeader = false;
  let leaderDb: Promise<SQLiteDatabase> | null = null;

  // Queues statements and transactions in the leader so tabs never interleave.
  let tail: Promise<void> = Promise.resolve();
  const acquire = (): Promise<() => void> => {
    let release: () => void = () => {};
    const next = new Promise<void>((resolve) => (release = resolve));
    const granted = tail.then(() => release);
    tail = tail.then(() => next);
    return granted;
  };

  const endTx = async (from: string, commit: boolean) => {
    const tx = openTx.get(from);
    if (!tx || !leaderDb) return;
    clearTimeout(tx.timer);
    openTx.delete(from);
    const db = await leaderDb;
    try {
      await db.execAsync(commit ? "COMMIT" : "ROLLBACK");
    } catch (e) {
      await db.execAsync("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      tx.release();
    }
  };

  const execute = (db: SQLiteDatabase, msg: Request): Promise<unknown> => {
    const sql = msg.sql ?? "";
    switch (msg.op) {
      case "run":
        return db.runAsync(sql, msg.params).then((r) => ({
          lastInsertRowId: r.lastInsertRowId,
          changes: r.changes,
        }));
      case "all":
        return db.getAllAsync(sql, msg.params);
      case "first":
        return db.getFirstAsync(sql, msg.params);
      case "exec":
        return db.execAsync(sql);
      default:
        throw new Error(`Unexpected operation ${msg.op}`);
    }
  };

  const runOnLeader = async (msg: Request): Promise<unknown> => {
    if (!leaderDb) throw new Error("Database is not available in this tab");
    const db = await leaderDb;

    if (msg.op === "txBegin") {
      const release = await acquire();
      try {
        await db.execAsync("BEGIN");
      } catch (e) {
        release();
        throw e;
      }
      const timer = setTimeout(
        () => void endTx(msg.from, false),
        TX_TIMEOUT_MS,
      );
      openTx.set(msg.from, { release, timer });
      return null;
    }

    if (msg.op === "txEnd") {
      await endTx(msg.from, msg.commit === true);
      return null;
    }

    if (openTx.has(msg.from)) return execute(db, msg);

    const release = await acquire();
    try {
      return await execute(db, msg);
    } finally {
      release();
    }
  };

  const handleRequest = (msg: Request) => {
    let reply = replies.get(msg.id);
    if (!reply) {
      reply = runOnLeader(msg).then(
        (result): Reply => ({
          kind: "res",
          id: msg.id,
          to: msg.from,
          ok: true,
          result: toPlain(result),
        }),
        (e): Reply => ({
          kind: "res",
          id: msg.id,
          to: msg.from,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
      replies.set(msg.id, reply);
      if (replies.size > REPLY_CACHE_SIZE) {
        replies.delete(replies.keys().next().value as string);
      }
    }
    reply.then((r) => channel.postMessage(r));
  };

  channel.onmessage = (event: MessageEvent<Message>) => {
    const msg = event.data;
    if (msg.kind === "req") {
      if (isLeader) handleRequest(msg);
      return;
    }
    if (msg.to === clientId) waiting.get(msg.id)?.(msg);
  };

  const sendUntilAnswered = (msg: Request): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const timer = setInterval(() => channel.postMessage(msg), RETRY_MS);
      waiting.set(msg.id, (reply) => {
        clearInterval(timer);
        waiting.delete(msg.id);
        if (reply.ok) resolve(reply.result);
        else reject(new Error(reply.error));
      });
      channel.postMessage(msg);
    });

  const request = (
    op: Op,
    sql?: string,
    params?: Params,
    commit?: boolean,
  ): Promise<unknown> => {
    const msg: Request = {
      kind: "req",
      id: crypto.randomUUID(),
      from: clientId,
      op,
      sql,
      params,
      commit,
    };
    return isLeader ? runOnLeader(msg) : sendUntilAnswered(msg);
  };

  navigator.locks.request(LEADER_LOCK, () => {
    isLeader = true;
    leaderDb = openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await initDatabase(db);
      return db;
    });
    leaderDb.catch((e) => console.warn("Database failed to open", e));
    return new Promise<void>(() => {});
  });

  return {
    runAsync: (sql: string, params?: Params) => request("run", sql, params),
    getAllAsync: (sql: string, params?: Params) => request("all", sql, params),
    getFirstAsync: (sql: string, params?: Params) =>
      request("first", sql, params),
    execAsync: (sql: string) => request("exec", sql),
    withTransactionAsync: async <T>(task: () => Promise<T>): Promise<T> => {
      await request("txBegin");
      let result: T;
      try {
        result = await task();
      } catch (e) {
        await request("txEnd", undefined, undefined, false);
        throw e;
      }
      await request("txEnd", undefined, undefined, true);
      return result;
    },
  } as unknown as SQLiteDatabase;
}
