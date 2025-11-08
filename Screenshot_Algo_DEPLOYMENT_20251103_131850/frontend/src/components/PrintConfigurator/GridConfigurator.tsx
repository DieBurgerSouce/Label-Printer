import { Grid3x3, Move, Maximize } from 'lucide-react';

interface GridConfig {
  columns: number;
  rows: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  spacing: number;
}

interface GridConfiguratorProps {
  config: GridConfig;
  onConfigChange: (config: Partial<GridConfig>) => void;
  maxLabelsPerPage?: number;
}

export default function GridConfigurator({
  config,
  onConfigChange,
  maxLabelsPerPage = 50,
}: GridConfiguratorProps) {
  const labelsPerPage = config.columns * config.rows;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Grid3x3 className="w-5 h-5" />
          Grid Layout
        </h3>

        {/* Grid Size */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Columns
            </label>
            <input
              type="number"
              value={config.columns}
              onChange={(e) =>
                onConfigChange({ columns: Math.max(1, Number(e.target.value)) })
              }
              className="input w-full"
              min="1"
              max="10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rows
            </label>
            <input
              type="number"
              value={config.rows}
              onChange={(e) =>
                onConfigChange({ rows: Math.max(1, Number(e.target.value)) })
              }
              className="input w-full"
              min="1"
              max="20"
            />
          </div>
        </div>

        {/* Labels Per Page Info */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>{labelsPerPage}</strong> labels per page
            {labelsPerPage > maxLabelsPerPage && (
              <span className="text-red-600 ml-2">
                (exceeds maximum of {maxLabelsPerPage})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Margins */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Move className="w-4 h-4" />
          Margins (mm)
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Top
            </label>
            <input
              type="number"
              value={config.marginTop}
              onChange={(e) =>
                onConfigChange({ marginTop: Math.max(0, Number(e.target.value)) })
              }
              className="input w-full"
              min="0"
              max="50"
              step="0.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bottom
            </label>
            <input
              type="number"
              value={config.marginBottom}
              onChange={(e) =>
                onConfigChange({ marginBottom: Math.max(0, Number(e.target.value)) })
              }
              className="input w-full"
              min="0"
              max="50"
              step="0.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Left
            </label>
            <input
              type="number"
              value={config.marginLeft}
              onChange={(e) =>
                onConfigChange({ marginLeft: Math.max(0, Number(e.target.value)) })
              }
              className="input w-full"
              min="0"
              max="50"
              step="0.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Right
            </label>
            <input
              type="number"
              value={config.marginRight}
              onChange={(e) =>
                onConfigChange({ marginRight: Math.max(0, Number(e.target.value)) })
              }
              className="input w-full"
              min="0"
              max="50"
              step="0.5"
            />
          </div>
        </div>
      </div>

      {/* Spacing */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Maximize className="w-4 h-4" />
          Label Spacing
        </h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Spacing between labels (mm)
          </label>
          <input
            type="number"
            value={config.spacing}
            onChange={(e) =>
              onConfigChange({ spacing: Math.max(0, Number(e.target.value)) })
            }
            className="input w-full"
            min="0"
            max="20"
            step="0.5"
          />
          <p className="text-xs text-gray-500 mt-1">
            Space between individual labels in the grid
          </p>
        </div>
      </div>

      {/* Quick Presets */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Presets</h4>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() =>
              onConfigChange({
                columns: 3,
                rows: 4,
                marginTop: 10,
                marginBottom: 10,
                marginLeft: 10,
                marginRight: 10,
                spacing: 5,
              })
            }
            className="btn-secondary text-sm"
          >
            3×4 Grid
          </button>
          <button
            onClick={() =>
              onConfigChange({
                columns: 4,
                rows: 5,
                marginTop: 8,
                marginBottom: 8,
                marginLeft: 8,
                marginRight: 8,
                spacing: 3,
              })
            }
            className="btn-secondary text-sm"
          >
            4×5 Grid
          </button>
          <button
            onClick={() =>
              onConfigChange({
                columns: 2,
                rows: 3,
                marginTop: 15,
                marginBottom: 15,
                marginLeft: 15,
                marginRight: 15,
                spacing: 8,
              })
            }
            className="btn-secondary text-sm"
          >
            2×3 Large
          </button>
        </div>
      </div>
    </div>
  );
}
