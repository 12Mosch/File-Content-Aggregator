import React from "react";
import { useTranslation } from "react-i18next";
import { CacheMetricsHistory } from "../../lib/CacheManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, LineChart, PieChart } from "lucide-react";

interface CacheMetricsChartProps {
  metrics: CacheMetricsHistory[];
  title?: string;
  description?: string;
}

export function CacheMetricsChart({ metrics, title, description }: CacheMetricsChartProps) {
  const { t } = useTranslation(["cache", "common"]);
  const [chartType, setChartType] = React.useState<string>("line");

  // If no metrics, show placeholder
  if (!metrics || metrics.length === 0) {
    return (
      <div className="h-[200px] w-full bg-muted/20 rounded-md flex items-center justify-center">
        <span className="text-sm text-muted-foreground">
          {t("cache:noMetricsHistory")}
        </span>
      </div>
    );
  }

  // Get the last 10 metrics for display
  const recentMetrics = metrics.slice(-10);

  // Format timestamp for display
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        {title && <CardTitle>{title}</CardTitle>}
        {description && <CardDescription>{description}</CardDescription>}
        <Tabs value={chartType} onValueChange={setChartType} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="line">
              <LineChart className="h-4 w-4 mr-2" />
              {t("cache:lineChart")}
            </TabsTrigger>
            <TabsTrigger value="bar">
              <BarChart className="h-4 w-4 mr-2" />
              {t("cache:barChart")}
            </TabsTrigger>
            <TabsTrigger value="pie">
              <PieChart className="h-4 w-4 mr-2" />
              {t("cache:pieChart")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <TabsContent value="line" className="mt-0">
          <div className="h-[200px] w-full bg-muted/20 rounded-md flex items-center justify-center">
            <div className="w-full h-full p-4">
              {/* Line chart visualization placeholder */}
              <div className="relative h-full w-full">
                {/* X-axis labels */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground">
                  {recentMetrics.map((metric, i) => (
                    <div key={i} className="text-center">
                      {formatTime(metric.timestamp)}
                    </div>
                  ))}
                </div>
                
                {/* Y-axis - Hit Rate */}
                <div className="absolute top-0 bottom-8 left-0 w-8 flex flex-col justify-between text-xs text-muted-foreground">
                  <div>100%</div>
                  <div>75%</div>
                  <div>50%</div>
                  <div>25%</div>
                  <div>0%</div>
                </div>
                
                {/* Chart area */}
                <div className="absolute top-0 right-0 bottom-8 left-8 bg-muted/10 rounded border border-muted">
                  {/* Hit rate line */}
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline
                      points={recentMetrics
                        .map((metric, i) => `${(i / (recentMetrics.length - 1)) * 100},${100 - metric.hitRate * 100}`)
                        .join(" ")}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="bar" className="mt-0">
          <div className="h-[200px] w-full bg-muted/20 rounded-md flex items-center justify-center">
            <div className="w-full h-full p-4">
              {/* Bar chart visualization placeholder */}
              <div className="relative h-full w-full">
                {/* X-axis labels */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground">
                  {recentMetrics.map((metric, i) => (
                    <div key={i} className="text-center">
                      {formatTime(metric.timestamp)}
                    </div>
                  ))}
                </div>
                
                {/* Chart area */}
                <div className="absolute top-0 right-0 bottom-8 left-8 flex items-end justify-between">
                  {recentMetrics.map((metric, i) => (
                    <div 
                      key={i} 
                      className="bg-primary/80 w-6 rounded-t"
                      style={{ height: `${metric.hitRate * 100}%` }}
                      title={`Hit Rate: ${(metric.hitRate * 100).toFixed(1)}%`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="pie" className="mt-0">
          <div className="h-[200px] w-full bg-muted/20 rounded-md flex items-center justify-center">
            <div className="w-full h-full p-4 flex items-center justify-center">
              {/* Pie chart visualization placeholder */}
              <div className="relative h-32 w-32">
                <svg viewBox="0 0 100 100">
                  {/* Hit rate segment */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="hsl(var(--primary))"
                    strokeWidth="20"
                    strokeDasharray={`${metrics[metrics.length - 1].hitRate * 251.2} 251.2`}
                    transform="rotate(-90 50 50)"
                  />
                  {/* Miss rate segment */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="hsl(var(--muted))"
                    strokeWidth="20"
                    strokeDasharray={`${(1 - metrics[metrics.length - 1].hitRate) * 251.2} 251.2`}
                    strokeDashoffset={`-${metrics[metrics.length - 1].hitRate * 251.2}`}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <div className="text-2xl font-bold">
                    {(metrics[metrics.length - 1].hitRate * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("cache:hitRate")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <div className="text-sm mt-4">
          <div className="font-medium mb-2">{t("cache:recentMetrics")}</div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {recentMetrics.slice().reverse().map((metric, index) => (
              <div
                key={index}
                className="flex justify-between p-2 bg-muted/20 rounded-md"
              >
                <span>{formatTime(metric.timestamp)}</span>
                <span>
                  {t("cache:hitRate")}: {(metric.hitRate * 100).toFixed(1)}%
                </span>
                <span>
                  {t("cache:size")}: {metric.size}/{metric.capacity}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
