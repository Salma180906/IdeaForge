import { useMemo } from 'react';
import { heatVar } from '../utils';

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Twelve weeks of your work as a grid. Colder cells are quiet days, white-hot cells are busy ones.
export default function ActivityGrid({ calendar }) {
  const { weeks, total, streak, best } = useMemo(() => {
    const byDay = Object.fromEntries(calendar.map((c) => [c.day, c.n]));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - 83);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday
    const cols = [];
    for (let d = new Date(start); d <= today; ) {
      const col = [];
      for (let i = 0; i < 7; i += 1) {
        col.push(d <= today ? { day: key(d), n: byDay[key(d)] || 0, date: new Date(d) } : null);
        d.setDate(d.getDate() + 1);
      }
      cols.push(col);
    }
    let run = 0;
    const probe = new Date(today);
    if (!byDay[key(probe)]) probe.setDate(probe.getDate() - 1); // today may not be done yet
    while (byDay[key(probe)]) { run += 1; probe.setDate(probe.getDate() - 1); }
    const sum = calendar.reduce((a, c) => a + c.n, 0);
    return { weeks: cols, total: sum, streak: run, best: Math.max(0, ...calendar.map((c) => c.n)) };
  }, [calendar]);

  const level = (n) => (n === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((n / Math.max(best, 1)) * 4))));
  const months = weeks.map((col, i) => {
    const first = col.find(Boolean);
    return first && first.date.getDate() <= 7 ? first.date.toLocaleString('en', { month: 'short' }) : (i === 0 ? first?.date.toLocaleString('en', { month: 'short' }) : '');
  });

  return (
    <div className="agrid">
      <div className="agrid-top">
        <div><b>{total}</b><span>actions in 12 weeks</span></div>
        <div><b>{streak}</b><span>day streak</span></div>
        <div className="agrid-legend" aria-hidden="true"><span>Quiet</span>{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ background: heatVar(i) }} />)}<span>Busy</span></div>
      </div>
      <div className="agrid-scroll">
        <div className="agrid-months" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }} aria-hidden="true">{months.map((m, i) => <span key={i}>{m}</span>)}</div>
        <div className="agrid-body" role="img" aria-label={`${total} actions in the last 12 weeks, current streak ${streak} days`} style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
          {weeks.map((col, ci) => (
            <div className="agrid-col" key={ci}>
              {col.map((c, ri) => c ? (
                <i key={ri} className={c.n ? 'on' : ''} style={{ '--i': ci + ri, ...(c.n ? { background: heatVar(Math.max(0, level(c.n))) } : {}) }}
                  title={`${c.n} ${c.n === 1 ? 'action' : 'actions'} on ${c.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`} />
              ) : <i key={ri} className="blank" />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
