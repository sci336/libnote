# Accessibility and Mobile Manual QA Checklist

## Keyboard-Only Navigation

### Skip to Main Content
- [ ] Tab from page load: "Skip to main content" link appears with focus
- [ ] Pressing Enter on skip link moves focus to the main content area
- [ ] Skip link is visually hidden when not focused

### Top Bar
- [ ] Tab reaches: App Menu button, Nav button, Back button (if shown), Home button, breadcrumb links, search input
- [ ] All buttons show visible focus ring when focused
- [ ] Search input accepts text; Escape clears text or blurs if empty
- [ ] Escape closes tag autocomplete suggestions before clearing search

### Sidebar
- [ ] Nav button opens sidebar; sidebar sections are focusable
- [ ] At narrow widths, the sidebar starts off-canvas and does not cover the app until Nav is opened
- [ ] Selecting a book, chapter, page, Loose Pages action, or Recent Pages item closes the mobile sidebar after navigation
- [ ] Section toggle buttons expand/collapse content
- [ ] Sidebar items are reachable via Tab
- [ ] Escape closes the sidebar (mobile/tablet only)
- [ ] Focus does not escape sidebar when tabbing through items

### Root Shelf Book Cards
- [ ] Book cards are reachable with Tab (tabIndex=0)
- [ ] Enter or Space opens the book
- [ ] Inline title edit: click to edit, Enter to save, Escape to cancel
- [ ] Escape during inline edit does NOT close surrounding UI
- [ ] Add Chapter, Change Cover, Move to Trash buttons are reachable

### App Menu Focus Trap and Escape
- [ ] Opening App Menu moves focus to the dialog title
- [ ] Tab cycles through focusable elements inside the dialog
- [ ] Shift+Tab wraps from first to last element
- [ ] Escape closes the menu
- [ ] Focus returns to the "Open app menu" button after close
- [ ] Clicking the backdrop closes the menu

### Cover Picker
- [ ] Opening cover picker moves focus into the picker dialog
- [ ] Tab cycles through cover options and the close button
- [ ] Each cover option has an accessible name ("Use X cover")
- [ ] Escape closes the picker
- [ ] Focus returns to the "Change Cover" button that opened it

### Move Panel (Book View / Chapter View)
- [ ] Opening "Move to..." focuses the destination select
- [ ] Escape closes the move panel
- [ ] Focus returns to the "Move to..." button
- [ ] Confirm and Cancel buttons are reachable

### Move Panel (Loose Page Editor)
- [ ] Opening "Move to Chapter" shows the inline move panel
- [ ] Book and Chapter selects are keyboard navigable
- [ ] Escape closes the move panel
- [ ] Move and Cancel buttons are reachable

### Autocomplete (Search Tags)
- [ ] Typing "/" in search shows tag suggestions
- [ ] ArrowDown/ArrowUp cycles through suggestions
- [ ] Enter selects the active suggestion
- [ ] Escape dismisses suggestions without clearing search text

### Autocomplete (Editor Tags and WikiLinks)
- [ ] Typing "/" in editor shows tag autocomplete
- [ ] Typing "[[" in editor shows page link autocomplete
- [ ] ArrowDown/ArrowUp cycles through suggestions
- [ ] Enter or Tab selects the active suggestion
- [ ] Escape dismisses autocomplete without immediately reopening while the same trigger text remains under the caret
- [ ] Clicking or tapping outside the editor dismisses autocomplete safely

### Search Result Navigation
- [ ] Search result cards are focusable buttons
- [ ] Filter row buttons have aria-pressed state
- [ ] Enter or click on a result card navigates to that item

### Tag Result Navigation
- [ ] Active tag pills have remove buttons with accessible labels
- [ ] Add tag input and submit button are keyboard accessible
- [ ] Recent tag suggestion buttons are reachable
- [ ] Tag result cards navigate on Enter/click

### Trash Navigation
- [ ] Restore and Delete Forever buttons have descriptive aria-labels
- [ ] Empty Trash button has an aria-label
- [ ] All buttons show visible focus rings

### Editor Toolbar
- [ ] Toolbar has role="toolbar" and aria-label="Text formatting"
- [ ] Each formatting button has aria-label and aria-pressed when active
- [ ] Text size select is labeled
- [ ] Buttons show focus rings

### Page Info Panel
- [ ] Show/Hide Page Info toggle has aria-expanded
- [ ] Outgoing link, backlink, and broken link buttons are focusable
- [ ] Tag pills in Page Info navigate to tag search on click/Enter

