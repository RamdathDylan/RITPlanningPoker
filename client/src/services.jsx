import { createContext, useContext } from "react";
import { io } from "socket.io-client";
import { createApi } from "./api.js";
import { createSessionStore } from "./session.js";

// React context: a way to hand shared objects to any component without passing them through
// every level. Pages read the API, session store, and socket factory from here, so tests can
// provide fakes.
const ServicesContext = createContext(null);

// Same origin as the page; the rejoin token travels only in the handshake, never in a URL.
const connectSocket = (token) => io({ auth: { token } });

// Saves a file the browser received (e.g. the CSV export) through a temporary download link.
function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function createDefaultServices() {
  return { api: createApi(), sessions: createSessionStore(), connectSocket, saveFile };
}

export function ServicesProvider({ value, children }) {
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices() {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error("useServices must be used inside a ServicesProvider");
  }
  return services;
}
