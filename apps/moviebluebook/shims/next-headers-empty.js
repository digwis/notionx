// Empty shim for `next/headers` used only by the client-side
// import-analysis pre-bundle scan. The real `next/headers` module is
// resolved by vinext in the rsc/ssr Vite environments. This file is
// never executed in the browser.
export const headers = async () => new Headers();
export const cookies = async () => {
  const map = new Map();
  return {
    get: (name) => map.get(name) ?? null,
    set: (name, value) => map.set(name, value),
    delete: (name) => map.delete(name),
    has: (name) => map.has(name),
    getAll: () => [],
  };
};
export const draftMode = async () => ({ isEnabled: false, enable: () => {}, disable: () => {} });
