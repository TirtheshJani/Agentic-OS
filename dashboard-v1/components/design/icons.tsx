// Ported from .design-handoff/project/icons.jsx.
// Hand-rolled stroke SVG icons. Stroke 1.6, round caps, 16px viewBox.

import type { CSSProperties, SVGProps } from "react";

type IconProps = {
  size?: number;
  strokeW?: number;
  viewBox?: string;
  style?: CSSProperties;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "size" | "stroke">;

function Icon({
  size = 16,
  strokeW = 1.6,
  children,
  viewBox = "0 0 16 16",
  ...rest
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeW}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const I = {
  inbox:    (p: IconProps = {}) => <Icon {...p}><path d="M2 9l2.5-5h7L14 9M2 9v3.5A.5.5 0 0 0 2.5 13h11a.5.5 0 0 0 .5-.5V9M2 9h3.2l.8 1.4h4l.8-1.4H14" /></Icon>,
  mine:     (p: IconProps = {}) => <Icon {...p}><circle cx="8" cy="5.5" r="2.2" /><path d="M3.5 13c.5-2.4 2.4-3.8 4.5-3.8s4 1.4 4.5 3.8" /></Icon>,
  issues:   (p: IconProps = {}) => <Icon {...p}><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="1.2" /></Icon>,
  board:    (p: IconProps = {}) => <Icon {...p}><rect x="2" y="3" width="3.2" height="10" rx="0.5" /><rect x="6.4" y="3" width="3.2" height="7" rx="0.5" /><rect x="10.8" y="3" width="3.2" height="5" rx="0.5" /></Icon>,
  agents:   (p: IconProps = {}) => <Icon {...p}><circle cx="5.5" cy="6" r="1.8" /><circle cx="10.5" cy="6" r="1.8" /><path d="M2 13c.4-1.8 1.8-2.8 3.5-2.8M14 13c-.4-1.8-1.8-2.8-3.5-2.8M6.8 13c.3-1.2 1-1.8 1.2-1.8s.9.6 1.2 1.8" /></Icon>,
  runtimes: (p: IconProps = {}) => <Icon {...p}><rect x="2" y="3" width="12" height="3.2" rx="0.6" /><rect x="2" y="9.8" width="12" height="3.2" rx="0.6" /><circle cx="4.4" cy="4.6" r="0.3" fill="currentColor" /><circle cx="4.4" cy="11.4" r="0.3" fill="currentColor" /></Icon>,
  skills:   (p: IconProps = {}) => <Icon {...p}><path d="M8 1.5l1.7 3.6 3.9.5-2.9 2.7.8 3.9L8 10.4 4.5 12.2l.8-3.9L2.4 5.6l3.9-.5L8 1.5z" /></Icon>,
  vault:    (p: IconProps = {}) => <Icon {...p}><path d="M2.5 4.5l5.5-2.2 5.5 2.2v4.7c0 2.6-2.4 4.4-5.5 5.3-3.1-.9-5.5-2.7-5.5-5.3V4.5z" /></Icon>,
  settings: (p: IconProps = {}) => <Icon {...p}><circle cx="8" cy="8" r="2" /><path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4" /></Icon>,
  plus:     (p: IconProps = {}) => <Icon {...p}><path d="M8 3.2v9.6M3.2 8h9.6" /></Icon>,
  filter:   (p: IconProps = {}) => <Icon {...p}><path d="M2 4h12M4.5 8h7M6.5 12h3" /></Icon>,
  display:  (p: IconProps = {}) => <Icon {...p}><path d="M2 5h12M2 8h8M2 11h12" /></Icon>,
  search:   (p: IconProps = {}) => <Icon {...p}><circle cx="7" cy="7" r="4.2" /><path d="M10 10l3 3" /></Icon>,
  chevron:  (p: IconProps = {}) => <Icon {...p}><path d="M5 6l3 3 3-3" /></Icon>,
  chevronRight: (p: IconProps = {}) => <Icon {...p}><path d="M6 5l3 3-3 3" /></Icon>,
  more:     (p: IconProps = {}) => <Icon {...p}><circle cx="4" cy="8" r="0.6" fill="currentColor" /><circle cx="8" cy="8" r="0.6" fill="currentColor" /><circle cx="12" cy="8" r="0.6" fill="currentColor" /></Icon>,
  arrowUR:  (p: IconProps = {}) => <Icon {...p}><path d="M5 11l6-6M6.5 5H11v4.5" /></Icon>,
  play:     (p: IconProps = {}) => <Icon {...p}><path d="M5 3.5l7 4.5-7 4.5V3.5z" /></Icon>,
  pause:    (p: IconProps = {}) => <Icon {...p}><path d="M5.5 3.5v9M10.5 3.5v9" /></Icon>,
  handoff:  (p: IconProps = {}) => <Icon {...p}><path d="M2 8h9M8 5l3 3-3 3M11 4.5v7" /></Icon>,
  spark:    (p: IconProps = {}) => <Icon {...p}><path d="M8 2l1.4 4.1 4.1 1.4-4.1 1.4L8 13l-1.4-4.1L2.5 7.5l4.1-1.4L8 2z" /></Icon>,
  bolt:     (p: IconProps = {}) => <Icon {...p}><path d="M9 1.5L3.5 9h3.5L7 14.5 12.5 7H9V1.5z" /></Icon>,
  warning:  (p: IconProps = {}) => <Icon {...p}><path d="M8 2l6.5 11h-13L8 2zM8 6v3.5M8 11.2v.2" /></Icon>,
  link:     (p: IconProps = {}) => <Icon {...p}><path d="M9 5l1.5-1.5a2.5 2.5 0 0 1 3.5 3.5L12.5 8.5M7 11l-1.5 1.5a2.5 2.5 0 0 1-3.5-3.5L3.5 7.5M6 10l4-4" /></Icon>,
  clock:    (p: IconProps = {}) => <Icon {...p}><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.5" /></Icon>,
  branch:   (p: IconProps = {}) => <Icon {...p}><circle cx="4" cy="3.5" r="1.2" /><circle cx="4" cy="12.5" r="1.2" /><circle cx="12" cy="6" r="1.2" /><path d="M4 4.7v6.6M4 8c0-2 1.5-2 4-2" /></Icon>,
  github:   (p: IconProps = {}) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 16 16" fill="currentColor" style={p.style} className={p.className}>
      <path d="M8 0a8 8 0 0 0-2.5 15.6c.4.1.5-.2.5-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7 0-.6.3-.9.5-1.2-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2 0 0 .7-.2 2.2.8.6-.2 1.3-.3 2-.3.7 0 1.4.1 2 .3 1.5-1 2.2-.8 2.2-.8.4 1 .2 1.8.1 2 .5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.3.6.8.6 1.6v2.4c0 .2.1.5.6.4A8 8 0 0 0 8 0z" />
    </svg>
  ),
  close:    (p: IconProps = {}) => <Icon {...p}><path d="M4 4l8 8M12 4l-8 8" /></Icon>,
  layout:   (p: IconProps = {}) => <Icon {...p}><rect x="2" y="2.5" width="12" height="11" rx="1" /><path d="M2 6h12M6 6v7.5" /></Icon>,
  list:     (p: IconProps = {}) => <Icon {...p}><path d="M5 4h9M5 8h9M5 12h9" /><circle cx="2.5" cy="4" r="0.5" fill="currentColor" /><circle cx="2.5" cy="8" r="0.5" fill="currentColor" /><circle cx="2.5" cy="12" r="0.5" fill="currentColor" /></Icon>,
  star:     (p: IconProps = {}) => <Icon {...p}><path d="M8 2l1.7 3.6 3.9.5-2.9 2.7.8 3.9L8 10.4 4.5 12.2l.8-3.9L2.4 5.6l3.9-.5L8 2z" /></Icon>,
  spinner:  (p: IconProps = {}) => <Icon {...p}><path d="M8 2v3M8 11v3M2 8h3M11 8h3M3.8 3.8l2.1 2.1M10.1 10.1l2.1 2.1M3.8 12.2l2.1-2.1M10.1 5.9l2.1-2.1" /></Icon>,
  edit:     (p: IconProps = {}) => <Icon {...p}><path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z" /></Icon>,
};
