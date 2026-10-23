// Records every event a client receives, so tests can scan all traffic for leaks.
export function recordPackets(socket) {
  const packets = [];
  socket.onAny((event, ...args) => packets.push({ event, args }));
  return packets;
}

// Returns the path of every property named `key`, at any depth.
export function findKeyDeep(value, key, path = "$") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findKeyDeep(item, key, `${path}[${index}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([name, child]) => [
      ...(name === key ? [`${path}.${name}`] : []),
      ...findKeyDeep(child, key, `${path}.${name}`),
    ]);
  }
  return [];
}
