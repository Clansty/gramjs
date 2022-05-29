export const isDeno = "Deno" in globalThis;
export const isBrowser = false;
export const isNode = !isBrowser;
