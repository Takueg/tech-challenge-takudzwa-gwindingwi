import type { PieSlice } from "@/lib/charts";

const TONES = ["var(--ocean-blue)", "var(--light-blue)", "var(--vivid-blue)"];
const R = 145;
const CX = 155;
const CY = 150;

export function HalfPieChart({ data }: { data: PieSlice[] }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const percent = (value: number) => Math.round((value / total) * 100);

  let start = Math.PI;
  const slices = data.map((slice, index) => {
    const end = start + (Math.PI * slice.value) / total;
    const mid = (start + end) / 2;
    const path =
      `M${CX} ${CY}L${(CX + R * Math.cos(start)).toFixed(2)} ${(CY + R * Math.sin(start)).toFixed(2)}` +
      `A${R} ${R} 0 0 1 ${(CX + R * Math.cos(end)).toFixed(2)} ${(CY + R * Math.sin(end)).toFixed(2)}Z`;
    start = end;
    return { ...slice, path, mid, tone: TONES[index % TONES.length] };
  });

  return (
    <figure className="swl-pie">
      <svg
        viewBox="0 0 310 152"
        role="img"
        aria-label={`Spending by category: ${data.map((d) => `${d.label} ${percent(d.value)}%`).join(", ")}`}
      >
        {slices.map((slice) => (
          <path key={slice.label} d={slice.path} fill={slice.tone} className="swl-pie__slice" />
        ))}
        {slices
          .filter((slice) => slice.value / total >= 0.2)
          .map((slice) => (
            <text
              key={slice.label}
              x={(CX + R * 0.62 * Math.cos(slice.mid)).toFixed(1)}
              y={(CY + R * 0.62 * Math.sin(slice.mid) + 7).toFixed(1)}
              textAnchor="middle"
              className="swl-pie__pct"
            >
              {percent(slice.value)}%
            </text>
          ))}
      </svg>
      <figcaption className="swl-pie__legend">
        {slices.map((slice) => (
          <span key={slice.label} className="swl-pie__key">
            <i style={{ background: slice.tone }} />
            {slice.label}
            <b>{percent(slice.value)}%</b>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
