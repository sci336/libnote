interface TagSuggestionsDropdownProps {
  suggestions: string[];
  activeIndex: number;
  onSelect: (tag: string) => void;
  ariaLabel?: string;
  prefix?: string;
  className?: string;
}

export function TagSuggestionsDropdown({
  suggestions,
  activeIndex,
  onSelect,
  ariaLabel = 'Tag suggestions',
  prefix = '/',
  className = ''
}: TagSuggestionsDropdownProps): JSX.Element | null {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className={`tag-suggestions-dropdown ${className}`.trim()} role="listbox" aria-label={ariaLabel}>
      {suggestions.map((tag, index) => (
        <button
          key={tag}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={`tag-suggestion-item ${index === activeIndex ? 'is-active' : ''}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(tag)}
        >
          <span className="tag-suggestion-token">{prefix}{tag}</span>
        </button>
      ))}
    </div>
  );
}
