import { useEffect, useRef, useState } from 'react';

interface InlineEditableTextProps {
  value: string;
  onSave: (nextValue: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}

export function InlineEditableText({
  value,
  onSave,
  className,
  inputClassName,
  placeholder
}: InlineEditableTextProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  function commit() {
    setIsEditing(false);
    onSave(draft);
  }

  function cancel() {
    setDraft(value);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        aria-label="Edit title"
        className={inputClassName}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
          }

          if (event.key === 'Escape') {
            cancel();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => setIsEditing(true)}
      title="Click to edit title"
    >
      {value || placeholder || 'Untitled'}
    </button>
  );
}
