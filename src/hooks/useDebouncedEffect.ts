import { DependencyList, EffectCallback, useEffect, useRef } from 'react';

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
