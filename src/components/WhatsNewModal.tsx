import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { APP_VERSION, RELEASE_NOTES } from '../config/releaseNotes';
import { useModalFocus } from '../hooks/useModalFocus';

export const LAST_SEEN_UPDATE_VERSION_KEY = 'libnote:lastSeenUpdateVersion';

export function WhatsNewModal(): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (RELEASE_NOTES.length === 0) {
      return;
    }

    try {
      setIsOpen(window.localStorage.getItem(LAST_SEEN_UPDATE_VERSION_KEY) !== APP_VERSION);
    } catch {
      setIsOpen(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(LAST_SEEN_UPDATE_VERSION_KEY, APP_VERSION);
    } catch {
      // If storage is unavailable, still let the user dismiss this session's notice.
    }

    setIsOpen(false);
  }, []);

  useModalFocus({
    isOpen,
    containerRef: panelRef,
    initialFocusRef: titleRef,
    fallbackReturnFocusSelector: '#main-content',
    onClose: dismiss
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div className="whats-new-layer" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
      <div className="whats-new-backdrop" aria-hidden="true" onClick={dismiss} />
      <section className="whats-new-panel" ref={panelRef} tabIndex={-1}>
        <div className="whats-new-modal-header">
          <ReleaseNotesHeader titleId="whats-new-title" titleRef={titleRef} />
          <button type="button" className="icon-button" onClick={dismiss} aria-label="Dismiss what's new">
            ×
          </button>
        </div>

        <ReleaseNotesList />

        <div className="whats-new-actions">
          <button type="button" className="primary-button" onClick={dismiss}>
            Got it
          </button>
        </div>
      </section>
    </div>
  );
}

interface ReleaseNotesHeaderProps {
  titleId?: string;
  titleRef?: RefObject<HTMLHeadingElement>;
}

export function ReleaseNotesHeader({ titleId, titleRef }: ReleaseNotesHeaderProps): JSX.Element {
  return (
    <div>
      <p className="eyebrow">Version {APP_VERSION}</p>
      <h2 id={titleId} ref={titleRef} tabIndex={titleRef ? -1 : undefined}>What's New in LibNote</h2>
    </div>
  );
}

export function ReleaseNotesList(): JSX.Element {
  return (
    <ul className="whats-new-list">
      {RELEASE_NOTES.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}
