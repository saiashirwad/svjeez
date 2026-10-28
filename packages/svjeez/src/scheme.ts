import { execFileSync } from "node:child_process";
import type { ColorScheme } from "./frames";

const read = (command: string, args: readonly string[]): string =>
  execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 2000,
  });

/** This machine's light or dark appearance: macOS, Windows, or GNOME. Light when there is none to read, as in CI. */
export const systemColorScheme = (): ColorScheme => {
  try {
    switch (process.platform) {
      case "darwin":
        return read("defaults", ["read", "-g", "AppleInterfaceStyle"]).trim() === "Dark"
          ? "dark"
          : "light";
      case "win32":
        return /AppsUseLightTheme\s+REG_DWORD\s+0x0\b/.test(
          read("reg", [
            "query",
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
            "/v",
            "AppsUseLightTheme",
          ]),
        )
          ? "dark"
          : "light";
      default:
        return read("gsettings", ["get", "org.gnome.desktop.interface", "color-scheme"]).includes(
          "dark",
        )
          ? "dark"
          : "light";
    }
  } catch {
    return "light";
  }
};
