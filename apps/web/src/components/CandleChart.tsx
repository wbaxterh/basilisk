"use client";

import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, type IChartApi, type CandlestickData, type Time, ColorType } from "lightweight-charts";

interface CandleData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volumeAda: string;
}

interface CandleChartProps {
  data: CandleData[];
  height?: number;
}

export default function CandleChart({ data, height = 400 }: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94A3B8",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "#1E293B" },
        horzLines: { color: "#1E293B" },
      },
      crosshair: {
        vertLine: { color: "#475569", width: 1, style: 3 },
        horzLine: { color: "#475569", width: 1, style: 3 },
      },
      timeScale: {
        borderColor: "#1E293B",
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: "#1E293B",
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
    });

    const chartData: CandlestickData<Time>[] = data.map((d) => ({
      time: d.openTime as Time,
      open: parseFloat(d.open),
      high: parseFloat(d.high),
      low: parseFloat(d.low),
      close: parseFloat(d.close),
    }));

    candleSeries.setData(chartData);
    chart.timeScale().fitContent();

    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [data, height]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    />
  );
}
