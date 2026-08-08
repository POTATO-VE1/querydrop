/**
 * Icon — minimal inline SVG icon set
 * No external icon library, no sprite sheet. Each icon is a small typed component.
 * Stroke uses currentColor so it inherits from parent.
 */

import type { ReactElement, SVGProps } from 'react';

export type IconName =
  | 'arrow-right'
  | 'check'
  | 'close'
  | 'play'
  | 'download'
  | 'upload'
  | 'search'
  | 'menu'
  | 'github'
  | 'twitter'
  | 'discord'
  | 'code'
  | 'chart'
  | 'table'
  | 'pivot'
  | 'clean'
  | 'template'
  | 'share'
  | 'lock'
  | 'eye'
  | 'plus'
  | 'minus'
  | 'chevron-down'
  | 'chevron-right'
  | 'sparkle'
  | 'bolt'
  | 'globe'
  | 'database'
  | 'clock'
  | 'trash'
  | 'list'
  | 'pin'
  | 'edit'
  | 'file'
  | 'shuffle'
  | 'x'
  | 'build'
  | 'workspace'
  | 'more'
  | 'mail'
  | 'spinner';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

const PATHS: Record<IconName, ReactElement> = {
  'arrow-right': <path d="M5 12h14M13 5l7 7-7 7" />,
  'check': <path d="M5 12l5 5L20 7" />,
  'close': <path d="M18 6L6 18M6 6l12 12" />,
  'play': <path d="M5 3v18l15-9L5 3z" />,
  'download': <path d="M12 3v14M5 10l7 7 7-7M5 21h14" />,
  'upload': <path d="M12 21V7M5 14l7-7 7 7M5 3h14" />,
  'search': <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  'menu': <path d="M3 6h18M3 12h18M3 18h18" />,
  'github': <path d="M12 2C6.5 2 2 6.6 2 12.3c0 4.5 2.9 8.3 6.8 9.7.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.4-3.4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.5-1.1-4.5-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1 .8-.2 1.6-.3 2.5-.3.8 0 1.7.1 2.5.3 1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.5 5 .4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5 4-1.4 6.8-5.2 6.8-9.7C22 6.6 17.5 2 12 2z" fill="currentColor" stroke="none" />,
  'twitter': <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" stroke="none" />,
  'discord': <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 00-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 00-4.8 0c-.14-.34-.35-.77-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.7-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z" fill="currentColor" stroke="none" />,
  'code': <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />,
  'chart': <><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-6" /></>,
  'table': <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>,
  'pivot': <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
  'clean': <path d="M9 11l3 3 8-8M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
  'template': <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
  'share': <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>,
  'lock': <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></>,
  'eye': <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  'plus': <path d="M12 5v14M5 12h14" />,
  'minus': <path d="M5 12h14" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  'sparkle': <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM19 14l.8 2.4L22 17l-2.2.6L19 20l-.8-2.4L16 17l2.2-.6L19 14z" />,
  'bolt': <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />,
  'globe': <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></>,
  'database': <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" /></>,
  'clock': <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  'trash': <><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></>,
  'list': <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  'pin': <path d="M12 17v5M5 10l7-7 7 7-3 3v4H8v-4l-3-3z" />,
  'edit': <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z" /></>,
  'file': <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></>,
  'shuffle': <><path d="M16 3h5v5" /><path d="M4 20L21 3" /><path d="M21 16v5h-5" /><path d="M15 15l6 6" /><path d="M4 4l5 5" /></>,
  'x': <path d="M18 6L6 18M6 6l12 12" />,
  'build': <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />,
  'workspace': <><path d="M3 4h18v3H3z" /><path d="M3 10h18v3H3z" /><path d="M3 16h18v4H3z" /></>,
  'more': <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
  'mail': <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" /></>,
  'spinner': <><path d="M21 12a9 9 0 1 1-6.219-8.56" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></>,
};

export function Icon({ name, size = 18, ...rest }: IconProps): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
