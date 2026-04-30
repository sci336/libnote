import type { TrashItem } from '../types/domain';
import { formatTimestamp } from '../utils/date';

interface TrashViewProps {
  items: TrashItem[];
  onRestore: (item: TrashItem) => void;
  onDeleteForever: (item: TrashItem) => void;
  onEmptyTrash: () => void;
}

export function TrashView({
  items,
  onRestore,
  onDeleteForever,
  onEmptyTrash
}: TrashViewProps): JSX.Element {
  return (
    <section className="content-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Trash</h1>
        </div>
        <div className="section-actions">
          <button type="button" className="danger-button subtle" onClick={onEmptyTrash} disabled={items.length === 0}>
            Empty Trash
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <h2>Trash is empty</h2>
          <p>Deleted books, chapters, and pages will appear here until you restore or permanently remove them.</p>
        </div>
      ) : (
        <div className="stack-list">
          {items.map((item) => (
            <article key={`${item.type}-${item.id}`} className="list-card">
              <div className="list-card-main">
                <div className="list-card-row">
                  <strong className="list-card-title">{item.title || 'Untitled'}</strong>
                </div>
                <p>{getTrashTypeLabel(item.type)}</p>
                <p>Deleted {formatTimestamp(item.deletedAt)}</p>
                {item.originalLocation ? <p>From {item.originalLocation}</p> : null}
              </div>
              <div className="card-actions">
                <button type="button" className="secondary-button" onClick={() => onRestore(item)}>
                  Restore
                </button>
                <button type="button" className="danger-button" onClick={() => onDeleteForever(item)}>
                  Delete Forever
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function getTrashTypeLabel(type: TrashItem['type']): string {
  if (type === 'book') {
    return 'Book';
  }

  if (type === 'chapter') {
    return 'Chapter';
  }

  if (type === 'loosePage') {
    return 'Loose Page';
  }

  return 'Page';
}
