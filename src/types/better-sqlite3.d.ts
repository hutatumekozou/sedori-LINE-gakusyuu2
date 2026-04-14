declare module "better-sqlite3" {
  type StatementResult = {
    changes: number;
    lastInsertRowid: number | bigint;
  };

  type Statement<TRow = unknown> = {
    all(...params: unknown[]): TRow[];
    get(...params: unknown[]): TRow | undefined;
    run(...params: unknown[]): StatementResult;
  };

  class Database {
    constructor(filename: string);
    pragma(source: string): unknown;
    exec(source: string): this;
    prepare<TRow = unknown>(source: string): Statement<TRow>;
    close(): void;
  }

  export default Database;
}