### Keyboard Reordering
- [ ] Reorder buttons (up, down, top, bottom) appear for books, chapters, pages
- [ ] Each button has a descriptive aria-label ("Move X up", etc.)
- [ ] Disabled state when item is already at boundary
- [ ] Screen reader live region announces new position after move
- [ ] Focus stays on the clicked button after the move

## Screen-Reader Label Spot Checks

### Destructive Buttons
- [ ] "Move to Trash" buttons include item name in aria-label
- [ ] "Delete Forever" buttons include item name in aria-label
- [ ] "Empty Trash" has aria-label "Permanently delete every item in Trash"
- [ ] "Restore Backup" (danger) button is identifiable

### Icon-Only Buttons
- [ ] Open app menu: aria-label="Open app menu"
- [ ] Go back: aria-label="Go back"
- [ ] Close app menu: aria-label="Close app menu"
- [ ] Close cover picker: aria-label="Close cover picker"
- [ ] Tag remove (x): aria-label="Remove tag X"

### Settings Controls
- [ ] Shelf style group: role="group" aria-label="Shelf style"
- [ ] Books per row group: role="group" aria-label="Books per row"
- [ ] Theme group: role="group" aria-label="App theme"
- [ ] Sort tags group: role="group" aria-label="Sort tags"

### Editor
- [ ] Page content contenteditable: aria-label="Page content"
- [ ] Tag editor region: aria-label="Page tags"
- [ ] Tag input: aria-label="Add tag"
- [ ] Editor mode toggle group: aria-label="Editor mode"

### Page Info Panel
- [ ] Panel aside: aria-label="Page Info"
- [ ] Tag filter links: aria-label="Open tag filter for X"

### WikiLink Preview
- [ ] Resolved links: title="Open X"
- [ ] Ambiguous links: aria-expanded, role="menu" on picker
- [ ] Destination options: role="menuitem"
- [ ] Cancel button: aria-label="Cancel choosing destination for X"

## Mobile / Narrow-Width Layout (375px)

### General
- [ ] No horizontal overflow or scrollbars
- [ ] Text is not cut off or overlapping
- [ ] All tap targets are at least 44x44px effective size

### Top Bar
- [ ] Top bar wraps cleanly
- [ ] Search input takes full width
- [ ] Breadcrumb text truncates gracefully

### Sidebar
- [ ] Sidebar opens as an overlay
- [ ] Backdrop appears and is tappable to close
- [ ] Sidebar content scrolls if taller than viewport
- [ ] Escape closes sidebar

### Root Shelf
- [ ] Book cards stack vertically or 2 per row
- [ ] Cover art is visible and not clipped
- [ ] Book card action buttons wrap or stack
- [ ] Card footer buttons are large enough to tap

### App Menu
- [ ] Panel fills screen height
- [ ] Nav items stack vertically and scroll
- [ ] Content area scrolls independently
- [ ] Close button is reachable

### Backup & Restore
- [ ] Import/Export buttons are full width
- [ ] Restore preview content scrolls
- [ ] Warnings are visible

### Editor
- [ ] Editor toolbar buttons wrap to multiple rows
- [ ] Text size control spans full width
- [ ] Tag editor is usable
- [ ] Autocomplete dropdown is positioned within viewport
- [ ] Page Info panel stacks below editor (no side-by-side)

### Search & Tag Results
- [ ] Result cards are full width
- [ ] Filter buttons wrap
- [ ] Tag input and recent tags stack vertically

### Trash View
- [ ] Trash cards are full width
- [ ] Restore and Delete Forever buttons are tappable

## Tablet Layout (768px)

### General
- [ ] No horizontal overflow
- [ ] Sidebar toggles as overlay (below 921px)
- [ ] Content has comfortable margins

### Root Shelf
- [ ] Book cards at 2-3 per row depending on setting
- [ ] Card actions are accessible

### Editor
- [ ] Toolbar wraps as needed
- [ ] Page Info panel stacks below editor
- [ ] Autocomplete positioned correctly

### App Menu
- [ ] Nav scrolls horizontally
- [ ] Settings grid stacks to single column

## Desktop Layout

### General
- [ ] Sidebar is inline (not overlay) when open
- [ ] No backdrop shown on desktop
- [ ] Content area uses available width

### Root Shelf
- [ ] Book cards respect booksPerRow setting
- [ ] Drag reorder works with mouse

### Editor
- [ ] Editor and Page Info side by side when panel is open
- [ ] Toolbar in single row
- [ ] Autocomplete positioned near cursor
