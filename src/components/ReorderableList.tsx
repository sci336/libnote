import { useMemo, useState } from 'react';

type DropEdge = 'top' | 'bottom';

interface ReorderableListProps<T extends { id: string }> {
  items: T[];
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T) => JSX.Element;
  listClassName?: string;
  itemClassName?: string;
  itemDraggingClassName?: string;
  itemDropTopClassName?: string;
  itemDropBottomClassName?: string;
  isEnabled?: boolean;
}

export function ReorderableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
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

  return (
    <div className={listClassName}>
      {items.map((item) => {
        const isDragging = draggedId === item.id;
        const isDropTop = dropTarget?.id === item.id && dropTarget.edge === 'top';
        const isDropBottom = dropTarget?.id === item.id && dropTarget.edge === 'bottom';

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
            {renderItem(item)}
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
