/**
 * Server-start fixes.
 *
 * This machine's network black-holes IPv6 to some hosts (Decart's API
 * included). Node's happy-eyeballs (autoSelectFamily) then surfaces
 * ETIMEDOUT even though the IPv4 path works fine. Disabling it lets plain
 * DNS order (IPv4 first here) win, so server-side Decart calls connect.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const net = await import("node:net");
    net.setDefaultAutoSelectFamily?.(false);
  }
}
