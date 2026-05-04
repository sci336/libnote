import { useLayoutEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

interface ModalFocusOptions {
  isOpen: boolean;
  containerRef: RefObject<HTMLElement>;
  initialFocusRef?: RefObject<HTMLElement>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  fallbackReturnFocusSelector?: string;
  onClose?: () => void;
  shouldCloseOnEscape?: boolean;
}

export function useModalFocus({
  isOpen,
  containerRef,
  initialFocusRef,
  returnFocusRef,
  fallbackReturnFocusSelector,
  onClose,
  shouldCloseOnEscape = true
}: ModalFocusOptions): void {
  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocusedElement =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null);

    const initialFocusTarget =
      initialFocusRef?.current ?? getFocusableElements(containerRef.current)[0] ?? containerRef.current;

    initialFocusTarget?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && shouldCloseOnEscape) {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const focusableElements = getFocusableElements(container);

      if (focusableElements.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === firstElement || !container.contains(activeElement))) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      const returnFocusTarget =
        previouslyFocusedElement?.isConnected
          ? previouslyFocusedElement
          : fallbackReturnFocusSelector
            ? document.querySelector<HTMLElement>(fallbackReturnFocusSelector)
            : null;

      if (returnFocusTarget?.isConnected && document.activeElement !== returnFocusTarget) {
        returnFocusTarget.focus();
      }
    };
  }, [
    containerRef,
    fallbackReturnFocusSelector,
    initialFocusRef,
    isOpen,
    onClose,
    returnFocusRef,
    shouldCloseOnEscape
  ]);
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}
