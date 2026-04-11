import { DependencyList, EffectCallback, useEffect, useRef } from 'react';

/**
 * Delays a side effect until dependencies settle while still running the latest
 * callback body. This is mainly used for persistence so rapid typing does not
 * trigger a write on every keystroke.
 */
export function useDebouncedEffect(
  effect: EffectCallback,
  deps: DependencyList,
  delay: number
): void {
  const effectRef = useRef(effect);

  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      effectRef.current();
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [...deps, delay]);
}
