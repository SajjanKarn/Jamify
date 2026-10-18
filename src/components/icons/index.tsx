import React from "react";

const base = {
  fill: "currentColor",
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
};

export const HomeIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 3.06 2.5 11.5V21h6v-6h3v6h6v-9.5L12 3.06ZM12 1.5 1.5 10.5V22h8v-6h2v6h8V10.5L12 1.5Z" /></svg>
);

export const SearchIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M10.5 3a7.5 7.5 0 1 0 4.726 13.328l4.794 4.794 1.06-1.06-4.793-4.794A7.5 7.5 0 0 0 10.5 3Zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z" /></svg>
);

export const LibraryIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h15A1.5 1.5 0 0 1 21 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-15ZM5 5v14h14V5H5Zm3 4h2v6H8V9Zm4 0h2v6h-2V9Z" /></svg>
);

export const PlusIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 4.5v15h-1.5v-15H12ZM4.5 12v1.5h15V12h-15Z" /></svg>
);

export const PlayIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M8 5.5v13l11-6.5L8 5.5Z" /></svg>
);

export const PauseIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M6 4.5h4v15H6v-15Zm8 0h4v15h-4v-15Z" /></svg>
);

export const SkipPrevIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M16 5.5v13L7 12l9-6.5ZM6 5.5h2v13H6v-13Z" /></svg>
);

export const SkipNextIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M8 5.5v13L17 12 8 5.5ZM16 5.5h2v13h-2v-13Z" /></svg>
);

export const ShuffleIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M16 4.5h4v4h-1.5V6.56L13.06 12l-1.06-1.06L17.44 5.5H16v-1ZM4.5 5.5h2.94L13 11.06l-1.06 1.06L6.44 6.5H4.5v-1Zm14 14H16v-1h1.44l-5.44-5.44 1.06-1.06L18.5 17.44V18h.5v1.5ZM4.5 18.5h1.94L12 13l1.06 1.06L7.56 19.5H6.5v-1H4.5Z" /></svg>
);

export const RepeatIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M7 7h11v3l4-4-4-4v3H5v6h2V7Zm10 10H6v-3l-4 4 4 4v-3h12v-6h-2v4Z" /></svg>
);

export const VolumeIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12Zm2.5 0a7 7 0 0 1-4.5 6.49V16a8.5 8.5 0 0 0 0-8V6.51A7 7 0 0 1 19 12Z" /></svg>
);

export const MuteIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M3 9v6h4l5 5V4L7 9H3Zm13.59 3L19.7 8.88l-1.06-1.06L15.5 11l-3.13-3.13 1.06-1.06L18.62 10l3.13-3.13 1.06 1.06L19.7 11l3.13 3.13-1.06 1.06L18.62 12Z" /></svg>
);

export const HeartIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 21s-7-4.5-9.5-9.5C.83 7.74 3.5 4 7 4c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3.5 0 6.17 3.74 4.5 7.5C19 16.5 12 21 12 21Z" /></svg>
);

export const QueueIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M3 4h13v2H3V4Zm0 7h13v2H3v-2Zm0 7h13v2H3v-2ZM20 5v14l-7-7 7-7Z" /></svg>
);

export const ChevronLeftIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M15.5 4.5 14.44 5.56 19.88 11H4v2h15.88l-5.44 5.44 1.06 1.06L22.5 12 15.5 4.5Z" /></svg>
);

export const ChevronRightIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M8.5 19.5 9.56 18.44 4.12 13H20v-2H4.12l5.44-5.44L8.5 4.5 1.5 12l7 7.5Z" /></svg>
);

export const GroupIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3 0-9 1.5-9 4.5V21h18v-2.5c0-3-6-4.5-9-4.5Z" /></svg>
);

export const TrashIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M6 7h12v13H6V7Zm3.5-3h5l1 1.5h4V6H5v-.5h4l1-1.5Z" /></svg>
);

export const XIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M18 6.41 17 5.41 12 10.41 7 5.41 6 6.41 11 11.41 6 16.41 7 17.41 12 12.41 17 17.41 18 16.41 13 11.41 18 6.41Z" /></svg>
);

export const ArrowRightIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M14 4.5v3H4v9h10v3l7-7.5L14 4.5Z" /></svg>
);

export const GlobeIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.93 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8 8 0 0 1 18.93 8ZM12 4c.83 1.2 1.48 2.55 1.91 4h-3.82A14 14 0 0 1 12 4ZM4.26 14a8 8 0 0 1 0-4h3.38a16.7 16.7 0 0 0 0 4H4.26Zm.81 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.07 16Zm2.95-8H5.07a7.99 7.99 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.02 8ZM12 20c-.83-1.2-1.48-2.55-1.91-4h3.82A14 14 0 0 1 12 20Zm2.34-6H9.66a14 14 0 0 1 0-4h4.68a14 14 0 0 1 0 4Zm.26 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8 8 0 0 1-4.33 3.56Zm1.77-5.56a16.7 16.7 0 0 0 0-4h3.38a8 8 0 0 1 0 4h-3.38Z" /></svg>
);

export const LogoutIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M15 4.5h3v15h-3v-15ZM10 6.5v3H4v9h6v3l7-7.5L10 6.5Z" /></svg>
);

export const CrownIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M3 7.5 6 11l3-6 3 6 3-3.5h3l-2 11H5L3 7.5Zm2.5 11.5h13v1.5h-13v-1.5Z" />
  </svg>
);