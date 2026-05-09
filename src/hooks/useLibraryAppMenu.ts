import { useState } from 'react';
import type { AppMenuSection } from '../types/domain';

interface UseLibraryAppMenuOptions {
  closeSidebarOnMobile: () => void;
}

export function useLibraryAppMenu({ closeSidebarOnMobile }: UseLibraryAppMenuOptions) {
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [appMenuSection, setAppMenuSection] = useState<AppMenuSection>('help');

  function openAppMenu(section: AppMenuSection = 'help'): void {
    setAppMenuSection(section);
    setAppMenuOpen(true);
    closeSidebarOnMobile();
  }

  function closeAppMenu(): void {
    setAppMenuOpen(false);
  }

  function navigateAppMenu(section: AppMenuSection): void {
    setAppMenuSection(section);
    setAppMenuOpen(true);
  }

  return {
    appMenuOpen,
    appMenuSection,
    setAppMenuOpen,
    setAppMenuSection,
    openAppMenu,
    closeAppMenu,
    navigateAppMenu
  };
}
