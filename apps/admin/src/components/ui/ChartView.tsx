interface ChartViewProps {
  type: 'line' | 'bar';
  title: string;
  data: { label: string; value: number }[];
}

export default function ChartView({ type, title, data }: ChartViewProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const chartHeight = 120;
  const chartWidth = 320;
  const padding = 20;

  return (
    <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col flex-1">
      <h3 className="text-sm font-bold text-stone-800 mb-4">{title}</h3>

      <div className="relative w-full aspect-[16/9] flex-1 min-h-[160px]">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-full overflow-visible"
        >
          {/* Horizontal Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = padding + (1 - pct) * (chartHeight - 2 * padding);
            return (
              <g key={idx}>
                <line
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke="#e7e5e4"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                <text
                  x={padding - 5}
                  y={y + 3}
                  textAnchor="end"
                  fill="#78716c"
                  fontSize="7"
                  fontWeight="bold"
                >
                  {Math.round(pct * maxValue)}
                </text>
              </g>
            );
          })}

          {/* Render Line Chart */}
          {type === 'line' && (
            <>
              {/* Fill Area */}
              <path
                d={`
                  M ${padding} ${chartHeight - padding}
                  ${data.map((d, i) => {
                    const x = padding + (i / (data.length - 1)) * (chartWidth - 2 * padding);
                    const y = padding + (1 - d.value / maxValue) * (chartHeight - 2 * padding);
                    return `L ${x} ${y}`;
                  }).join(' ')}
                  L ${chartWidth - padding} ${chartHeight - padding} Z
                `}
                fill="rgba(6, 78, 59, 0.05)"
              />

              {/* Area stroke polyline */}
              <polyline
                fill="none"
                stroke="#064e3b"
                strokeWidth="2"
                points={data.map((d, i) => {
                  const x = padding + (i / (data.length - 1)) * (chartWidth - 2 * padding);
                  const y = padding + (1 - d.value / maxValue) * (chartHeight - 2 * padding);
                  return `${x},${y}`;
                }).join(' ')}
              />

              {/* Data points */}
              {data.map((d, i) => {
                const x = padding + (i / (data.length - 1)) * (chartWidth - 2 * padding);
                const y = padding + (1 - d.value / maxValue) * (chartHeight - 2 * padding);
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="3"
                    fill="#C59B27"
                    stroke="#fff"
                    strokeWidth="1"
                    className="hover:scale-125 transition-transform cursor-pointer"
                  />
                );
              })}
            </>
          )}

          {/* Render Bar Chart */}
          {type === 'bar' && (
            <g>
              {data.map((d, i) => {
                const barWidth = 14;
                const x = padding + (i / (data.length - 1)) * (chartWidth - 2 * padding) - barWidth / 2;
                const y = padding + (1 - d.value / maxValue) * (chartHeight - 2 * padding);
                const height = chartHeight - padding - y;
                return (
                  <rect
                    key={i}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(height, 2)}
                    fill="#064e3b"
                    rx="2"
                    className="hover:fill-[#C59B27] transition-colors cursor-pointer"
                  />
                );
              })}
            </g>
          )}

          {/* X Axis Labels */}
          {data.map((d, i) => {
            const x = padding + (i / (data.length - 1)) * (chartWidth - 2 * padding);
            return (
              <text
                key={i}
                x={x}
                y={chartHeight - padding + 12}
                textAnchor="middle"
                fill="#78716c"
                fontSize="7"
                fontWeight="bold"
              >
                {d.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
