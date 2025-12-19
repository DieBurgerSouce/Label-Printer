/**
 * Ruler Component for Canvas
 * Shows horizontal and vertical rulers with measurements
 */
interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  length: number;
  unit?: 'mm' | 'cm' | 'in';
  zoom?: number;
}

export const Ruler = ({ orientation, length, unit = 'mm', zoom = 1 }: RulerProps) => {
  const generateTicks = () => {
    const ticks = [];
    const majorTickInterval = unit === 'mm' ? 10 : unit === 'cm' ? 1 : 0.5;
    const minorTickInterval = unit === 'mm' ? 5 : unit === 'cm' ? 0.5 : 0.125;

    for (let i = 0; i <= length; i += minorTickInterval) {
      const isMajor = i % majorTickInterval === 0;
      const tickLength = isMajor ? 12 : 6;
      const showLabel = isMajor;

      ticks.push({
        position: i * zoom,
        length: tickLength,
        label: showLabel ? i.toString() : null,
        isMajor,
      });
    }

    return ticks;
  };

  const ticks = generateTicks();

  if (orientation === 'horizontal') {
    return (
      <div className="relative h-6 bg-gray-100 border-b border-gray-300">
        <svg className="w-full h-full">
          {ticks.map((tick, index) => (
            <g key={index}>
              <line
                x1={tick.position}
                y1={24 - tick.length}
                x2={tick.position}
                y2={24}
                stroke="#666"
                strokeWidth={tick.isMajor ? 1.5 : 1}
              />
              {tick.label && (
                <text x={tick.position} y={10} fontSize="9" textAnchor="middle" fill="#666">
                  {tick.label}
                </text>
              )}
            </g>
          ))}
        </svg>
        <div className="absolute top-1 right-2 text-xs text-gray-600 font-medium">{unit}</div>
      </div>
    );
  }

  return (
    <div className="relative w-6 bg-gray-100 border-r border-gray-300">
      <svg className="w-full h-full">
        {ticks.map((tick, index) => (
          <g key={index}>
            <line
              x1={24 - tick.length}
              y1={tick.position}
              x2={24}
              y2={tick.position}
              stroke="#666"
              strokeWidth={tick.isMajor ? 1.5 : 1}
            />
            {tick.label && (
              <text
                x={12}
                y={tick.position + 3}
                fontSize="9"
                textAnchor="middle"
                fill="#666"
                transform={`rotate(-90, 12, ${tick.position})`}
              >
                {tick.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
