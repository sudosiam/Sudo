/** Simple pub/sub so TanStack queries refresh after local writes or Realtime events. */
type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeQueryInvalidation(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function invalidateQueries() {
  listeners.forEach((l) => l());
}
