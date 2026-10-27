export interface Config {
  /** Folder for the Baileys session files. */
  authDir: string;
  logLevel: string;
  /** Show message text in the logs. Messages contain customer personal data. */
  logMessageText: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    authDir: env.AUTH_DIR || './auth_info',
    logLevel: env.LOG_LEVEL || 'info',
    logMessageText: env.LOG_MESSAGE_TEXT === 'true',
  };
}
