export class CookieJar {
  private cookies = new Map<string, string>();

  applySetCookie(headers: string[] | undefined): void {
    if (!headers) {
      return;
    }
    for (const header of headers) {
      const pair = header.split(";", 1)[0];
      const eq = pair.indexOf("=");
      if (eq === -1) {
        continue;
      }
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (name) {
        this.cookies.set(name, value);
      }
    }
  }

  getCookieHeader(): string | undefined {
    if (this.cookies.size === 0) {
      return undefined;
    }
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}
