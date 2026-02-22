import { env } from "./env";

export const envLogger = {
  development: {
    level: env.LOG_LEVEL,
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    },
  },
  test: {
    level: env.LOG_LEVEL,
  },
  production: {
    level: env.LOG_LEVEL,
  },
};
