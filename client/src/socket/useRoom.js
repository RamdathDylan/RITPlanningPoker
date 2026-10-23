export function useRoom() {
  return { status: "connecting", room: null, send: async () => ({}), leave: async () => {} };
}
