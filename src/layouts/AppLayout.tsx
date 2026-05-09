import { ReactNode, useEffect } from 'react';
import type { AppThemeId } from '../types/domain';

interface AppLayoutProps {
  theme: AppThemeId;
  topBar: ReactNode;
  sidebar: ReactNode;
  bottomNav?: ReactNode;
  children: ReactNode;
}

const THEME_COLORS: Record<AppThemeId, string> = {
  'classic-library': '#f5f1ea',
  'modern-minimal': '#f7f8fb',
  'warm-study': '#efe4d1',
  'dark-archive': '#211c18',
  'light-paper': '#fbfaf6'
};

export function AppLayout({ theme, topBar, sidebar, bottomNav, children }: AppLayoutProps): JSX.Element {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;

    const color = THEME_COLORS[theme];
    const themeMetaTags = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    themeMetaTags.forEach((tag) => {
      if (!tag.media) {
        tag.content = color;
      }
    });
  }, [theme]);

  return (
    <div className="app-shell" data-theme={theme}>
      <a href="#main-content" className="skip-to-main">Skip to main content</a>
      {topBar}
      <div className="workspace">
        {sidebar}
        <main id="main-content" className="main-content">{children}</main>
      </div>
      {bottomNav}
    </div>
  );
}
