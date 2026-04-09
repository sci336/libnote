import { EmptyState } from '../components/EmptyState';
import { InlineEditableText } from '../components/InlineEditableText';
import type { Page } from '../types/domain';
import { formatTimestamp } from '../utils/date';
import { getPagePreview } from '../utils/pageState';

interface LoosePagesViewProps {
  loosePages: Page[];
  onCreateLoosePage: () => void;
  onOpenPage: (pageId: string) => void;
  onRenamePage: (pageId: string, title: string) => void;
  onDeletePage: (page: Page) => void;
}

export function LoosePagesView({
  loosePages,
  onCreateLoosePage,
  onOpenPage,
  onRenamePage,
  onDeletePage
}: LoosePagesViewProps): JSX.Element {
  return (
    <section className="content-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Loose Pages</h1>
        </div>
        <div className="section-actions">
          <button type="button" className="primary-button" onClick={onCreateLoosePage}>
            New Loose Page
          </button>
        </div>
      </div>

      {loosePages.length > 0 ? (
        <div className="stack-list">
          {loosePages.map((page) => (
            <article key={page.id} className="list-card">
              <div className="list-card-main">
                <InlineEditableText
                  value={page.title}
                  onSave={(title) => onRenamePage(page.id, title)}
                  className="list-card-title"
                  inputClassName="inline-input block-input"
                />
                <p>{getPagePreview(page)}</p>
                <p>Updated {formatTimestamp(page.updatedAt)}</p>
              </div>
              <div className="card-actions">
                <button type="button" className="primary-button" onClick={() => onOpenPage(page.id)}>
                  Open
                </button>
                <button type="button" className="danger-button subtle" onClick={() => onDeletePage(page)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No loose pages yet"
          message="Loose pages live outside books and stay easy to reach from the sidebar."
          actionLabel="Create Loose Page"
          onAction={onCreateLoosePage}
        />
      )}
    </section>
  );
}
