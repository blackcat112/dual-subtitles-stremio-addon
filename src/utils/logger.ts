// Simple logger utility for the addon

class Logger {
  private prefix = '[Dual Subtitles]';

  info(message: string, ...args: unknown[]): void {
    console.log(`${this.prefix} ℹ️  ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`${this.prefix} ⚠️  ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`${this.prefix} ❌ ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env.DEBUG) {
      console.debug(`${this.prefix} 🐛 ${message}`, ...args);
    }
  }

  success(message: string, ...args: unknown[]): void {
    console.log(`${this.prefix} ✅ ${message}`, ...args);
  }
}

export const logger = new Logger();
