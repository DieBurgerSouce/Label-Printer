// Print Layout Definitions for Label Templates
// All measurements in millimeters (mm)

export interface PrintLayout {
  id: string;
  name: string;
  description: string;
  category: 'standard' | 'grid-a4' | 'grid-a3';
  paperFormat: 'A4' | 'A3';
  paperWidthMm: number;
  paperHeightMm: number;
  columns: number;
  rows: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  gutterHorizontalMm: number;
  gutterVerticalMm: number;
}

// Conversion constants
export const MM_TO_PX = 3.7795275591; // 96 DPI (screen display)
export const PX_TO_MM = 1 / MM_TO_PX;

// Standard paper sizes in mm
export const PAPER_SIZES = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
};

/**
 * Calculate label dimensions from layout configuration
 */
export function calculateLabelSize(layout: PrintLayout): { widthMm: number; heightMm: number } {
  const availableWidth = layout.paperWidthMm - layout.marginLeftMm - layout.marginRightMm;
  const availableHeight = layout.paperHeightMm - layout.marginTopMm - layout.marginBottomMm;

  const totalGutterWidth = (layout.columns - 1) * layout.gutterHorizontalMm;
  const totalGutterHeight = (layout.rows - 1) * layout.gutterVerticalMm;

  const widthMm = (availableWidth - totalGutterWidth) / layout.columns;
  const heightMm = (availableHeight - totalGutterHeight) / layout.rows;

  return { widthMm, heightMm };
}

/**
 * Convert mm to px for canvas display
 */
export function mmToPx(mm: number): number {
  return Math.round(mm * MM_TO_PX);
}

/**
 * Convert px to mm
 */
export function pxToMm(px: number): number {
  return Math.round(px * PX_TO_MM * 10) / 10; // Round to 1 decimal
}

/**
 * Predefined print layouts
 */
