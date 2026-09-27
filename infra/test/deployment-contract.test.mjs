// Deployment contract tests for the PA Dashboard deployment foundation.
//
// Uses only the Node.js built-in test runner. The tests inspect the source
// artifacts in this repository (next.config.ts, Containerfiles, Quadlet
// templates, backend/package.json, CI workflow) and execute the Quadlet
// renderer in temporary directories. They never touch the host systemd
// configuration, never call podman, and never start containers.

import {
  readFile,
  readdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";

import {
  tmpdir,
} from "node:os";

import {
  basename,
  dirname,
  join,
  resolve,
} from "node:path";

import {
  promisify,
} from "node:util";

import {
  execFile,
} from "node:child_process";

import {
  fileURLToPath,
} from "node:url";

import {
  test,
} from "node:test";

import assert from "node:assert/strict";

const REPOSITORY_ROOT =
  resolve(
    dirname(
      fileURLToPath(
        import.meta.url,
      ),
    ),
    "../..",
  );

const INFRA_DIRECTORY = join(
  REPOSITORY_ROOT,
  "infra",
);

const QUADLET_DIRECTORY = join(
  INFRA_DIRECTORY,
  "quadlet",
);

const RENDERER_PATH = join(
  INFRA_DIRECTORY,
  "render-quadlets.mjs",
);

const CONTAINER_TEMPLATES = [
  "pa-dashboard-db.container.in",
  "pa-dashboard-migrate.container.in",
  "pa-dashboard-api.container.in",
  "pa-dashboard-web.container.in",
  "pa-dashboard-reference.container.in",
  "pa-dashboard-sync.container.in",
];

const STATIC_QUADLET_FILES = [
  "pa-dashboard-app.network",
  "pa-dashboard-db-data.volume",
];

const VALID_WEB_IMAGE =
  `registry.example/pa-dashboard-web@sha256:${"ab".repeat(32)}`;

const VALID_API_IMAGE =
  `registry.example/pa-dashboard-api@sha256:${"cd".repeat(32)}`;

const VALID_DB_IMAGE =
  `docker.io/library/postgres@sha256:${"ef".repeat(32)}`;

const execFileAsync =
  promisify(
    execFile,
  );

async function readRepositoryFile(
  relativePath,
) {
  return readFile(
    join(
      REPOSITORY_ROOT,
      relativePath,
    ),
    "utf8",
  );
}

async function readQuadletTemplate(
  name,
) {
  return readFile(
    join(
      QUADLET_DIRECTORY,
      name,
    ),
    "utf8",
  );
}

async function listInfraFiles() {
  const entries =
    await readdir(
      INFRA_DIRECTORY,
      {
        withFileTypes: true,
        recursive: true,
      },
    );

  return entries
    .filter(
      (entry) =>
        entry.isFile(),
    )
    .map(
      (entry) =>
        join(
          entry.parentPath,
          entry.name,
        ),
    );
}

function runRenderer(
  arguments_,
) {
  return execFileAsync(
    process.execPath,
    [
      RENDERER_PATH,
      ...arguments_,
    ],
    {
      cwd:
        REPOSITORY_ROOT,
    },
  );
}

async function assertRendererRejects(
  arguments_,
  expectedFragment,
) {
  await assert.rejects(
    runRenderer(
      arguments_,
    ),
    (error) => {
      assert.notEqual(
        error.code,
        0,
        "renderer must exit non-zero",
      );

      assert.match(
        error.stderr,
        expectedFragment,
      );

      return true;
    },
  );
}

async function renderValidBundle(
  outputDirectory,
) {
  const {
    stdout,
  } =
    await runRenderer(
      [
        "--web-image",
        VALID_WEB_IMAGE,
        "--api-image",
        VALID_API_IMAGE,
        "--db-image",
        VALID_DB_IMAGE,
        "--output",
        outputDirectory,
      ],
    );

  return stdout;
}

// ---------------------------------------------------------------- A. next.config.ts

test("next.config.ts uses standalone output", async () => {
  const source =
    await readRepositoryFile(
      "next.config.ts",
    );

  assert.match(
    source,
    /output:\s*['"]standalone['"]/,
  );
});

test("next.config.ts does not use static export", async () => {
  const source =
    await readRepositoryFile(
      "next.config.ts",
    );

  assert.doesNotMatch(
    source,
    /output:\s*['"]export['"]/,
  );

  assert.doesNotMatch(
    source,
    /basePath/,
  );
});

test("next.config.ts rewrites /api/v1 to the internal API service", async () => {
  const source =
    await readRepositoryFile(
      "next.config.ts",
    );

  assert.match(
    source,
    /source:\s*['"]\/api\/v1\/:path\*['"]/,
  );

  assert.match(
    source,
    /destination:\s*['"]http:\/\/pa-dashboard-api:3001\/api\/v1\/:path\*['"]/,
  );

  // No public or environment-specific API hostname may leak into the config.
  assert.doesNotMatch(
    source,
    /NEXT_PUBLIC_[A-Z_]*(API|BACKEND)/,
  );
});

// ---------------------------------------------------------------- B. renderer

test("renderer rejects tag-only web image", async () => {
  await assertRendererRejects(
    [
      "--web-image",
      "registry.example/pa-dashboard-web:latest",
      "--api-image",
      VALID_API_IMAGE,
      "--db-image",
      VALID_DB_IMAGE,
      "--output",
      join(
        tmpdir(),
        "pa-render-rejected",
      ),
    ],
    /--web-image/,
  );
});

test("renderer rejects tag-only API image", async () => {
  await assertRendererRejects(
    [
      "--web-image",
      VALID_WEB_IMAGE,
      "--api-image",
      "registry.example/pa-dashboard-api:1.2.3",
      "--db-image",
      VALID_DB_IMAGE,
      "--output",
      join(
        tmpdir(),
        "pa-render-rejected",
      ),
    ],
    /--api-image/,
  );
});

test("renderer rejects tag-only DB image", async () => {
  await assertRendererRejects(
    [
      "--web-image",
      VALID_WEB_IMAGE,
      "--api-image",
      VALID_API_IMAGE,
      "--db-image",
      "docker.io/library/postgres:18",
      "--output",
      join(
        tmpdir(),
        "pa-render-rejected",
      ),
    ],
    /--db-image/,
  );
});

test("renderer rejects malformed digests", async () => {
  const outputDirectory =
    await mkdtemp(
      join(
        tmpdir(),
        "pa-render-",
      ),
    );

  await assertRendererRejects(
    [
      "--web-image",
      `registry.example/web@sha256:${"ab".repeat(31)}`,
      "--api-image",
      VALID_API_IMAGE,
      "--db-image",
      VALID_DB_IMAGE,
      "--output",
      outputDirectory,
    ],
    /--web-image/,
  );

  await assertRendererRejects(
    [
      "--web-image",
      VALID_WEB_IMAGE,
      "--api-image",
      `registry.example/api@sha256:${"CD".repeat(32)}`,
      "--db-image",
      VALID_DB_IMAGE,
      "--output",
      outputDirectory,
    ],
    /--api-image/,
  );

  await assertRendererRejects(
    [
      "--web-image",
      VALID_WEB_IMAGE,
      "--api-image",
      VALID_API_IMAGE,
      "--db-image",
      "@@PA_DB_IMAGE@@",
      "--output",
      outputDirectory,
    ],
    /--db-image/,
  );

  await rm(
    outputDirectory,
    {
      recursive: true,
      force: true,
    },
  );
});

test("renderer fails closed on a non-empty output directory and writes nothing", async (t) => {
  const outputDirectory =
    await mkdtemp(
      join(
        tmpdir(),
        "pa-render-nonempty-",
      ),
    );

  t.after(
    () =>
      rm(
        outputDirectory,
        {
          recursive: true,
          force: true,
        },
      ),
  );

  // A stale Quadlet-shaped file must trigger rejection and must survive the
  // failed render byte-for-byte, with no generated artifacts beside it.
  const stalePath = join(
    outputDirectory,
    "stale-danger.container",
  );

  const staleContent =
    "# stale unit that must never ride along into an install\n";

  await writeFile(
    stalePath,
    staleContent,
  );

  await assert.rejects(
    runRenderer(
      [
        "--web-image",
        VALID_WEB_IMAGE,
        "--api-image",
        VALID_API_IMAGE,
        "--db-image",
        VALID_DB_IMAGE,
        "--output",
        outputDirectory,
      ],
    ),
    (error) => {
      assert.notEqual(
        error.code,
        0,
        "renderer must exit non-zero",
      );

      assert.match(
        error.stderr,
        /not empty|existing entries|entrie/i,
      );

      return true;
    },
  );

  assert.equal(
    await readFile(
      stalePath,
      "utf8",
    ),
    staleContent,
    "the stale file must remain unchanged",
  );

  const remaining =
    await readdir(
      outputDirectory,
    );

  assert.deepEqual(
    remaining,
    [
      "stale-danger.container",
    ],
    "no generated .container/.network/.volume artifacts may be written",
  );
});

test("renderer accepts an existing empty output directory", async (t) => {
  const outputDirectory =
    await mkdtemp(
      join(
        tmpdir(),
        "pa-render-empty-",
      ),
    );

  t.after(
    () =>
      rm(
        outputDirectory,
        {
          recursive: true,
          force: true,
        },
      ),
  );

  await renderValidBundle(
    outputDirectory,
  );

  const emitted =
    await readdir(
      outputDirectory,
    );

  assert.equal(
    emitted.length,
    8,
    "the full generated bundle must be written into the empty directory",
  );
});

test("renderer accepts valid digest references and emits the full bundle", async () => {
  const outputDirectory =
    await mkdtemp(
      join(
        tmpdir(),
        "pa-render-",
      ),
    );

  try {
    await renderValidBundle(
      outputDirectory,
    );

    const emitted =
      await readdir(
        outputDirectory,
      );

    assert.deepEqual(
      emitted.sort(),
      [
        ...CONTAINER_TEMPLATES.map(
          (name) =>
            name.replace(
              /\.in$/,
              "",
            ),
        ),
        ...STATIC_QUADLET_FILES,
      ].sort(),
    );
  } finally {
    await rm(
      outputDirectory,
      {
        recursive: true,
        force: true,
      },
    );
  }
});

test("emitted containers contain the exact digest references and no placeholders", async () => {
  const outputDirectory =
    await mkdtemp(
      join(
        tmpdir(),
        "pa-render-",
      ),
    );

  try {
    await renderValidBundle(
      outputDirectory,
    );

    const emitted =
      await readdir(
        outputDirectory,
      );

    const emittedContent =
      await Promise.all(
        emitted.map(
          async (name) => ({
            name,

            content:
              await readFile(
                join(
                  outputDirectory,
                  name,
                ),
                "utf8",
              ),
          }),
        ),
      );

    for (const file of emittedContent) {
      assert.doesNotMatch(
        file.content,
        /@@PA_[A-Z_]+@@/,
        `${file.name} still contains a placeholder`,
      );
    }

    const web =
      emittedContent.find(
        (file) =>
          file.name ===
          "pa-dashboard-web.container",
      ).content;

    const api =
      emittedContent.find(
        (file) =>
          file.name ===
          "pa-dashboard-api.container",
      ).content;

    const db =
      emittedContent.find(
        (file) =>
          file.name ===
          "pa-dashboard-db.container",
      ).content;

    assert.match(
      web,
      new RegExp(
        `Image=${escapeRegExp(
          VALID_WEB_IMAGE,
        )}`,
      ),
    );

    assert.match(
      api,
      new RegExp(
        `Image=${escapeRegExp(
          VALID_API_IMAGE,
        )}`,
      ),
    );

    assert.match(
      db,
      new RegExp(
        `Image=${escapeRegExp(
          VALID_DB_IMAGE,
        )}`,
      ),
    );
  } finally {
    await rm(
      outputDirectory,
      {
        recursive: true,
        force: true,
      },
    );
  }
});

function escapeRegExp(
  value,
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

// ---------------------------------------------------------------- C. network boundary

test("application network exists and is not internal", async () => {
  const network =
    await readFile(
      join(
        QUADLET_DIRECTORY,
        "pa-dashboard-app.network",
      ),
      "utf8",
    );

  assert.match(
    network,
    /\[Network\]/,
  );

  assert.doesNotMatch(
    network,
    /Internal\s*=\s*true/i,
  );
});

test("every application Quadlet joins only the private application network", async () => {
  for (const name of CONTAINER_TEMPLATES) {
    const template =
      await readQuadletTemplate(
        name,
      );

    const networkLines =
      template
        .split("\n")
        .filter(
          (line) =>
            /^\s*Network\s*=/.test(
              line,
            ),
        );

    assert.ok(
      networkLines.length > 0,
      `${name} must join a network`,
    );

    for (const line of networkLines) {
      assert.equal(
        line.trim(),
        "Network=pa-dashboard-app.network",
        `${name} must only join pa-dashboard-app.network`,
      );
    }
  }
});

test("no application Quadlet attaches to the platform edge network", async () => {
  for (const name of CONTAINER_TEMPLATES) {
    const template =
      await readQuadletTemplate(
        name,
      );

    assert.doesNotMatch(
      template,
      /^\s*Network=.*edge/m,
      `${name} must not attach to edge`,
    );

    assert.doesNotMatch(
      template,
      /edge\.network/,
      `${name} must not reference edge.network`,
    );
  }
});

test("no application Quadlet publishes host ports", async () => {
  for (const name of CONTAINER_TEMPLATES) {
    const template =
      await readQuadletTemplate(
        name,
      );

    assert.doesNotMatch(
      template,
      /^\s*PublishPort\s*=/m,
      `${name} must not publish host ports`,
    );
  }
});

// ---------------------------------------------------------------- D. PostgreSQL 18

test("database volume is mounted at /var/lib/postgresql exactly", async () => {
  const template =
    await readQuadletTemplate(
      "pa-dashboard-db.container.in",
    );

  const volumeLines =
    template
      .split("\n")
      .filter(
        (line) =>
          /^\s*Volume\s*=/.test(
            line,
          ),
      );

  assert.ok(
    volumeLines.length === 1,
    "database template must declare exactly one volume",
  );

  for (const line of volumeLines) {
    assert.equal(
      line.trim(),
      "Volume=pa-dashboard-db-data.volume:/var/lib/postgresql",
    );

    assert.doesNotMatch(
      line,
      /\/var\/lib\/postgresql\/data/,
    );
  }

  assert.doesNotMatch(
    template,
    /^\s*Environment=.*PGDATA/m,
  );
});

// ---------------------------------------------------------------- E. dependency/startup

test("database has a healthcheck and healthy startup notification", async () => {
  const template =
    await readQuadletTemplate(
      "pa-dashboard-db.container.in",
    );

  assert.match(
    template,
    /^HealthCmd=pg_isready/m,
  );

  assert.match(
    template,
    /^Notify=healthy$/m,
  );
});

test("migration depends on the database service", async () => {
  const template =
    await readQuadletTemplate(
      "pa-dashboard-migrate.container.in",
    );

  assert.match(
    template,
    /^Requires=pa-dashboard-db\.service$/m,
  );

  assert.match(
    template,
    /^After=pa-dashboard-db\.service$/m,
  );
});

test("API depends on the migration one-shot", async () => {
  const template =
    await readQuadletTemplate(
      "pa-dashboard-api.container.in",
    );

  assert.match(
    template,
    /^Requires=pa-dashboard-migrate\.service$/m,
  );

  assert.match(
    template,
    /^After=pa-dashboard-migrate\.service$/m,
  );
});

test("API exposes a readiness healthcheck endpoint", async () => {
  const template =
    await readQuadletTemplate(
      "pa-dashboard-api.container.in",
    );

  assert.match(
    template,
    /\/api\/v1\/health\/ready/,
  );

  assert.match(
    template,
    /^Notify=healthy$/m,
  );
});

test("web depends on the API service", async () => {
  const template =
    await readQuadletTemplate(
      "pa-dashboard-web.container.in",
    );

  assert.match(
    template,
    /^Requires=pa-dashboard-api\.service$/m,
  );

  assert.match(
    template,
    /^After=pa-dashboard-api\.service$/m,
  );
});

// ---------------------------------------------------------------- F. one-shot semantics

test("migration is a oneshot that remains active after success", async () => {
  const template =
    await readQuadletTemplate(
      "pa-dashboard-migrate.container.in",
    );

  assert.match(
    template,
    /^Type=oneshot$/m,
  );

  assert.match(
    template,
    /^RemainAfterExit=yes$/m,
  );
});

test("reference population is a re-runnable oneshot", async () => {
  const template =
    await readQuadletTemplate(
      "pa-dashboard-reference.container.in",
    );

  assert.match(
    template,
    /^Type=oneshot$/m,
  );

  assert.doesNotMatch(
    template,
    /^\s*RemainAfterExit/m,
  );

  assert.doesNotMatch(
    template,
    /^\[Install\]/m,
  );
});

test("synchronization is a re-runnable oneshot", async () => {
  const template =
    await readQuadletTemplate(
      "pa-dashboard-sync.container.in",
    );

  assert.match(
    template,
    /^Type=oneshot$/m,
  );

  assert.doesNotMatch(
    template,
    /^\s*RemainAfterExit/m,
  );

  assert.doesNotMatch(
    template,
    /^\[Install\]/m,
  );
});

test("no synchronization timer exists", async () => {
  const infraFiles =
    await listInfraFiles();

  const timerFiles =
    infraFiles.filter(
      (path) =>
        basename(
          path,
        ).endsWith(
          ".timer",
        ) ||
        basename(
          path,
        ).endsWith(
          ".timer.in",
        ),
    );

  assert.deepEqual(
    timerFiles,
    [],
  );
});

// ---------------------------------------------------------------- G. security/config

test("Quadlet templates only read the expected host env file paths", async () => {
  const expectedPattern =
    /^EnvironmentFile=%h\/\.config\/pa-dashboard\/(postgres|database|reference)\.env$/;

  for (const name of CONTAINER_TEMPLATES) {
    const template =
      await readQuadletTemplate(
        name,
      );

    const environmentFileLines =
      template
        .split("\n")
        .filter(
          (line) =>
            /^\s*EnvironmentFile\s*=/.test(
              line,
            ),
        );

    for (const line of environmentFileLines) {
      assert.match(
        line,
        expectedPattern,
        `${name} declares an unexpected env file: ${line}`,
      );
    }
  }
});

test("no credential values are committed under infra/", async () => {
  const infraFiles =
    await listInfraFiles();

  const contents =
    await Promise.all(
      infraFiles.map(
        async (path) => ({
          path,

          content:
            await readFile(
              path,
              "utf8",
            ),
        }),
      ),
    );

  for (const file of contents) {
    const lines =
      file.content.split(
        "\n",
      );

    for (const line of lines) {
      assert.doesNotMatch(
        line,
        /^\s*(?![<`*|#]).*(PASSWORD|SECRET|TOKEN|API_KEY|PASSWD)[A-Z_]*\s*=\s*\S+/i,
        `${file.path} may contain a credential value: ${line.trim()}`,
      );
    }
  }
});

test("no Podman socket access, privileged mode, or host networking", async () => {
  const infraFiles =
    await listInfraFiles();

  const contents =
    await Promise.all(
      infraFiles.map(
        async (path) => ({
          path,

          content:
            await readFile(
              path,
              "utf8",
            ),
        }),
      ),
    );

  for (const file of contents) {
    assert.doesNotMatch(
      file.content,
      /(docker|podman)\.sock/,
      `${file.path} must not mount or reference the Podman socket`,
    );

    assert.doesNotMatch(
      file.content,
      /^\s*Privileged\s*=\s*true/mi,
      `${file.path} must not run privileged`,
    );

    assert.doesNotMatch(
      file.content,
      /(NetworkMode\s*=\s*host|--network\s*=\s*host|network_mode:\s*host)/i,
      `${file.path} must not use host networking`,
    );
  }
});

test("API and database expose no public ports", async () => {
  for (const name of [
    "pa-dashboard-api.container.in",
    "pa-dashboard-db.container.in",
    "pa-dashboard-web.container.in",
  ]) {
    const template =
      await readQuadletTemplate(
        name,
      );

    assert.doesNotMatch(
      template,
      /PublishPort/,
    );
  }
});

// ---------------------------------------------------------------- H. Containerfiles

test("web Containerfile is a multi-stage Node 24 build with a non-root standalone runtime", async () => {
  const source =
    await readRepositoryFile(
      "infra/containers/web.Containerfile",
    );

  const fromLines =
    source
      .split("\n")
      .filter(
        (line) =>
          /^FROM\s/i.test(
            line,
          ),
      );

  assert.ok(
    fromLines.length >= 2,
    "web Containerfile must be multi-stage",
  );

  for (const line of fromLines) {
    assert.match(
      line,
      /node:24/,
      "every stage must use Node 24",
    );
  }

  assert.match(
    source,
    /^USER node$/m,
  );

  assert.match(
    source,
    /\.next\/standalone/,
  );

  assert.match(
    source,
    /\.next\/static/,
  );

  assert.match(
    source,
    /COPY.*public/,
  );

  assert.match(
    source,
    /^ENV NODE_ENV=production/m,
  );

  assert.match(
    source,
    /HOSTNAME=0\.0\.0\.0/,
  );

  assert.match(
    source,
    /server\.js/,
  );
});

test("API Containerfile is a multi-stage Node 24 build whose non-root runtime carries dist and migrations", async () => {
  const source =
    await readRepositoryFile(
      "infra/containers/api.Containerfile",
    );

  const fromLines =
    source
      .split("\n")
      .filter(
        (line) =>
          /^FROM\s/i.test(
            line,
          ),
      );

  assert.ok(
    fromLines.length >= 2,
    "API Containerfile must be multi-stage",
  );

  for (const line of fromLines) {
    assert.match(
      line,
      /node:24/,
      "every stage must use Node 24",
    );
  }

  assert.match(
    source,
    /^USER node$/m,
  );

  assert.match(
    source,
    /\/app\/dist/,
  );

  assert.match(
    source,
    /backend\/migrations/,
  );

  assert.match(
    source,
    /--omit=dev/,
  );

  assert.match(
    source,
    /^CMD \["node", "dist\/src\/server\.js"\]$/m,
  );
});

test("Containerfiles bake no secret ARG or ENV values", async () => {
  for (const name of [
    "infra/containers/web.Containerfile",
    "infra/containers/api.Containerfile",
  ]) {
    const source =
      await readRepositoryFile(
        name,
      );

    assert.doesNotMatch(
      source,
      /^(ARG|ENV)\b.*(PASSWORD|SECRET|TOKEN|API_KEY|PASSWD)/im,
      `${name} must not declare secret build arguments or environment values`,
    );
  }
});

// ---------------------------------------------------------------- I. backend scripts

test("backend package.json exposes compiled dist entry points without dependency changes", async () => {
  const raw =
    await readRepositoryFile(
      "backend/package.json",
    );

  const parsed =
    JSON.parse(
      raw,
    );

  const scripts =
    parsed.scripts ?? {};

  const expectedScripts = {
    start:
      "node dist/src/server.js",
    migrate:
      "node dist/src/db/migrate.js",
    "reference:populate":
      "node dist/src/reference/populate.js",
    sync:
      "node dist/src/sync/run.js",
  };

  for (const [
    name,
    command,
  ] of Object.entries(
    expectedScripts,
  )) {
    assert.equal(
      scripts[name],
      command,
      `backend script ${name} must run compiled JavaScript under dist`,
    );
  }

  // All entry points are plain node invocations of compiled output, so no
  // new npm packages are required to run them.
  for (const command of Object.values(
    expectedScripts,
  )) {
    assert.match(
      command,
      /^node dist\//,
    );
  }
});

// ---------------------------------------------------------------- J. CI

test("CI runs the deployment contract test", async () => {
  const workflow =
    await readRepositoryFile(
      ".github/workflows/ci.yml",
    );

  assert.match(
    workflow,
    /node --test infra\/test\/deployment-contract\.test\.mjs/,
  );
});

test("CI builds both OCI images", async () => {
  const workflow =
    await readRepositoryFile(
      ".github/workflows/ci.yml",
    );

  assert.match(
    workflow,
    /build .*infra\/containers\/web\.Containerfile|-f infra\/containers\/web\.Containerfile/,
  );

  assert.match(
    workflow,
    /build .*infra\/containers\/api\.Containerfile|-f infra\/containers\/api\.Containerfile/,
  );
});

test("CI never pushes images or mutates a host", async () => {
  const workflow =
    await readRepositoryFile(
      ".github/workflows/ci.yml",
    );

  const forbiddenPatterns = [
    /\bdocker push\b/,
    /\bpodman push\b/,
    /--push\b/,
    /\blogin\b/i,
    /systemctl/,
    /\bssh\b/i,
    /appleboy/,
    /deploy-key/,
    /ghcr\.io\/.*:.*push/i,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(
      workflow,
      pattern,
    );
  }
});
