// Deployment contract tests for the PA Dashboard deployment foundation.
//
// Uses only the Node.js built-in test runner. The tests inspect the source
// artifacts in this repository (next.config.ts, Containerfiles, Quadlet
// templates, backend/package.json, CI workflow, OCI release workflow,
// infra/README.md) and execute the Quadlet renderer in temporary directories.
// They never touch the host systemd configuration, never call podman, and
// never start containers.

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

// ---------------------------------------------------------------- K. OCI release workflow

const OCI_RELEASE_WORKFLOW_PATH =
  ".github/workflows/oci-release.yml";

const OCI_SOURCE_URL =
  "https://github.com/9GotStory/pa-dashboard";

const OCI_WEB_IMAGE_NAMESPACE =
  "ghcr.io/9gotstory/pa-dashboard-web";

const OCI_API_IMAGE_NAMESPACE =
  "ghcr.io/9gotstory/pa-dashboard-api";

// Contract assertions run against comment-stripped text so a contract that
// only exists in a YAML comment cannot satisfy (or trip) them.
function stripCommentLines(
  source,
) {
  return source
    .split("\n")
    .filter(
      (line) =>
        !/^\s*#/.test(
          line,
        ),
    )
    .join("\n");
}

function nonEmptyLines(
  source,
) {
  return source
    .split("\n")
    .filter(
      (line) =>
        line.trim() !== "",
    );
}

// Returns the indented lines directly under a top-level `key:` before the
// next top-level key, so trigger/permission blocks can be asserted as a
// whole instead of via loose greps.
function extractTopLevelBlock(
  source,
  key,
) {
  const lines =
    source.split(
      "\n",
    );

  const startIndex =
    lines.findIndex(
      (line) =>
        line === `${key}:`,
    );

  assert.ok(
    startIndex >= 0,
    `workflow must declare a top-level ${key}: key`,
  );

  const blockLines = [];

  for (
    let index = startIndex + 1;
    index < lines.length;
    index += 1
  ) {
    const line =
      lines[index];

    if (
      /^\S/.test(
        line,
      )
    ) {
      break;
    }

    if (
      line.trim() !== ""
    ) {
      blockLines.push(
        line,
      );
    }
  }

  return blockLines;
}

async function readOciReleaseWorkflow() {
  return stripCommentLines(
    await readRepositoryFile(
      OCI_RELEASE_WORKFLOW_PATH,
    ),
  );
}

test("OCI release workflow exists and pins its actions to verified commits", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  assert.match(
    workflow,
    /^name: OCI Release$/m,
  );

  for (const action of [
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
    "docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e",
    "docker/login-action@dbcb813823bdd20940b903addbd779551569679f",
    "docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc",
  ]) {
    assert.ok(
      workflow.includes(
        `uses: ${action}`,
      ),
      `workflow must use ${action}`,
    );
  }

  assert.equal(
    workflow.split(
      "docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc",
    ).length - 1,
    2,
    "both build/push steps must use the same verified build-push-action SHA",
  );
});

test("every effective action reference is an immutable commit SHA", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  const usesLines =
    nonEmptyLines(
      workflow,
    ).filter(
      (line) =>
        /^\s*uses:\s*\S/.test(
          line,
        ),
    );

  assert.equal(
    usesLines.length,
    5,
    "workflow must reference exactly five actions",
  );

  for (const line of usesLines) {
    assert.match(
      line,
      /^\s*uses:\s*\S+@[0-9a-f]{40}\s*$/,
      `action reference must end in a 40 lowercase hex commit SHA: ${line.trim()}`,
    );

    assert.doesNotMatch(
      line,
      /@(v[\w.-]+|main|master)\s*$/i,
      `action reference must not be a mutable tag or branch: ${line.trim()}`,
    );
  }
});

test("OCI release workflow triggers only on explicit oci-* tag push", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  const triggerLines =
    extractTopLevelBlock(
      workflow,
      "on",
    );

  const eventLines =
    triggerLines.filter(
      (line) =>
        /^ {2}\S.*:$/.test(
          line,
        ),
    );

  assert.deepEqual(
    eventLines,
    ["  push:"],
    "push must be the only trigger event",
  );

  const pushFilterLines =
    triggerLines.filter(
      (line) =>
        /^ {4}\S/.test(
          line,
        ),
    );

  assert.deepEqual(
    pushFilterLines,
    ["    tags:"],
    "the push trigger must filter on tags only",
  );

  const tagPatterns =
    triggerLines
      .filter(
        (line) =>
          /^ {6}-\s/.test(
            line,
          ),
      )
      .map(
        (line) =>
          line.trim(),
      );

  assert.deepEqual(
    tagPatterns,
    ['- "oci-*"'],
    "the only accepted tag pattern must be oci-*",
  );

  for (const forbidden of [
    /^ *(branches|branches-ignore):/m,
    /^ *(pull_request|pull_request_target):/m,
    /^ *workflow_dispatch:/m,
    /^ *(schedule|workflow_call|workflow_run):/m,
  ]) {
    assert.doesNotMatch(
      workflow,
      forbidden,
    );
  }
});

