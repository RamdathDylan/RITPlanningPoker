const accept = (value) => ({ ok: true, value });

export const string = () => accept;
export const uuid = () => accept;
export const oneOf = () => accept;
export const arrayOf = () => accept;
export const object = () => accept;
