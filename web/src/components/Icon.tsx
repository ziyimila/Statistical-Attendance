import type { SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'calendar'
  | 'chart'
  | 'settings'
  | 'check'
  | 'calendarMinus'
  | 'close'
  | 'minus'
  | 'plus'
  | 'trash'
  | 'download'
  | 'logout'
  | 'clock'
  | 'alert'
  | 'chevronLeft'
  | 'chevronRight';

const PATHS: Record<IconName, string[]> = {
  home: ['M4 10.8 12 4l8 6.8', 'M6.4 9.6V19a1 1 0 0 0 1 1h9.2a1 1 0 0 0 1-1V9.6'],
  calendar: ['M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z', 'M4 10h16', 'M8.5 3.5V7', 'M15.5 3.5V7'],
  chart: ['M5.5 19.5V12', 'M12 19.5V5.5', 'M18.5 19.5v-5'],
  settings: ['M5 8.5h5.5', 'M14.5 8.5H19', 'M5 15.5h3.5', 'M12.5 15.5H19', 'M12.6 6.6v3.8', 'M10.4 13.6v3.8'],
  check: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8.2 12.4l2.6 2.6 5-5.4'],
  calendarMinus: ['M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z', 'M4 10h16', 'M8.5 3.5V7', 'M15.5 3.5V7', 'M9.5 15h5'],
  close: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
  minus: ['M6 12h12'],
  plus: ['M12 6v12', 'M6 12h12'],
  trash: ['M5 7.5h14', 'M9.8 7.5V5.2a1 1 0 0 1 1-1h2.4a1 1 0 0 1 1 1v2.3', 'M6.6 7.5l.9 11.4a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5l.9-11.4'],
  download: ['M12 4v10', 'M8.2 10.6 12 14.4l3.8-3.8', 'M5 19.5h14'],
  logout: ['M14.5 12H4.5', 'M8.2 8.2 4.5 12l3.7 3.8', 'M14.5 4.5H19a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4.5'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7.5V12l3 2'],
  alert: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7.8v5', 'M12 16.1h.01'],
  chevronLeft: ['M14.5 6.5 9 12l5.5 5.5'],
  chevronRight: ['M9.5 6.5 15 12l-5.5 5.5'],
};

interface Props extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export default function Icon({ name, size = 22, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