test("OCI release permissions are exactly contents read and packages write", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  const permissionLines =
    extractTopLevelBlock(
      workflow,
      "permissions",
    ).map(
      (line) =>
        line.trim(),
    );

  assert.deepEqual(
    [...new Set(
      permissionLines,
    )].sort(),
    ["contents: read", "packages: write"],
  );

  assert.doesNotMatch(
    workflow,
    /^ +permissions:/m,
    "no job-level permissions block may widen or duplicate the top-level grant",
  );

  const writeRequests =
    nonEmptyLines(
      workflow,
    ).filter(
      (line) =>
        /^ *\S.*:\s*write$/.test(
          line,
        ),
    );

  assert.deepEqual(
    writeRequests,
    ["  packages: write"],
    "packages: write must be the only write permission requested anywhere",
  );
});

test("OCI release workflow targets exactly the two frozen GHCR namespaces", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  const namespaces = [
    OCI_WEB_IMAGE_NAMESPACE,
    OCI_API_IMAGE_NAMESPACE,
  ];

  const references =
    workflow.match(
      /ghcr\.io\/[^\s'"@:]+/g,
    ) ?? [];

  assert.ok(
    references.length >= 2,
    "workflow must reference both image namespaces",
  );

  for (const reference of references) {
    assert.ok(
      namespaces.includes(
        reference,
      ),
      `unexpected GHCR image reference: ${reference}`,
    );
  }

  for (const namespace of namespaces) {
    assert.ok(
      references.includes(
        namespace,
      ),
      `workflow must reference ${namespace}`,
    );
  }
});

test("both builds target linux/amd64 with exactly sha-<full SHA> image tags", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  assert.equal(
    workflow.split(
      "docker/build-push-action@",
    ).length - 1,
    2,
    "workflow must contain exactly two build/push steps",
  );

  const platformLines =
    nonEmptyLines(
      workflow,
    )
      .filter(
        (line) =>
          /^\s+platforms:/.test(
            line,
          ),
      )
      .map(
        (line) =>
          line.trim(),
      );

  assert.deepEqual(
    platformLines,
    ["platforms: linux/amd64", "platforms: linux/amd64"],
  );

  const tagLines =
    nonEmptyLines(
      workflow,
    )
      .filter(
        (line) =>
          /^\s+tags:\s*\S/.test(
            line,
          ),
      )
      .map(
        (line) =>
          line.trim(),
      );

  assert.deepEqual(
    tagLines,
    [
      `tags: ${OCI_WEB_IMAGE_NAMESPACE}:sha-\${{ github.sha }}`,
      `tags: ${OCI_API_IMAGE_NAMESPACE}:sha-\${{ github.sha }}`,
    ],
    "the only published tags must be sha-<full commit SHA> for each image",
  );

  assert.doesNotMatch(
    workflow,
    /:latest\b/,
    "no image may be published under a latest tag",
  );

  assert.doesNotMatch(
    workflow,
    /^\s+-\s+latest\s*$/m,
  );
});

test("both builds stamp identical OCI traceability labels", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  const expectedLabels = [
    `org.opencontainers.image.source=${OCI_SOURCE_URL}`,
    "org.opencontainers.image.revision=${{ github.sha }}",
    "org.opencontainers.image.version=sha-${{ github.sha }}",
  ];

  for (const label of expectedLabels) {
    assert.equal(
      workflow.split(
        label,
      ).length - 1,
      2,
      `label must be applied by both builds: ${label}`,
    );
  }
});

test("authority step proves the release tag is oci-<first 12 chars of GITHUB_SHA>", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  assert.ok(
    workflow.includes(
      '[[ ! "${GITHUB_SHA}" =~ ^[0-9a-f]{40}$ ]]',
    ),
    "GITHUB_SHA must be validated as exactly 40 lowercase hex characters",
  );

  assert.ok(
    workflow.includes(
      '[[ "${GITHUB_REF_TYPE}" != "tag" ]]',
    ),
    "the workflow must fail closed unless the event is a tag",
  );

  assert.ok(
    workflow.includes(
      'expected_ref_name="oci-${GITHUB_SHA:0:12}"',
    ),
    "the expected tag must be derived from the first 12 chars of GITHUB_SHA",
  );

  assert.ok(
    workflow.includes(
      '[[ "${GITHUB_REF_NAME}" != "${expected_ref_name}" ]]',
    ),
    "GITHUB_REF_NAME must be compared against the derived oci- tag",
  );
});

