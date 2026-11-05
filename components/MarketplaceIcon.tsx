const paths: Record<string, string> = {
  menu: "M4 6h16M4 12h16M4 18h16", close: "m6 6 12 12M6 18 18 6",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  grid: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
  snow: "M12 2v20M3.34 7l17.32 10M3.34 17 20.66 7M9 4l3 3 3-3M9 20l3-3 3 3",
  scissors: "m8 8 12 12M8 16 20 4M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  tool: "m14 4 6 6M4 20l-1-3L16 4l4 4L7 21ZM14 4l2-2 6 6-2 2",
  sparkles: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3ZM20 2v4M18 4h4",
  monitor: "M3 3h18v13H3ZM8 21h8M12 16v5",
  home: "m2 11 10-9 10 9M5 9v12h14V9M10 21v-8h4v8",
  car: "m4 9 2-6h12l2 6M3 9h18v10H3ZM5 19v3M19 19v3M6 13h2M16 13h2",
  arrow: "M4 12h16m-6-6 6 6-6 6", user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 22v-3a8 8 0 0 1 16 0v3",
  info: "M12 11v6M12 7v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  contact: "M3 5h18v14H3ZM3 5l9 8 9-8", star: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z",
};
export default function MarketplaceIcon({ name, className }: { name: string; className?: string }) {
  return <svg className={className} aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] ?? paths.grid} /></svg>;
}
