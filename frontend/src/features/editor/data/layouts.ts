export interface PrintLayout {
  id: string;
  name: string;
  category: 'standard' | 'grid-a4' | 'grid-a3';
  widthMm: number;
  heightMm: number;
  columns?: number;
  rows?: number;
}

export const PRINT_LAYOUTS: PrintLayout[] = [
  { id: 'custom', name: 'Benutzerdefiniert', category: 'standard', widthMm: 100, heightMm: 50 },
  // Add other layouts if they were hardcoded in the original file,
  // but looking at imports they seem to come from '../data/printLayouts'
];
