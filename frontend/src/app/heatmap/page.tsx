"use client";
import { useEffect, useState } from "react";
import { api, AuditEvent } from "@/lib/api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

interface DayData { date: string; count: number; }

export default function HeatmapPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);

  useEffect(() => {
    api.getEvents(500).then(e => { setEvents(e); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  // Build 52-week grid
  const today = new Date();
  const weeks: DayData[][] = [];
  const dayCounts: Record<string, number> = {};

  events.forEach(e => {
    const d = new Date(e.timestamp).toISOString().split("T")[0];
    dayCounts[d] = (dayCounts[d] || 0) + 1;
  });

  // Generate 52 weeks of days
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);
  // Align to Monday
  while (startDate.getDay() !== 1) startDate.setDate(startDate.getDate() - 1);

  let currentWeek: DayData[] = [];
  const d = new Date(startDate);
  while (d <= today) {
    const dateStr = d.toISOString().split("T")[0];
    currentWeek.push({ date: dateStr, count: dayCounts[dateStr] || 0 });
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    d.setDate(d.getDate() + 1);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const maxCount = Math.max(...Object.values(dayCounts), 1);
  const totalEvents = events.length;
  const activeDays = Object.keys(dayCounts).length;
  const avgPerDay = activeDays > 0 ? Math.round(totalEvents / activeDays) : 0;
  const bestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];

  const getColor = (count: number) => {
    if (count === 0) return "rgba(255,255,255,0.04)";
    const intensity = count / maxCount;
    if (intensity > 0.75) return "#10b981";
    if (intensity > 0.5) return "#34d399";
    if (intensity > 0.25) return "#6ee7b7";
    return "#a7f3d0";
  };

  // Month labels
  const monthLabels: { month: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const m = new Date(week[0].date).getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ month: MONTHS[m], col: i });
      lastMonth = m;
    }
  });

  if (loading) return <div className="hm-page"><div className="lb-header"><h1 className="lb-title">Activity Heatmap</h1><p className="lb-subtitle">Loading...</p></div></div>;

  return (
    <div className="hm-page">
      <div className="lb-header">
        <h1 className="lb-title">📅 Activity Heatmap</h1>
        <p className="lb-subtitle">Agent activity patterns over the last year</p>
      </div>

      {/* Stats */}
      <div className="an-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="an-kpi green">
          <div className="an-kpi-icon">📊</div>
          <div className="an-kpi-data"><div className="an-kpi-value">{totalEvents.toLocaleString("en-US")}</div><div className="an-kpi-label">Events Tracked</div></div>
        </div>
        <div className="an-kpi blue">
          <div className="an-kpi-icon">📅</div>
          <div className="an-kpi-data"><div className="an-kpi-value">{activeDays}</div><div className="an-kpi-label">Active Days</div></div>
        </div>
        <div className="an-kpi purple">
          <div className="an-kpi-icon">📈</div>
          <div className="an-kpi-data"><div className="an-kpi-value">{avgPerDay}</div><div className="an-kpi-label">Avg / Day</div></div>
        </div>
        <div className="an-kpi yellow">
          <div className="an-kpi-icon">🔥</div>
          <div className="an-kpi-data"><div className="an-kpi-value">{bestDay ? bestDay[1] : 0}</div><div className="an-kpi-label">Best Day</div></div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="hm-card">
        <div className="hm-tooltip-area">
          {hoveredDay && (
            <div className="hm-tooltip">
              <strong>{hoveredDay.count} events</strong> on {hoveredDay.date}
            </div>
          )}
        </div>
        <div className="hm-container">
          {/* Day labels */}
          <div className="hm-day-labels">
            {DAYS.map((d, i) => <div key={i} className="hm-day-label">{d}</div>)}
          </div>
          <div className="hm-grid-wrap">
            {/* Month labels */}
            <div className="hm-month-row">
              {monthLabels.map((m, i) => (
                <div key={i} className="hm-month-label" style={{ gridColumn: m.col + 1 }}>{m.month}</div>
              ))}
            </div>
            {/* Grid */}
            <div className="hm-grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
              {weeks.map((week, wi) => (
                <div key={wi} className="hm-week">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className="hm-cell"
                      style={{ background: getColor(day.count) }}
                      title={`${day.count} events on ${day.date}`}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Legend */}
        <div className="hm-legend">
          <span className="hm-legend-label">Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
            <div key={i} className="hm-cell" style={{ background: getColor(v * maxCount), width: 12, height: 12 }} />
          ))}
          <span className="hm-legend-label">More</span>
        </div>
      </div>
    </div>
  );
}
