import { useMemo, useState, type ReactNode } from 'react';

type DropEdge = 'top' | 'bottom';

interface ReorderableListProps<T extends { id: string }> {
  items: T[];
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T, reorderControls: ReactNode) => JSX.Element;
  getItemLabel?: (item: T) => string;
  listClassName?: string;
  itemClassName?: string;
  itemDraggingClassName?: string;
  itemDropTopClassName?: string;
  itemDropBottomClassName?: string;
  isEnabled?: boolean;
}

/**
 * Small shared drag-and-drop primitive for chapter/page ordering.
 * It reports a complete ordered id list so the store layer can validate and
 * persist the new order without coupling DOM drag state to data mutations.
 */
export function ReorderableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  getItemLabel,
  listClassName,
  itemClassName,
  itemDraggingClassName,
  itemDropTopClassName,
  itemDropBottomClassName,
  isEnabled = true
}: ReorderableListProps<T>): JSX.Element {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; edge: DropEdge } | null>(null);

  const ids = useMemo(() => items.map((item) => item.id), [items]);

  function resetDragState() {
    setDraggedId(null);
    setDropTarget(null);
  }

  function handleDrop(targetId: string, edge: DropEdge) {
    if (!draggedId || draggedId === targetId) {
      resetDragState();
      return;
    }

    const orderedIds = reorderIds(ids, draggedId, targetId, edge);
    resetDragState();

    if (!orderedIds.every((id, index) => id === ids[index])) {
      onReorder(orderedIds);
    }
  }

  function moveItem(itemId: string, nextIndex: number): void {
    const currentIndex = ids.indexOf(itemId);

    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= ids.length || currentIndex === nextIndex) {
      return;
    }

    const orderedIds = [...ids];
    orderedIds.splice(currentIndex, 1);
    orderedIds.splice(nextIndex, 0, itemId);
    onReorder(orderedIds);
  }

  return (
    <div className={listClassName}>
      {items.map((item) => {
        const isDragging = draggedId === item.id;
        const isDropTop = dropTarget?.id === item.id && dropTarget.edge === 'top';
        const isDropBottom = dropTarget?.id === item.id && dropTarget.edge === 'bottom';

        const itemIndex = ids.indexOf(item.id);
        const itemLabel = getItemLabel?.(item) ?? 'item';
        const reorderControls =
          isEnabled && ids.length > 1 ? (
            <span className="reorder-keyboard-controls" role="group" aria-label={`Reorder ${itemLabel}`}>
              <button
                type="button"
                className="reorder-keyboard-button"
                aria-label={`Move ${itemLabel} to top`}
                title="Move to top"
                disabled={itemIndex === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  moveItem(item.id, 0);
                }}
              >
                ↑↑
              </button>
              <button
                type="button"
                className="reorder-keyboard-button"
                aria-label={`Move ${itemLabel} up`}
                title="Move up"
                disabled={itemIndex === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  moveItem(item.id, itemIndex - 1);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="reorder-keyboard-button"
                aria-label={`Move ${itemLabel} down`}
                title="Move down"
                disabled={itemIndex === ids.length - 1}
                onClick={(event) => {
                  event.stopPropagation();
                  moveItem(item.id, itemIndex + 1);
                }}
              >
                ↓
              </button>
              <button
                type="button"
                className="reorder-keyboard-button"
                aria-label={`Move ${itemLabel} to bottom`}
                title="Move to bottom"
                disabled={itemIndex === ids.length - 1}
                onClick={(event) => {
                  event.stopPropagation();
                  moveItem(item.id, ids.length - 1);
                }}
              >
                ↓↓
              </button>
            </span>
          ) : null;

        return (
          <div
            key={item.id}
            draggable={isEnabled}
            className={[
              itemClassName,
              isDragging ? itemDraggingClassName : '',
              isDropTop ? itemDropTopClassName : '',
              isDropBottom ? itemDropBottomClassName : ''
            ]
              .filter(Boolean)
              .join(' ')}
            onDragStart={(event) => {
              if (!isEnabled) {
                return;
              }

              setDraggedId(item.id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', item.id);
            }}
            onDragOver={(event) => {
              if (!isEnabled || !draggedId) {
                return;
              }

              event.preventDefault();
              const bounds = event.currentTarget.getBoundingClientRect();
              // Use the hovered half of the card instead of inserting between
              // invisible separators so the drop target stays easy to predict.
              const edge: DropEdge =
                event.clientY - bounds.top < bounds.height / 2 ? 'top' : 'bottom';

              if (draggedId === item.id) {
                setDropTarget(null);
                return;
              }

              if (
                dropTarget?.id !== item.id ||
                dropTarget.edge !== edge
              ) {
                setDropTarget({ id: item.id, edge });
              }
            }}
            onDrop={(event) => {
              if (!isEnabled) {
                return;
              }

              event.preventDefault();
              const bounds = event.currentTarget.getBoundingClientRect();
              const edge: DropEdge =
                event.clientY - bounds.top < bounds.height / 2 ? 'top' : 'bottom';
              handleDrop(item.id, edge);
            }}
            onDragEnd={resetDragState}
          >
            {renderItem(item, reorderControls)}
          </div>
        );
      })}
    </div>
  );
}

function reorderIds(
  ids: string[],
  draggedId: string,
  targetId: string,
  edge: DropEdge
): string[] {
  const nextIds = [...ids];
  const draggedIndex = nextIds.indexOf(draggedId);
  const targetIndex = nextIds.indexOf(targetId);

  if (draggedIndex === -1 || targetIndex === -1) {
    return ids;
  }

  nextIds.splice(draggedIndex, 1);

  const baseIndex = nextIds.indexOf(targetId);
  const insertIndex = edge === 'bottom' ? baseIndex + 1 : baseIndex;
  nextIds.splice(insertIndex, 0, draggedId);

  return nextIds;
}
