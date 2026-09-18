export class ServerConfigError extends Error {
  override readonly name = "ServerConfigError";
}

const DEFAULT_HOST = "127.0.0.1";

const DEFAULT_PORT = 3001;

const PORT_PATTERN = /^[0-9]+$/;

export interface ServerConfig {
  readonly host: string;

  readonly port: number;
}

function parseHost(
  raw: string | undefined,
): string {
  if (raw === undefined) {
    return DEFAULT_HOST;
  }

  const host = raw.trim();

  if (!host) {
    throw new ServerConfigError(
      "PA_API_HOST must not be blank",
    );
  }

  return host;
}

function parsePort(
  raw: string | undefined,
): number {
  if (raw === undefined) {
    return DEFAULT_PORT;
  }

  const port = raw.trim();

  if (!port) {
    throw new ServerConfigError(
      "PA_API_PORT must not be blank",
    );
  }

  if (!PORT_PATTERN.test(port)) {
    throw new ServerConfigError(
      "PA_API_PORT must contain decimal digits only",
    );
  }

  const value =
    Number.parseInt(port, 10);

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 65535
  ) {
    throw new ServerConfigError(
      "PA_API_PORT must be between 1 and 65535",
    );
  }

  return value;
}

export function loadServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  return Object.freeze({
    host: parseHost(env.PA_API_HOST),

    port: parsePort(env.PA_API_PORT),
  });
}
