import React, { useRef, useEffect } from "react";

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
  width?: number;
  options?: Record<string, unknown>;
}

/**
 * A simple chart component that renders charts using HTML Canvas
 *
 * This is a placeholder implementation that draws basic charts.
 * In a real application, you would use a proper charting library like Chart.js or Recharts.
 */
const PerformanceChart: React.FC<PerformanceChartProps> = ({
  type,
  data,
  height = 200,
  width,
  options = {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Generate colors for the chart
    const generateColors = (count: number): string[] => {
      const colors = [
        "rgba(255, 99, 132, 0.6)", // Red
        "rgba(54, 162, 235, 0.6)", // Blue
        "rgba(255, 206, 86, 0.6)", // Yellow
        "rgba(75, 192, 192, 0.6)", // Teal
        "rgba(153, 102, 255, 0.6)", // Purple
        "rgba(255, 159, 64, 0.6)", // Orange
        "rgba(199, 199, 199, 0.6)", // Gray
        "rgba(83, 102, 255, 0.6)", // Indigo
        "rgba(255, 99, 255, 0.6)", // Pink
        "rgba(0, 168, 133, 0.6)", // Green
      ];

      return Array(count)
        .fill(0)
        .map((_, i) => colors[i % colors.length]);
    };

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
      const maxValue = Math.max(...datasets.flatMap((dataset) => dataset.data));

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
            : generateColors(barCount);

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
            : colors || generateColors(1)[0];
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
            : dataset.backgroundColor || generateColors(1)[0];
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

      // Calculate dimensions
      const padding = 40;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;

      // Find the maximum value for scaling
      const maxValue = Math.max(...datasets.flatMap((dataset) => dataset.data));

      // Draw axes
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, height - padding);
      ctx.lineTo(width - padding, height - padding);
      ctx.strokeStyle = "#ccc";
      ctx.stroke();

      // Draw lines
      datasets.forEach((dataset, datasetIndex) => {
        const color =
          dataset.borderColor || `hsl(${datasetIndex * 137.5}, 70%, 50%)`;

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
          const legendX = padding + index * 100;
          ctx.strokeStyle =
            dataset.borderColor || `hsl(${index * 137.5}, 70%, 50%)`;
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
      const total = values.reduce((sum, value) => sum + value, 0);

      // Calculate dimensions
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) - 40;
      const innerRadius = isDoughnut ? radius * 0.6 : 0;

      // Generate colors
      const colors =
        dataset.backgroundColor instanceof Array
          ? dataset.backgroundColor
          : generateColors(values.length);

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
          : colors || generateColors(1)[0];
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
          : colors || generateColors(1)[0];
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
        drawBarChart(ctx, canvas.width, canvas.height);
        break;
      case "line":
        drawLineChart(ctx, canvas.width, canvas.height);
        break;
      case "pie":
        drawPieChart(ctx, canvas.width, canvas.height, false);
        break;
      case "doughnut":
        drawPieChart(ctx, canvas.width, canvas.height, true);
        break;
      default:
        break;
    }
  }, [type, data, options]);

  return (
    <canvas
      ref={canvasRef}
      height={height}
      width={width || "100%"}
      style={{ width: width || "100%", height }}
    />
  );
};

export default PerformanceChart;
