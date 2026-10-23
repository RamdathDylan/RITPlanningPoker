import { createContext, useContext } from "react";
import { createApi } from "./api.js";
import { createSessionStore } from "./session.js";

// React context: a way to hand shared objects to any component without passing them through
// every level. Pages read the API and session store from here, so tests can provide fakes.
const ServicesContext = createContext(null);

export function createDefaultServices() {
  return { api: createApi(), sessions: createSessionStore() };
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