test("authority step proves fetched origin/develop equals GITHUB_SHA", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  assert.match(
    workflow,
    /git fetch[^\n]* origin develop/,
    "origin/develop must be fetched explicitly",
  );

  assert.ok(
    workflow.includes(
      "git rev-parse refs/remotes/origin/develop",
    ),
  );

  assert.ok(
    workflow.includes(
      '[[ "${develop_sha}" != "${GITHUB_SHA}" ]]',
    ),
    "the fetched develop tip must be compared against GITHUB_SHA",
  );
});

test("authority validation and contract tests run before registry login and publication", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  const anchors = {
    authority:
      workflow.indexOf(
        "refs/remotes/origin/develop",
      ),
    contractTests:
      workflow.indexOf(
        "node --test infra/test/deployment-contract.test.mjs",
      ),
    buildx:
      workflow.indexOf(
        "docker/setup-buildx-action@",
      ),
    login:
      workflow.indexOf(
        "docker/login-action@",
      ),
    firstPush:
      workflow.indexOf(
        "docker/build-push-action@",
      ),
    digestValidation:
      workflow.indexOf(
        "^sha256:[0-9a-f]{64}$",
      ),
  };

  for (const [
    name,
    offset,
  ] of Object.entries(
    anchors,
  )) {
    assert.ok(
      offset >= 0,
      `workflow must contain the ${name} contract element`,
    );
  }

  assert.ok(
    anchors.authority < anchors.contractTests,
  );

  assert.ok(
    anchors.contractTests < anchors.buildx,
  );

  assert.ok(
    anchors.buildx < anchors.login,
  );

  assert.ok(
    anchors.login < anchors.firstPush,
  );

  assert.ok(
    anchors.firstPush < anchors.digestValidation,
    "digest validation must run after both pushes",
  );
});

test("GHCR login uses only the workflow GITHUB_TOKEN", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  assert.ok(
    workflow.includes(
      "username: ${{ github.actor }}",
    ),
  );

  assert.ok(
    workflow.includes(
      "password: ${{ secrets.GITHUB_TOKEN }}",
    ),
  );

  const secretReferences =
    workflow.match(
      /secrets\.[A-Za-z_][A-Za-z0-9_]*/g,
    ) ?? [];

  assert.ok(
    secretReferences.length > 0,
  );

  assert.deepEqual(
    [...new Set(
      secretReferences,
    )],
    ["secrets.GITHUB_TOKEN"],
    "no custom PAT or any other secret may be referenced",
  );
});

test("both build digests are validated as sha256:<64 lowercase hex>", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  assert.ok(
    workflow.includes(
      "id: build-web",
    ),
    "the web build/push step needs a stable id for its digest output",
  );

  assert.ok(
    workflow.includes(
      "id: build-api",
    ),
    "the API build/push step needs a stable id for its digest output",
  );

  assert.ok(
    workflow.includes(
      "${{ steps.build-web.outputs.digest }}",
    ),
  );

  assert.ok(
    workflow.includes(
      "${{ steps.build-api.outputs.digest }}",
    ),
  );

  assert.ok(
    workflow.includes(
      "digest_pattern='^sha256:[0-9a-f]{64}$'",
    ),
  );

  for (const digestVariable of [
    "WEB_DIGEST",
    "API_DIGEST",
  ]) {
    assert.match(
      workflow,
      new RegExp(
        `!.*\\$\\{${digestVariable}\\}.*digest_pattern`,
      ),
      `${digestVariable} must be validated against the digest pattern`,
    );
  }
});

test("release summary emits immutable name@sha256 digest references", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  assert.ok(
    workflow.includes(
      '>> "${GITHUB_STEP_SUMMARY}"',
    ),
  );

  assert.ok(
    workflow.includes(
      "source_sha=${GITHUB_SHA}",
    ),
  );

  assert.ok(
    workflow.includes(
      "release_tag=${GITHUB_REF_NAME}",
    ),
  );

  assert.ok(
    workflow.includes(
      `web_image=${OCI_WEB_IMAGE_NAMESPACE}@`,
    ),
  );

  assert.ok(
    workflow.includes(
      `api_image=${OCI_API_IMAGE_NAMESPACE}@`,
    ),
  );
});

