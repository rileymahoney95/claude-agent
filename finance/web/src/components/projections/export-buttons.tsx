'use client';

import { useState } from 'react';
import { Download, Image, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProjectionPoint } from '@/lib/projection';

interface ExportButtonsProps {
  chartRef: React.RefObject<HTMLDivElement | null>;
  dataPoints: ProjectionPoint[];
}

/**
 * Export buttons for downloading chart as PNG or data as CSV.
 */
export function ExportButtons({ chartRef, dataPoints }: ExportButtonsProps) {
  const [isExportingPng, setIsExportingPng] = useState(false);

  const exportPNG = async () => {
    if (!chartRef.current || isExportingPng) return;

    setIsExportingPng(true);
    try {
      // Dynamic import to reduce bundle size
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher resolution for crisp export
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `portfolio-projection-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to export PNG:', error);
    } finally {
      setIsExportingPng(false);
    }
  };

  const exportCSV = () => {
    if (dataPoints.length === 0) return;

    const headers = [
      'Date',
      'Age',
      'Total Value',
      'Inflation Adjusted',
      'Equities',
      'Bonds',
      'Crypto',
      'Cash',
      'Is Historical',
    ];

    const rows = dataPoints.map((p) => [
      p.date,
      p.age.toFixed(1),
      p.totalValue.toFixed(2),
      p.inflationAdjustedValue.toFixed(2),
      (p.byAssetClass.equities ?? 0).toFixed(2),
      (p.byAssetClass.bonds ?? 0).toFixed(2),
      (p.byAssetClass.crypto ?? 0).toFixed(2),
      (p.byAssetClass.cash ?? 0).toFixed(2),
      p.isHistorical ? 'true' : 'false',
    ]);

    const csvContent = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = `portfolio-projection-${new Date().toISOString().split('T')[0]}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={exportPNG}
        disabled={isExportingPng || !chartRef.current}
        title="Export chart as PNG"
        className="h-8 px-2"
      >
        {isExportingPng ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Image className="h-4 w-4" />
        )}
        <span className="sr-only sm:not-sr-only sm:ml-1">PNG</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={exportCSV}
        disabled={dataPoints.length === 0}
        title="Export data as CSV"
        className="h-8 px-2"
      >
        <FileSpreadsheet className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only sm:ml-1">CSV</span>
      </Button>
    </div>
  );
}
