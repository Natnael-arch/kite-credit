import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    const date = new Date(label).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return (
      <div className="glass-card p-3 text-sm z-50">
        <p className="text-muted-foreground mb-1">{date}</p>
        <p className="font-bold text-primary">${(payload[0].value).toFixed(2)} PYUSD</p>
      </div>
    );
  }
  return null;
};

export function TVLChart({ currentTvl = 0 }: { currentTvl?: number }) {
  const [data, setData] = useState<Array<{ timestamp: number, tvl: number }>>([]);
  const [deploymentDate, setDeploymentDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.getPoolHistory().then(res => {
      if (mounted) {
        setData(res.data);
        setDeploymentDate(res.deploymentDate);
        setIsLoading(false);
      }
    }).catch(err => {
      console.error("Failed to load pool history:", err);
      if (mounted) setIsLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const chartData = [...data];
  
  // Append the current live TVL point if we have data to anchor it
  if (chartData.length > 0 && currentTvl > 0) {
    chartData.push({
      timestamp: Date.now(),
      tvl: currentTvl
    });
  }

  // Calculate dynamic label
  let dateLabel = "Loading...";
  if (!isLoading) {
    if (deploymentDate) {
      const d = new Date(deploymentDate);
      dateLabel = `Since ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    } else {
      dateLabel = "Recent History";
    }
  }

  const isSparse = chartData.length < 5;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Total Value Locked</h2>
        <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-md">{dateLabel}</span>
      </div>
      
      {isLoading ? (
        <div className="w-full h-[250px] flex items-center justify-center text-muted-foreground animate-pulse">
          Loading on-chain history...
        </div>
      ) : chartData.length === 0 ? (
        <div className="w-full h-[250px] flex items-center justify-center text-muted-foreground">
          No history available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(185, 70%, 45%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(185, 70%, 45%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="timestamp" 
              stroke="hsl(220, 10%, 35%)" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(ts) => {
                const d = new Date(ts);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
              type="number"
              domain={['dataMin', 'dataMax']}
            />
            <YAxis
              stroke="hsl(220, 10%, 35%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type={isSparse ? "linear" : "monotone"}
              dataKey="tvl"
              stroke="hsl(185, 70%, 45%)"
              strokeWidth={2}
              fill="url(#tvlGradient)"
              activeDot={{ r: 6, fill: "hsl(185, 70%, 45%)", stroke: "#fff", strokeWidth: 2 }}
              dot={isSparse ? { r: 4, fill: "hsl(185, 70%, 45%)", strokeWidth: 0 } : false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </>
  );
}
