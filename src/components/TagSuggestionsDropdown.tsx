interface TagSuggestionsDropdownProps {
  suggestions: string[];
  activeIndex: number;
  onSelect: (tag: string) => void;
}

export function TagSuggestionsDropdown({
  suggestions,
  activeIndex,
  onSelect
}: TagSuggestionsDropdownProps): JSX.Element | null {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="tag-suggestions-dropdown" role="listbox" aria-label="Tag suggestions">
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
          <span className="tag-suggestion-token">/{tag}</span>
        </button>
      ))}
    </div>
  );
}