test("workflow mutates no packages and reaches no deployment surface", async () => {
  const workflow =
    await readOciReleaseWorkflow();

  const forbiddenPatterns = [
    /\bgh\s+api\b/,
    /api\.github\.com/,
    /graphql/i,
    /visibility/i,
    /systemctl/,
    /\bssh\b/i,
    /\bscp\b/i,
    /\bpodman\b/i,
    /appleboy/i,
    /traefik/i,
    /cloudflar/i,
    /quadlet/i,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(
      workflow,
      pattern,
    );
  }

  // "deploy" may appear only as the required contract-test invocation; any
  // deployment step, action or command would surface as another line here.
  const deployLines =
    nonEmptyLines(
      workflow,
    ).filter(
      (line) =>
        /\bdeploy/i.test(
          line,
        ),
    );

  assert.deepEqual(
    deployLines,
    [
      "      - name: Run deployment contract tests",
      "        run: node --test infra/test/deployment-contract.test.mjs",
    ],
    "the only deploy references allowed are the contract test step",
  );
});

// ---------------------------------------------------------------- L. OCI source labels

async function readFinalBuildStageLines(
  relativePath,
) {
  const source =
    await readRepositoryFile(
      relativePath,
    );

  const lines =
    source.split(
      "\n",
    );

  let lastFromIndex = -1;

  lines.forEach(
    (line, index) => {
      if (
        /^FROM\s/i.test(
          line,
        )
      ) {
        lastFromIndex =
          index;
      }
    },
  );

  assert.ok(
    lastFromIndex >= 0,
    `${relativePath} must declare a build stage`,
  );

  return lines.slice(
    lastFromIndex,
  );
}

test("web Containerfile final runtime stage declares the OCI source label", async () => {
  const finalStageLines =
    await readFinalBuildStageLines(
      "infra/containers/web.Containerfile",
    );

  assert.ok(
    finalStageLines.includes(
      `LABEL org.opencontainers.image.source="${OCI_SOURCE_URL}"`,
    ),
    "the exact OCI source label must be present in the final runtime stage",
  );
});

test("API Containerfile final runtime stage declares the OCI source label", async () => {
  const finalStageLines =
    await readFinalBuildStageLines(
      "infra/containers/api.Containerfile",
    );

  assert.ok(
    finalStageLines.includes(
      `LABEL org.opencontainers.image.source="${OCI_SOURCE_URL}"`,
    ),
    "the exact OCI source label must be present in the final runtime stage",
  );
});

// ---------------------------------------------------------------- M. OCI release documentation

test("README documents the OCI release contract", async () => {
  const readme =
    await readRepositoryFile(
      "infra/README.md",
    );

  assert.match(
    readme,
    /^## OCI release$/m,
  );

  for (const namespace of [
    OCI_WEB_IMAGE_NAMESPACE,
    OCI_API_IMAGE_NAMESPACE,
  ]) {
    assert.ok(
      readme.includes(
        namespace,
      ),
    );
  }

  assert.match(
    readme,
    /linux\/amd64/,
  );

  assert.match(
    readme,
    /oci-<first 12 chars/,
  );

  assert.match(
    readme,
    /sha-<full 40-char commit SHA>/,
  );

  assert.match(
    readme,
    /origin\/develop/,
  );

  assert.match(
    readme,
    /never\s+tags/,
  );

  assert.match(
    readme,
    /no\s+`latest`\s+tag/,
  );

  assert.match(
    readme,
    /contents: read/,
  );

  assert.match(
    readme,
    /packages: write/,
  );

  assert.ok(
    readme.includes(
      "GITHUB_TOKEN",
    ),
  );

  assert.match(
    readme,
    /no personal\s+access\s+token/i,
  );
});

test("README documents the release/deployment boundary and post-publish visibility verification", async () => {
  const readme =
    await readRepositoryFile(
      "infra/README.md",
    );

  assert.match(
    readme,
    /not atomic/,
  );

  assert.match(
    readme,
    /same\s+source\s+SHA/,
  );

  assert.match(
    readme,
    /both[^.]*digests/s,
  );

  assert.match(
    readme,
    /visibility/i,
  );

  assert.match(
    readme,
    /after the first\s+publication/,
  );

  assert.match(
    readme,
    /websvc/,
  );

  assert.match(
    readme,
    /separate gate/,
  );

  assert.match(
    readme,
    /do not silently add/,
  );
});