export const PRINT_LAYOUTS: PrintLayout[] = [
  // ===== STANDARD LABELS (Avery/Herma compatible) =====
  {
    id: 'a4-24up',
    name: 'A4 - 24 Labels (70x37mm)',
    description: '3 Spalten × 8 Zeilen - Standard Adress-Etiketten',
    category: 'standard',
    paperFormat: 'A4',
    paperWidthMm: PAPER_SIZES.A4.width,
    paperHeightMm: PAPER_SIZES.A4.height,
    columns: 3,
    rows: 8,
    marginTopMm: 15,
    marginRightMm: 7,
    marginBottomMm: 15,
    marginLeftMm: 7,
    gutterHorizontalMm: 2.5,
    gutterVerticalMm: 0,
  },
  {
    id: 'a4-21up',
    name: 'A4 - 21 Labels (70x42mm)',
    description: '3 Spalten × 7 Zeilen',
    category: 'standard',
    paperFormat: 'A4',
    paperWidthMm: PAPER_SIZES.A4.width,
    paperHeightMm: PAPER_SIZES.A4.height,
    columns: 3,
    rows: 7,
    marginTopMm: 15,
    marginRightMm: 7,
    marginBottomMm: 15,
    marginLeftMm: 7,
    gutterHorizontalMm: 2.5,
    gutterVerticalMm: 0,
  },
  {
    id: 'a4-8up',
    name: 'A4 - 8 Labels (105x74mm)',
    description: '2 Spalten × 4 Zeilen',
    category: 'standard',
    paperFormat: 'A4',
    paperWidthMm: PAPER_SIZES.A4.width,
    paperHeightMm: PAPER_SIZES.A4.height,
    columns: 2,
    rows: 4,
    marginTopMm: 10,
    marginRightMm: 0,
    marginBottomMm: 10,
    marginLeftMm: 0,
    gutterHorizontalMm: 0,
    gutterVerticalMm: 0,
  },
  {
    id: 'a4-4up',
    name: 'A4 - 4 Labels (105x148mm)',
    description: '2 Spalten × 2 Zeilen - Große Etiketten',
    category: 'standard',
    paperFormat: 'A4',
    paperWidthMm: PAPER_SIZES.A4.width,
    paperHeightMm: PAPER_SIZES.A4.height,
    columns: 2,
    rows: 2,
    marginTopMm: 0,
    marginRightMm: 0,
    marginBottomMm: 0,
    marginLeftMm: 0,
    gutterHorizontalMm: 0,
    gutterVerticalMm: 0,
  },

  // ===== A4 GRID LAYOUTS =====
  {
    id: 'a4-grid-2x2',
    name: 'A4 Grid - 2×2',
    description: '4 Labels gleichmäßig verteilt',
    category: 'grid-a4',
    paperFormat: 'A4',
    paperWidthMm: PAPER_SIZES.A4.width,
    paperHeightMm: PAPER_SIZES.A4.height,
    columns: 2,
    rows: 2,
    marginTopMm: 10,
    marginRightMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 10,
    gutterHorizontalMm: 5,
    gutterVerticalMm: 5,
  },
  {
    id: 'a4-grid-2x3',
    name: 'A4 Grid - 2×3',
    description: '6 Labels gleichmäßig verteilt',
    category: 'grid-a4',
    paperFormat: 'A4',
    paperWidthMm: PAPER_SIZES.A4.width,
    paperHeightMm: PAPER_SIZES.A4.height,
    columns: 2,
    rows: 3,
    marginTopMm: 10,
    marginRightMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 10,
    gutterHorizontalMm: 5,
    gutterVerticalMm: 5,
  },
  {
    id: 'a4-grid-3x3',
    name: 'A4 Grid - 3×3',
    description: '9 Labels gleichmäßig verteilt',
    category: 'grid-a4',
    paperFormat: 'A4',
    paperWidthMm: PAPER_SIZES.A4.width,
    paperHeightMm: PAPER_SIZES.A4.height,
    columns: 3,
    rows: 3,
    marginTopMm: 10,
    marginRightMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 10,
    gutterHorizontalMm: 5,
    gutterVerticalMm: 5,
  },
  {
    id: 'a4-grid-2x4',
    name: 'A4 Grid - 2×4',
    description: '8 Labels gleichmäßig verteilt',
    category: 'grid-a4',
    paperFormat: 'A4',
    paperWidthMm: PAPER_SIZES.A4.width,
    paperHeightMm: PAPER_SIZES.A4.height,
    columns: 2,
    rows: 4,
    marginTopMm: 10,
    marginRightMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 10,
    gutterHorizontalMm: 5,
    gutterVerticalMm: 5,
  },

  // ===== A3 GRID LAYOUTS =====
  {
    id: 'a3-grid-2x4',
    name: 'A3 Grid - 2×4',
    description: '8 Labels gleichmäßig verteilt',
    category: 'grid-a3',
    paperFormat: 'A3',
    paperWidthMm: PAPER_SIZES.A3.width,
    paperHeightMm: PAPER_SIZES.A3.height,
    columns: 2,
    rows: 4,
    marginTopMm: 15,
    marginRightMm: 15,
    marginBottomMm: 15,
    marginLeftMm: 15,
    gutterHorizontalMm: 7,
    gutterVerticalMm: 7,
  },
  {
    id: 'a3-grid-2x6',
    name: 'A3 Grid - 2×6',
    description: '12 Labels gleichmäßig verteilt',
    category: 'grid-a3',
    paperFormat: 'A3',
    paperWidthMm: PAPER_SIZES.A3.width,
    paperHeightMm: PAPER_SIZES.A3.height,
    columns: 2,
    rows: 6,
    marginTopMm: 15,
    marginRightMm: 15,
    marginBottomMm: 15,
    marginLeftMm: 15,
    gutterHorizontalMm: 7,
    gutterVerticalMm: 7,
  },
  {
    id: 'a3-grid-3x4',
    name: 'A3 Grid - 3×4',
    description: '12 Labels gleichmäßig verteilt',
    category: 'grid-a3',
    paperFormat: 'A3',
    paperWidthMm: PAPER_SIZES.A3.width,
    paperHeightMm: PAPER_SIZES.A3.height,
    columns: 3,
    rows: 4,
    marginTopMm: 15,
    marginRightMm: 15,
    marginBottomMm: 15,
    marginLeftMm: 15,
    gutterHorizontalMm: 7,
    gutterVerticalMm: 7,
  },
  {
    id: 'a3-grid-3x6',
    name: 'A3 Grid - 3×6',
    description: '18 Labels gleichmäßig verteilt',
    category: 'grid-a3',
    paperFormat: 'A3',
    paperWidthMm: PAPER_SIZES.A3.width,
    paperHeightMm: PAPER_SIZES.A3.height,
    columns: 3,
    rows: 6,
    marginTopMm: 15,
    marginRightMm: 15,
    marginBottomMm: 15,
    marginLeftMm: 15,
    gutterHorizontalMm: 7,
    gutterVerticalMm: 7,
  },
];

/**
 * Get layout by ID
 */
export function getLayoutById(id: string): PrintLayout | undefined {
  return PRINT_LAYOUTS.find((layout) => layout.id === id);
}

/**
 * Get layouts by category
 */
export function getLayoutsByCategory(category: string): PrintLayout[] {
  return PRINT_LAYOUTS.filter((layout) => layout.category === category);
}
