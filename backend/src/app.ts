import Fastify from "fastify";

import type {
  FastifyInstance,
} from "fastify";

import {
  registerHealthRoutes,
  type HealthDatabase,
} from "./observability/health.js";

export interface AppDependencies {
  readonly db: HealthDatabase;
}

export function buildApp(
  dependencies: AppDependencies,
): FastifyInstance {
  const app = Fastify();

  registerHealthRoutes(
    app,
    dependencies.db,
  );

  return app;
}
