import React from 'react';

// Pixel sizes kept in one place so every consumer (sidebar chips,
// table rows, profile headers) stays visually consistent.
const SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', string> = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

interface AvatarProps {
  /** Data URL or http(s) URL of the profile picture. Falls back to initials when null/undefined/empty. */
  avatarUrl?: string | null;
  /** 1-2 letter fallback shown when there's no picture. */
  initials?: string | null;
  /** Background color for the initials fallback (ignored once a picture is set). */
  color?: string | null;
  /** Text color for the initials fallback. Defaults to white -- pass an accent color (e.g. gold/red) for the dark sidebar-chip look. */
  textColor?: string;
  /** Accessible label / alt text -- ideally the person's full name. */
  name?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  /** Square (rounded) vs fully round -- FarmOwnersView uses square chips, sidebars use round ones. */
  shape?: 'circle' | 'square';
}

// Shared everywhere a person's picture needs to show -- the admin's own
// avatar in Navigation.tsx, the super admin's in SuperAdminShell.tsx, a
// farm owner's in FarmOwnersView.tsx / SuperAdminOverviewPage.tsx /
// OwnerShell.tsx. Renders the uploaded picture when present, otherwise
// falls back to the same initials-in-a-colored-chip look the app
// already used everywhere before pictures existed, so nothing regresses
// for people who haven't uploaded one yet.
export const Avatar: React.FC<AvatarProps> = ({
  avatarUrl,
  initials,
  color,
  textColor = '#FFFFFF',
  name,
  size = 'md',
  className = '',
  shape = 'circle',
}) => {
  const sizeClass = SIZE_CLASSES[size];
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ? `${name}'s profile picture` : 'Profile picture'}
        className={`${sizeClass} ${shapeClass} object-cover border border-[#404040] shadow-md flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${shapeClass} flex items-center justify-center font-bold shadow-md flex-shrink-0 border border-[#404040] ${className}`}
      style={{ backgroundColor: color || '#1A1A1A', color: textColor }}
      aria-label={name ? `${name}'s initials` : undefined}
    >
      {initials || '—'}
    </div>
  );
};
