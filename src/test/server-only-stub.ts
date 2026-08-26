/**
 * Stub for the `server-only` package under Vitest.
 *
 * That package deliberately throws when resolved outside a React Server
 * Component, which is what we want in the app and not what we want in a plain
 * Node test process. Aliasing it here lets server modules be unit-tested
 * without weakening the guard in the real build.
 */
export {};
