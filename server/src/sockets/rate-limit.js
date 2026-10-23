export function createSocketLimiter() {
  return { take: () => "allowed" };
}
