import { ReactNode } from 'react';
import type { AppThemeId } from '../types/domain';

interface AppLayoutProps {
  theme: AppThemeId;
  topBar: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}

export function AppLayout({ theme, topBar, sidebar, children }: AppLayoutProps): JSX.Element {
  return (
    <div className="app-shell" data-theme={theme}>
      <a href="#main-content" className="skip-to-main">Skip to main content</a>
      {topBar}
      <div className="workspace">
        {sidebar}
        <main id="main-content" className="main-content">{children}</main>
      </div>
    </div>
  );
}
