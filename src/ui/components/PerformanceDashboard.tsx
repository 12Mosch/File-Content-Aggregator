import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import PerformanceChart from "./PerformanceChart";
import { ProfileSummary, PerformanceMetrics } from "@/lib/utils/Profiler";

interface PerformanceDashboardProps {
  isProfilingEnabled: boolean;
  isDetailedMemoryTrackingEnabled: boolean;
  onToggleProfiling: (enabled: boolean) => void;
  onToggleMemoryTracking: (enabled: boolean) => void;
  onSaveReport: () => void;
  onClearData: () => void;
  performanceSummary: ProfileSummary | null;
  metricsHistory: PerformanceMetrics[];
  lastUpdated: Date | null;
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  isProfilingEnabled,
  isDetailedMemoryTrackingEnabled,
  onToggleProfiling,
  onToggleMemoryTracking,
  onSaveReport,
  onClearData,
  performanceSummary,
  metricsHistory,
  lastUpdated,
}) => {
  const { t } = useTranslation(["settings", "common"]);
  const [activeTab, setActiveTab] = useState("overview");

  // Format a duration in milliseconds to a human-readable string
  const formatDuration = (ms: number): string => {
    if (ms < 1) {
      return `${(ms * 1000).toFixed(2)}μs`;
    } else if (ms < 1000) {
      return `${ms.toFixed(2)}ms`;
    } else {
      return `${(ms / 1000).toFixed(2)}s`;
    }
  };

  // Format a memory size in MB to a human-readable string
  const formatMemorySize = (mb: number): string => {
    if (Math.abs(mb) < 0.001) {
      return "0 MB";
    } else if (Math.abs(mb) < 1) {
      return `${(mb * 1024).toFixed(2)} KB`;
    } else {
      return `${mb.toFixed(2)} MB`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("settings:performanceDashboard")}
          </h2>
          <p className="text-muted-foreground">
            {t("settings:performanceDashboardDescription")}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={onSaveReport}
            disabled={!isProfilingEnabled || !performanceSummary}
          >
            {t("settings:saveReport")}
          </Button>
          <Button
            variant="outline"
            onClick={onClearData}
            disabled={!isProfilingEnabled || !performanceSummary}
          >
            {t("settings:clearData")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings:profilingSettings")}</CardTitle>
          <CardDescription>
            {t("settings:profilingSettingsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="profiling-toggle">
                {t("settings:enableProfiling")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("settings:enableProfilingDescription")}
              </p>
            </div>
            <Switch
              id="profiling-toggle"
              checked={isProfilingEnabled}
              onCheckedChange={onToggleProfiling}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="memory-tracking-toggle">
                {t("settings:enableDetailedMemoryTracking")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("settings:enableDetailedMemoryTrackingDescription")}
              </p>
            </div>
            <Switch
              id="memory-tracking-toggle"
              checked={isDetailedMemoryTrackingEnabled}
              onCheckedChange={onToggleMemoryTracking}
              disabled={!isProfilingEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {performanceSummary ? (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">
              {t("settings:performanceMetrics")}
            </h3>
            {lastUpdated && (
              <p className="text-sm text-muted-foreground">
                {t("settings:lastUpdated", {
                  time: lastUpdated.toLocaleTimeString(),
                })}
              </p>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">
                {t("settings:overview")}
              </TabsTrigger>
              <TabsTrigger value="operations">
                {t("settings:operations")}
              </TabsTrigger>
              <TabsTrigger value="memory">
                {t("settings:memory")}
              </TabsTrigger>
              <TabsTrigger value="timeline">
                {t("settings:timeline")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t("settings:totalOperations")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performanceSummary.totalOperations.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t("settings:totalDuration")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatDuration(performanceSummary.totalDuration)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t("settings:totalMemoryChange")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatMemorySize(performanceSummary.memoryUsage.total)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{t("settings:topOperations")}</CardTitle>
                  <CardDescription>
                    {t("settings:topOperationsDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PerformanceChart
                    type="bar"
                    data={{
                      labels: performanceSummary.topOperations.map(
                        (op) => op.name
                      ),
                      datasets: [
                        {
                          label: t("settings:duration"),
                          data: performanceSummary.topOperations.map(
                            (op) => op.duration
                          ),
                        },
                      ],
                    }}
                    height={300}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="operations" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t("settings:operationDetails")}</CardTitle>
                  <CardDescription>
                    {t("settings:operationDetailsDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">
                            {t("settings:operation")}
                          </th>
                          <th className="text-right py-2 px-4">
                            {t("settings:calls")}
                          </th>
                          <th className="text-right py-2 px-4">
                            {t("settings:totalTime")}
                          </th>
                          <th className="text-right py-2 px-4">
                            {t("settings:avgTime")}
                          </th>
                          <th className="text-right py-2 px-4">
                            {t("settings:percentage")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {performanceSummary.topOperations.map((op, index) => (
                          <tr
                            key={op.name}
                            className={
                              index % 2 === 0 ? "bg-muted/50" : undefined
                            }
                          >
                            <td className="py-2 px-4 text-left">{op.name}</td>
                            <td className="py-2 px-4 text-right">
                              {op.callCount.toLocaleString()}
                            </td>
                            <td className="py-2 px-4 text-right">
                              {formatDuration(op.duration)}
                            </td>
                            <td className="py-2 px-4 text-right">
                              {formatDuration(op.averageDuration)}
                            </td>
                            <td className="py-2 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Progress
                                  value={op.percentage}
                                  className="h-2 w-16"
                                />
                                <span>{op.percentage.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("settings:callCounts")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PerformanceChart
                      type="bar"
                      data={{
                        labels: performanceSummary.topOperations
                          .slice(0, 5)
                          .map((op) => op.name),
                        datasets: [
                          {
                            label: t("settings:calls"),
                            data: performanceSummary.topOperations
                              .slice(0, 5)
                              .map((op) => op.callCount),
                          },
                        ],
                      }}
                      height={250}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t("settings:averageDuration")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PerformanceChart
                      type="bar"
                      data={{
                        labels: performanceSummary.topOperations
                          .slice(0, 5)
                          .map((op) => op.name),
                        datasets: [
                          {
                            label: t("settings:avgTime"),
                            data: performanceSummary.topOperations
                              .slice(0, 5)
                              .map((op) => op.averageDuration),
                          },
                        ],
                      }}
                      height={250}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="memory" className="space-y-4 mt-4">
              {isDetailedMemoryTrackingEnabled ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("settings:memoryUsageByOperation")}</CardTitle>
                      <CardDescription>
                        {t("settings:memoryUsageByOperationDescription")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PerformanceChart
                        type="bar"
                        data={{
                          labels: Object.keys(
                            performanceSummary.memoryUsage.byOperation
                          ).slice(0, 10),
                          datasets: [
                            {
                              label: t("settings:memoryChange"),
                              data: Object.values(
                                performanceSummary.memoryUsage.byOperation
                              ).slice(0, 10),
                            },
                          ],
                        }}
                        height={300}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t("settings:memoryDetails")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-4">
                                {t("settings:operation")}
                              </th>
                              <th className="text-right py-2 px-4">
                                {t("settings:memoryChange")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(
                              performanceSummary.memoryUsage.byOperation
                            )
                              .sort(
                                (a, b) => Math.abs(b[1]) - Math.abs(a[1])
                              )
                              .map(([name, memoryDelta], index) => (
                                <tr
                                  key={name}
                                  className={
                                    index % 2 === 0 ? "bg-muted/50" : undefined
                                  }
                                >
                                  <td className="py-2 px-4 text-left">{name}</td>
                                  <td className="py-2 px-4 text-right">
                                    <Badge
                                      variant={
                                        memoryDelta > 0
                                          ? "destructive"
                                          : "secondary"
                                      }
                                    >
                                      {formatMemorySize(memoryDelta)}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("settings:memoryTrackingDisabled")}</CardTitle>
                    <CardDescription>
                      {t("settings:memoryTrackingDisabledDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => onToggleMemoryTracking(true)}
                      disabled={!isProfilingEnabled}
                    >
                      {t("settings:enableMemoryTracking")}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4 mt-4">
              {metricsHistory.length > 0 ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("settings:operationTimeline")}</CardTitle>
                      <CardDescription>
                        {t("settings:operationTimelineDescription")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PerformanceChart
                        type="line"
                        data={{
                          labels: metricsHistory
                            .slice(-50)
                            .map((m) =>
                              new Date(m.timestamp).toLocaleTimeString()
                            ),
                          datasets: [
                            {
                              label: t("settings:executionTime"),
                              data: metricsHistory
                                .slice(-50)
                                .map((m) => m.duration),
                            },
                          ],
                        }}
                        height={300}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t("settings:recentOperations")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-4">
                                {t("settings:timestamp")}
                              </th>
                              <th className="text-left py-2 px-4">
                                {t("settings:operation")}
                              </th>
                              <th className="text-right py-2 px-4">
                                {t("settings:duration")}
                              </th>
                              {isDetailedMemoryTrackingEnabled && (
                                <th className="text-right py-2 px-4">
                                  {t("settings:memoryChange")}
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {metricsHistory
                              .slice(-100)
                              .reverse()
                              .map((metric, index) => (
                                <tr
                                  key={`${metric.timestamp}-${index}`}
                                  className={
                                    index % 2 === 0 ? "bg-muted/50" : undefined
                                  }
                                >
                                  <td className="py-2 px-4 text-left">
                                    {new Date(
                                      metric.timestamp
                                    ).toLocaleTimeString()}
                                  </td>
                                  <td className="py-2 px-4 text-left">
                                    {metric.operationName}
                                  </td>
                                  <td className="py-2 px-4 text-right">
                                    {formatDuration(metric.duration)}
                                  </td>
                                  {isDetailedMemoryTrackingEnabled && (
                                    <td className="py-2 px-4 text-right">
                                      {metric.memoryDelta !== undefined ? (
                                        <Badge
                                          variant={
                                            metric.memoryDelta > 0
                                              ? "destructive"
                                              : "secondary"
                                          }
                                        >
                                          {formatMemorySize(metric.memoryDelta)}
                                        </Badge>
                                      ) : (
                                        "-"
                                      )}
                                    </td>
                                  )}
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("settings:noTimelineData")}</CardTitle>
                    <CardDescription>
                      {t("settings:noTimelineDataDescription")}
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : isProfilingEnabled ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("settings:noDataAvailable")}</CardTitle>
            <CardDescription>
              {t("settings:noDataAvailableDescription")}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("settings:profilingDisabled")}</CardTitle>
            <CardDescription>
              {t("settings:profilingDisabledDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => onToggleProfiling(true)}>
              {t("settings:enableProfiling")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PerformanceDashboard;
