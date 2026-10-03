// A D1-shaped stand-in for unit tests: node:sqlite in memory with every migration applied.
// prepare(sql).bind(...).first()/all()/run(), and batch() as one transaction that rolls back on error (as D1 does).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

const MIGRATIONS = new URL('../migrations/', import.meta.url);
const plain = (row) => (row ? { ...row } : null); // node:sqlite rows have a null prototype

export function openD1() {
  const sqlite = new DatabaseSync(':memory:');
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(f, MIGRATIONS), 'utf8'));
  }
  const exec = (sql, params) => ({ results: sqlite.prepare(sql).all(...params).map(plain), success: true });
  const statement = (sql, params = []) => ({
    bind: (...values) => statement(sql, values),
    first: async () => plain(sqlite.prepare(sql).get(...params)),
    all: async () => exec(sql, params),
    run: async () => exec(sql, params),
    execSync: () => exec(sql, params),
  });
  return {
    sqlite,
    prepare: (sql) => statement(sql),
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const out = statements.map((s) => s.execSync());
        sqlite.exec('COMMIT');
        return out;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
