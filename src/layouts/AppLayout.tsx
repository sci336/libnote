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
      {topBar}
      <div className="workspace">
        {sidebar}
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
