interface AppIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export function AppIcon({ size = 24, color = 'currentColor', className = '' }: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Prompt chevron > */}
      <path
        d="M3 7L10.5 12L3 17"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {/* Cursor block */}
      <rect x="13" y="8" width="8" height="8" fill={color} />
    </svg>
  );
}
