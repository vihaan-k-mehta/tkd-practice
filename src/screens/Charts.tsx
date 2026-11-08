/** Small dependency-free SVG charts. Every chart has a text summary and a data table for screen readers. */
const W = 320, H = 150, PAD = { l: 34, r: 8, t: 10, b: 24 };
const niceMax = (v: number) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };

interface Series { label: string; value: number }

function Table({ rows, unit }: { rows: Series[]; unit: string }) {
  return (
    <details class="chart-table"><summary>Show as a table</summary>
      <table><thead><tr><th>When</th><th>{unit}</th></tr></thead><tbody>{rows.map((r) => <tr><td>{r.label}</td><td>{r.value}</td></tr>)}</tbody></table>
    </details>
  );
}

export function BarChart({ title, unit, data }: { title: string; unit: string; data: Series[] }) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const bw = iw / Math.max(1, data.length);
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <figure class="chart">
      <figcaption><b>{title}</b></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${total} ${unit} in total over ${data.length} periods.`}>
        {[0, 0.5, 1].map((f) => (<g><line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih * (1 - f)} y2={PAD.t + ih * (1 - f)} class="grid" /><text x={PAD.l - 4} y={PAD.t + ih * (1 - f) + 4} class="tick" text-anchor="end">{Number((max * f).toFixed(1))}</text></g>))}
        {data.map((d, i) => {
          const h = (d.value / max) * ih;
          return (<g>{d.value > 0 && <rect x={PAD.l + i * bw + bw * 0.15} y={PAD.t + ih - Math.max(h, 2)} width={bw * 0.7} height={Math.max(h, 2)} rx="3" class="bar" />}
            {(data.length <= 8 || i % 2 === 0) && <text x={PAD.l + i * bw + bw / 2} y={H - 6} class="tick" text-anchor="middle">{d.label}</text>}</g>);
        })}
      </svg>
      <Table rows={data} unit={unit} />
    </figure>
  );
}

export function LineChart({ title, unit, data, step = false }: { title: string; unit: string; data: Series[]; step?: boolean }) {
  if (data.length === 0) return <figure class="chart"><figcaption><b>{title}</b></figcaption><p class="sub empty-chart">Nothing to show yet.</p></figure>;
  const max = niceMax(Math.max(...data.map((d) => d.value)) * 1.05);
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih * (1 - v / max);
  let d = '';
  data.forEach((p, i) => { d += i === 0 ? `M${x(i)},${y(p.value)}` : step ? ` H${x(i)} V${y(p.value)}` : ` L${x(i)},${y(p.value)}`; });
  const last = data[data.length - 1];
  return (
    <figure class="chart">
      <figcaption><b>{title}</b></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Latest ${last.value} ${unit} on ${last.label}.`}>
        {[0, 0.5, 1].map((f) => (<g><line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih * (1 - f)} y2={PAD.t + ih * (1 - f)} class="grid" /><text x={PAD.l - 4} y={PAD.t + ih * (1 - f) + 4} class="tick" text-anchor="end">{Number((max * f).toFixed(1))}</text></g>))}
        <path d={d} class="line" fill="none" />
        {data.map((p, i) => <circle cx={x(i)} cy={y(p.value)} r="3.5" class="dot" />)}
        <text x={PAD.l} y={H - 6} class="tick">{data[0].label}</text>
        {data.length > 1 && <text x={W - PAD.r} y={H - 6} class="tick" text-anchor="end">{last.label}</text>}
      </svg>
      <Table rows={data} unit={unit} />
    </figure>
  );
}

/** Two values side by side, such as left and right kicks. */
export function SplitBar({ title, a, b }: { title: string; a: { label: string; value: number }; b: { label: string; value: number } }) {
  const total = a.value + b.value;
  const pa = total ? Math.round((a.value / total) * 100) : 50;
  return (
    <figure class="chart">
      <figcaption><b>{title}</b></figcaption>
      <div class="split" role="img" aria-label={`${a.label} ${a.value}, ${b.label} ${b.value}`}>
        <span style={{ width: `${pa}%` }} class="a">{a.value > 0 ? a.value : ''}</span><span style={{ width: `${100 - pa}%` }} class="b">{b.value > 0 ? b.value : ''}</span>
      </div>
      <p class="sub"><span class="key a" /> {a.label} {a.value} <span class="key b" style={{ marginLeft: '12px' }} /> {b.label} {b.value}</p>
    </figure>
  );
}
