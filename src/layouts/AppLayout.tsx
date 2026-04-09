import { ReactNode } from 'react';

interface AppLayoutProps {
  topBar: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}

export function AppLayout({ topBar, sidebar, children }: AppLayoutProps): JSX.Element {
  return (
    <div className="app-shell">
      {topBar}
      <div className="workspace">
        {sidebar}
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
