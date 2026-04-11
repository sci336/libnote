import { useEffect, useMemo, useState } from 'react';

interface Option {
  id: string;
  label: string;
}

interface MoveTargetPanelProps {
  title: string;
  options: Option[];
  currentTargetId?: string;
  submitLabel: string;
  onConfirm: (targetId: string) => void;
  onCancel: () => void;
}

/**
 * Reusable "move into another container" chooser for chapters and pages.
 * Filtering the current container out here keeps the mutation handlers simpler
 * and prevents no-op moves from showing up as valid options in the UI.
 */
export function MoveTargetPanel({
  title,
  options,
  currentTargetId,
  submitLabel,
  onConfirm,
  onCancel
}: MoveTargetPanelProps): JSX.Element {
  const eligibleOptions = useMemo(
    () => options.filter((option) => option.id !== currentTargetId),
    [currentTargetId, options]
  );
  const [selectedId, setSelectedId] = useState(eligibleOptions[0]?.id ?? '');

  useEffect(() => {
    setSelectedId(eligibleOptions[0]?.id ?? '');
  }, [eligibleOptions]);

  return (
    <div className="move-panel">
      <h3>{title}</h3>
      <label>
        <span>Destination</span>
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {eligibleOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="move-panel-actions">
        <button
          type="button"
          className="primary-button"
          disabled={!selectedId}
          onClick={() => onConfirm(selectedId)}
        >
          {submitLabel}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
