import React, { useRef, useEffect, useCallback } from "react";

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
  }>;
}

interface PerformanceChartProps {
  type: "bar" | "line" | "pie" | "doughnut";
  data: ChartData;
  height?: number;
  width?: number | string;
  options?: Record<string, unknown>;
}

/**
 * A simple chart component that renders charts using HTML Canvas
 *
 * This component supports high-DPI displays and theme colors.
 * It provides basic chart rendering capabilities for performance metrics.
 */
const PerformanceChart: React.FC<PerformanceChartProps> = ({
  type,
  data,
  height = 200,
  width,
  options = {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Get theme colors from CSS variables
  const getThemeColors = useCallback((count: number): string[] => {
    // Use the chart colors defined in CSS variables
    // Colors will automatically adapt to theme via CSS variables
    const chartColors = [
      getComputedStyle(document.documentElement)
        .getPropertyValue("--chart-1")
        .trim() || "oklch(0.488 0.243 264.376)",
      getComputedStyle(document.documentElement)
        .getPropertyValue("--chart-2")
        .trim() || "oklch(0.696 0.17 162.48)",
      getComputedStyle(document.documentElement)
        .getPropertyValue("--chart-3")
        .trim() || "oklch(0.769 0.188 70.08)",
      getComputedStyle(document.documentElement)
        .getPropertyValue("--chart-4")
        .trim() || "oklch(0.627 0.265 303.9)",
      getComputedStyle(document.documentElement)
        .getPropertyValue("--chart-5")
        .trim() || "oklch(0.645 0.246 16.439)",
      // Fallback colors with violet as primary
      "oklch(0.606 0.25 292.717)", // Primary (violet)
      "oklch(0.541 0.281 293.009)", // Dark primary (violet)
      "oklch(0.398 0.07 227.392)", // Blue
      "oklch(0.646 0.222 41.116)", // Orange
      "oklch(0.6 0.118 184.704)", // Teal
    ];

    // Convert to rgba with opacity
    const rgbaColors = chartColors.map((color) => {
      // For simplicity, we'll just add opacity to the existing colors
      // In a real app, you might want to properly convert oklch to rgba
      return color.startsWith("oklch")
        ? `${color.replace(")", " / 0.7)")}`
        : `${color.split(")")[0]}, 0.7)`;
    });

    return Array(count)
      .fill(0)
      .map((_, i) => rgbaColors[i % rgbaColors.length]);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set up high-DPI canvas
    const setupHiDPICanvas = (canvas: HTMLCanvasElement) => {
      // Get the device pixel ratio
      const dpr = window.devicePixelRatio || 1;

      // Get the canvas size from styles
      const rect = canvas.getBoundingClientRect();

      // Set the canvas dimensions accounting for device pixel ratio
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Scale the context to ensure correct drawing operations
      ctx.scale(dpr, dpr);

      // Set the CSS size of the canvas
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      return { width: rect.width, height: rect.height };
    };

    // Set up the canvas for high-DPI display
    const { width: displayWidth, height: displayHeight } =
      setupHiDPICanvas(canvas);

    // Clear canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Draw a bar chart
    const drawBarChart = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number
    ) => {
      const { labels, datasets } = data;
      const barCount = labels.length;
      const datasetCount = datasets.length;

      if (barCount === 0 || datasetCount === 0) return;

      // Calculate dimensions
      const padding = 40;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;
      const barWidth = chartWidth / barCount / (datasetCount + 0.5);

      // Find the maximum value for scaling
      const maxValue = Math.max(
        0.1, // Prevent division by zero
        ...datasets.flatMap((dataset) => dataset.data)
      );

      // Draw axes
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, height - padding);
      ctx.lineTo(width - padding, height - padding);
      ctx.strokeStyle = "#ccc";
      ctx.stroke();

      // Draw bars
      datasets.forEach((dataset, datasetIndex) => {
        const colors =
          dataset.backgroundColor instanceof Array
            ? dataset.backgroundColor
            : getThemeColors(barCount);

        dataset.data.forEach((value, index) => {
          const x =
            padding +
            index * (chartWidth / barCount) +
            datasetIndex * barWidth +
            barWidth / 2;
          const barHeight = (value / maxValue) * chartHeight;
          const y = height - padding - barHeight;

          ctx.fillStyle = Array.isArray(colors)
            ? colors[index]
            : colors || getThemeColors(1)[0];
          ctx.fillRect(x, y, barWidth * 0.8, barHeight);

          // Draw value on top of the bar
          ctx.fillStyle = "#000";
          ctx.font = "10px Arial";
          ctx.textAlign = "center";
          if (value > maxValue * 0.05) {
            // Only draw text if bar is tall enough
            ctx.fillText(value.toFixed(1), x + barWidth * 0.4, y - 5);
          }
        });
      });

      // Draw x-axis labels
      ctx.fillStyle = "#000";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      labels.forEach((label, index) => {
        const x =
          padding + index * (chartWidth / barCount) + chartWidth / barCount / 2;
        ctx.fillText(label, x, height - padding + 15);
      });

      // Draw legend
      if (datasets.length > 1) {
        const legendY = padding / 2;
        datasets.forEach((dataset, index) => {
          const legendX = padding + index * 100;
          ctx.fillStyle = Array.isArray(dataset.backgroundColor)
            ? dataset.backgroundColor[0]
            : dataset.backgroundColor || getThemeColors(1)[0];
          ctx.fillRect(legendX, legendY, 10, 10);
          ctx.fillStyle = "#000";
          ctx.textAlign = "left";
          ctx.fillText(dataset.label, legendX + 15, legendY + 8);
        });
      }
    };

    // Draw a line chart
    const drawLineChart = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number
    ) => {
      const { labels, datasets } = data;
      const pointCount = labels.length;

      if (pointCount === 0 || datasets.length === 0) return;
      if (pointCount === 1) {
        // Special case for single point
        drawBarChart(ctx, width, height);
        return;
      }

      // Calculate dimensions
      const padding = 40;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;

      // Find the maximum value for scaling
      const maxValue = Math.max(
        0.1, // Prevent division by zero
        ...datasets.flatMap((dataset) => dataset.data)
      );

      // Draw axes
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, height - padding);
      ctx.lineTo(width - padding, height - padding);
      ctx.strokeStyle = "#ccc";
      ctx.stroke();

      // Draw lines
      datasets.forEach((dataset, datasetIndex) => {
        // Use theme colors for lines
        const themeColors = getThemeColors(datasets.length);
        const color =
          dataset.borderColor || themeColors[datasetIndex % themeColors.length];

        ctx.beginPath();
        dataset.data.forEach((value, index) => {
          const x = padding + index * (chartWidth / (pointCount - 1));
          const y = height - padding - (value / maxValue) * chartHeight;

          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw points
        dataset.data.forEach((value, index) => {
          const x = padding + index * (chartWidth / (pointCount - 1));
          const y = height - padding - (value / maxValue) * chartHeight;

          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        });
      });

      // Draw x-axis labels (show only a subset to avoid overcrowding)
      ctx.fillStyle = "#000";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";

      const labelStep = Math.max(1, Math.floor(pointCount / 10));
      labels.forEach((label, index) => {
        if (index % labelStep === 0 || index === pointCount - 1) {
          const x = padding + index * (chartWidth / (pointCount - 1));
          ctx.fillText(label, x, height - padding + 15);
        }
      });

      // Draw legend
      if (datasets.length > 1) {
        const legendY = padding / 2;
        datasets.forEach((dataset, index) => {
          // Use theme colors for legend
          const themeColors = getThemeColors(datasets.length);
          const color =
            dataset.borderColor || themeColors[index % themeColors.length];
          const legendX = padding + index * 100;

          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.moveTo(legendX, legendY + 5);
          ctx.lineTo(legendX + 15, legendY + 5);
          ctx.stroke();
          ctx.fillStyle = "#000";
          ctx.textAlign = "left";
          ctx.fillText(dataset.label, legendX + 20, legendY + 8);
        });
      }
    };

    // Draw a pie or doughnut chart
    const drawPieChart = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      isDoughnut: boolean = false
    ) => {
      const { labels, datasets } = data;

      if (labels.length === 0 || datasets.length === 0) return;

      const dataset = datasets[0]; // Use only the first dataset for pie/doughnut
      const values = dataset.data;
      const total = Math.max(
        0.1,
        values.reduce((sum, value) => sum + value, 0)
      ); // Prevent division by zero

      // Calculate dimensions
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) - 40;
      const innerRadius = isDoughnut ? radius * 0.6 : 0;

      // Generate colors using theme colors
      const colors =
        dataset.backgroundColor instanceof Array
          ? dataset.backgroundColor
          : getThemeColors(values.length);

      // Draw slices
      let startAngle = 0;
      values.forEach((value, index) => {
        const sliceAngle = (value / total) * 2 * Math.PI;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();

        ctx.fillStyle = Array.isArray(colors)
          ? colors[index]
          : colors || getThemeColors(1)[0];
        ctx.fill();

        if (isDoughnut) {
          // Cut out the center for doughnut
          ctx.beginPath();
          ctx.moveTo(
            centerX + innerRadius * Math.cos(startAngle + sliceAngle / 2),
            centerY + innerRadius * Math.sin(startAngle + sliceAngle / 2)
          );
          ctx.arc(
            centerX,
            centerY,
            innerRadius,
            startAngle,
            startAngle + sliceAngle,
            false
          );
          ctx.closePath();
          ctx.fillStyle = "#fff";
          ctx.fill();
        }

        // Draw label if slice is large enough
        if (value / total > 0.05) {
          const labelRadius =
            (radius + innerRadius) / 2 + (innerRadius === 0 ? 0 : 10);
          const labelAngle = startAngle + sliceAngle / 2;
          const labelX = centerX + labelRadius * Math.cos(labelAngle);
          const labelY = centerY + labelRadius * Math.sin(labelAngle);

          ctx.fillStyle = "#fff";
          ctx.font = "bold 12px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${Math.round((value / total) * 100)}%`, labelX, labelY);
        }

        startAngle += sliceAngle;
      });

      // Draw legend
      const legendY = height - 30;
      const itemWidth = width / labels.length;

      labels.forEach((label, index) => {
        const legendX = index * itemWidth + itemWidth / 2;

        ctx.fillStyle = Array.isArray(colors)
          ? colors[index]
          : colors || getThemeColors(1)[0];
        ctx.fillRect(legendX - 30, legendY, 10, 10);

        ctx.fillStyle = "#000";
        ctx.font = "10px Arial";
        ctx.textAlign = "left";
        ctx.fillText(label, legendX - 15, legendY + 8);
      });
    };

    // Draw chart based on type
    switch (type) {
      case "bar":
        drawBarChart(ctx, displayWidth, displayHeight);
        break;
      case "line":
        drawLineChart(ctx, displayWidth, displayHeight);
        break;
      case "pie":
        drawPieChart(ctx, displayWidth, displayHeight, false);
        break;
      case "doughnut":
        drawPieChart(ctx, displayWidth, displayHeight, true);
        break;
      default:
        break;
    }
  }, [type, data, options, getThemeColors]);

  return (
    <canvas
      ref={canvasRef}
      height={height}
      width={width || "100%"}
      style={{ width: width || "100%", height }}
      role="img"
      aria-label={`${type} chart of ${data.datasets.map((d) => d.label).join(", ")}`}
    />
  );
};

export default PerformanceChart;
