// Every reducer returns one of these two shapes.
export const accept = (state, effects = []) => ({ ok: true, state, effects });
export const reject = (code) => ({ ok: false, code });
