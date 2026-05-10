import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon({ children, ...props }: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function LibraryIcon(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M4 19.5V5.25A2.25 2.25 0 0 1 6.25 3H9v16H6.25A2.25 2.25 0 0 0 4 21.25" />
      <path d="M9 3h8.75A2.25 2.25 0 0 1 20 5.25v14.5A1.25 1.25 0 0 1 18.75 21H6.25" />
      <path d="M12.5 7H17" />
      <path d="M12.5 11H17" />
    </BaseIcon>
  );
}

export function SearchIcon(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <circle cx="10.75" cy="10.75" r="5.75" />
      <path d="m15.1 15.1 4.4 4.4" />
    </BaseIcon>
  );
}

export function PlusIcon(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function TagIcon(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M20 13.25 13.25 20a2.12 2.12 0 0 1-3 0L4 13.75V4h9.75L20 10.25a2.12 2.12 0 0 1 0 3Z" />
      <circle cx="8.5" cy="8.5" r="1.25" />
    </BaseIcon>
  );
}

export function TrashIcon(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </BaseIcon>
  );
}

export function BookIcon(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M5 19.5V5.25A2.25 2.25 0 0 1 7.25 3H19v16.5H7.25A2.25 2.25 0 0 0 5 21.75" />
      <path d="M8 7h7" />
      <path d="M8 11h5" />
    </BaseIcon>
  );
}

export function PageIcon(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </BaseIcon>
  );
}
