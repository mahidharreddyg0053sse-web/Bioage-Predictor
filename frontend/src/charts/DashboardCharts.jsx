import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export function MiniSparkline({ data = [], dataKey = 'total', color = '#2563EB' }) {
  const chartData =
    data.length > 0
      ? data
      : [
          { label: '1', v: 2 },
          { label: '2', v: 3 },
          { label: '3', v: 2 },
          { label: '4', v: 4 },
        ];
  const key = data.length > 0 ? dataKey : 'v';
  const gradId = `spark-${dataKey}-${color.replace('#', '')}`;

  return (
    <div className="h-10 w-28 sm:w-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={key}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ThreatOverviewDonut({ data = [], totalScans = 0 }) {
  const hasData = data.some((d) => d.value > 0);
  const displayData = hasData
    ? data
    : [{ name: 'No Scans', value: 1, percentage: 100, color: '#E2E8F0' }];

  const formattedTotal =
    totalScans >= 1000 ? `${(totalScans / 1000).toFixed(1)}K` : String(totalScans);

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="relative w-40 h-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={displayData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={hasData ? 2 : 0}
              stroke="#FFFFFF"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {displayData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            {hasData && (
              <Tooltip
                formatter={(val, name) => [`${val} URLs`, name]}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderRadius: '10px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-slate-900 leading-tight">
            {formattedTotal}
          </span>
          <span className="text-[11px] font-medium text-slate-500">Total Scans</span>
        </div>
      </div>

      <div className="flex-1 space-y-2.5">
        {data.map((item) => (
          <div key={item.name} className="flex items-start gap-2.5">
            <span
              className="w-3 h-3 rounded-full mt-1 shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="leading-tight">
              <p className="text-[13px] font-semibold text-slate-800">{item.name}</p>
              <p className="text-xs text-slate-500">
                ({item.percentage}%) · {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RiskTrendAreaChart({ data = [] }) {
  return (
    <div className="h-[188px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="riskTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1877F2" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#1877F2" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#64748B' }}
            dy={6}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#64748B' }}
          />
          <Tooltip
            formatter={(value) => [`${value} / 100`, 'Avg Risk Score']}
            contentStyle={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E2E8F0',
              borderRadius: '10px',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
            }}
          />
          <Area
            type="monotone"
            dataKey="avg_risk"
            stroke="#1877F2"
            strokeWidth={2.5}
            fill="url(#riskTrendFill)"
            dot={{ r: 4, fill: '#1877F2', stroke: '#FFFFFF', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#1877F2', stroke: '#DBEAFE', strokeWidth: 3 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
