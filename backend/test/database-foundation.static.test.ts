import assert from "node:assert/strict";

import {
  createHash,
} from "node:crypto";

import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import test from "node:test";

import {
  DatabaseConfigError,
  getDatabaseUrl,
} from "../src/config/database.js";

import {
  createDatabasePool,
} from "../src/db/client.js";

import {
  MigrationError,
  loadMigrations,
} from "../src/db/migrate.js";

test(
  "database configuration fails closed",
  () => {
    assert.throws(
      () => getDatabaseUrl({}),
      DatabaseConfigError,
    );

    assert.throws(
      () =>
        getDatabaseUrl({
          DATABASE_URL:
            "https://example.invalid/app",
        }),
      DatabaseConfigError,
    );

    assert.throws(
      () =>
        getDatabaseUrl({
          DATABASE_URL:
            "postgresql://db.example.invalid",
        }),
      DatabaseConfigError,
    );

    assert.equal(
      getDatabaseUrl({
        DATABASE_URL:
          "postgresql://db.example.invalid/app",
      }),
      "postgresql://db.example.invalid/app",
    );
  },
);

test(
  "database pool options reject invalid max",
  async () => {
    assert.throws(
      () =>
        createDatabasePool({
          connectionString:
            "postgresql://db.example.invalid/app",
          max: 0,
        }),
      RangeError,
    );

    assert.throws(
      () =>
        createDatabasePool({
          connectionString:
            "postgresql://db.example.invalid/app",
          max: -1,
        }),
      RangeError,
    );

    assert.throws(
      () =>
        createDatabasePool({
          connectionString:
            "postgresql://db.example.invalid/app",
          max: 1.5,
        }),
      RangeError,
    );

    const pool = createDatabasePool({
      connectionString:
        "postgresql://db.example.invalid/app",
      max: 1,
    });

    await pool.end();
  },
);

test(
  "migration loader hashes exact bytes",
  async () => {
    const directory = await mkdtemp(
      join(
        tmpdir(),
        "pa-dashboard-static-migration-",
      ),
    );

    try {
      const path = join(
        directory,
        "0001_probe.sql",
      );

      const content =
        "SELECT 1;\n-- exact bytes\n";

      await writeFile(
        path,
        content,
        "utf8",
      );

      const migrations =
        await loadMigrations(directory);

      assert.equal(
        migrations.length,
        1,
      );

      const migration = migrations[0];

      assert.ok(migration);

      const bytes = await readFile(path);

      const expectedChecksum =
        createHash("sha256")
          .update(bytes)
          .digest("hex");

      assert.equal(
        migration.version,
        "0001",
      );

      assert.equal(
        migration.filename,
        "0001_probe.sql",
      );

      assert.equal(
        migration.checksumSha256,
        expectedChecksum,
      );
    } finally {
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);

test(
  "migration loader rejects invalid filenames",
  async () => {
    const directory = await mkdtemp(
      join(
        tmpdir(),
        "pa-dashboard-invalid-migration-",
      ),
    );

    try {
      await writeFile(
        join(
          directory,
          "not-numbered.sql",
        ),
        "SELECT 1;\n",
        "utf8",
      );

      await assert.rejects(
        () => loadMigrations(directory),
        MigrationError,
      );
    } finally {
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);

test(
  "migration loader rejects duplicate versions",
  async () => {
    const directory = await mkdtemp(
      join(
        tmpdir(),
        "pa-dashboard-duplicate-migration-",
      ),
    );

    try {
      await writeFile(
        join(
          directory,
          "0001_alpha.sql",
        ),
        "SELECT 1;\n",
        "utf8",
      );

      await writeFile(
        join(
          directory,
          "0001_beta.sql",
        ),
        "SELECT 2;\n",
        "utf8",
      );

      await assert.rejects(
        () => loadMigrations(directory),
        (error: unknown) =>
          error instanceof MigrationError &&
          error.message.includes(
            "Duplicate migration version",
          ),
      );
    } finally {
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);

test(
  "target_months scalar correction migration is forward-only and guarded",
  async () => {
    const migrations =
      await loadMigrations();

    assert.deepEqual(
      migrations.map(
        (migration) =>
          migration.version,
      ),
      [
        "0001",
        "0002",
        "0003",
      ],
    );

    const migration =
      migrations.find(
        (candidate) =>
          candidate.version ===
          "0003",
      );

    assert.ok(migration);

    assert.equal(
      migration.filename,
      "0003_kpi_target_months_scalar.sql",
    );

    assert.match(
      migration.sql,
      /cardinality\s*\(\s*target_months\s*\)\s*>\s*1/,
    );

    assert.match(
      migration.sql,
      /multi-value target_months arrays exist/,
    );

    assert.match(
      migration.sql,
      /DROP CONSTRAINT\s+ck_kpi_definitions_target_months/i,
    );

    assert.match(
      migration.sql,
      /ALTER COLUMN target_months\s+DROP DEFAULT/i,
    );

    assert.match(
      migration.sql,
      /ALTER COLUMN target_months\s+DROP NOT NULL/i,
    );

    assert.match(
      migration.sql,
      /TYPE SMALLINT/i,
    );

    assert.match(
      migration.sql,
      /cardinality\s*\(\s*target_months\s*\)\s*=\s*0[\s\S]*?THEN NULL/i,
    );

    assert.match(
      migration.sql,
      /target_months\s*\[\s*1\s*\]/,
    );

    assert.match(
      migration.sql,
      /target_months IS NULL[\s\S]*?target_months BETWEEN 1 AND 12/i,
    );
  },
);
