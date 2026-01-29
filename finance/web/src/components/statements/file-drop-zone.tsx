'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useImportStatements } from '@/lib/hooks/use-statements';
import type { ImportStatementResult } from '@/lib/types';

interface FileDropZoneProps {
  className?: string;
}

interface UploadResult {
  success: boolean;
  message: string;
  filename?: string;
  canDismiss?: boolean;
}

function formatResult(result: ImportStatementResult): string {
  if (!result.success) {
    return `${result.filename}: ${result.error || 'Failed'}`;
  }

  if (result.type === 'sofi_apex') {
    const account = result.account?.replace('_', ' ') || 'statement';
    return `${account} — $${(result.total_value ?? 0).toLocaleString()} (${result.date || 'unknown date'})`;
  }

  if (result.type === 'chase_cc') {
    const card = result.card_type?.replace('_', ' ') || 'credit card';
    return `${card} — ${result.transactions_imported} transactions (${result.statement_date || 'unknown date'})`;
  }

  return result.filename;
}

export function FileDropZone({ className }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useImportStatements();

  const handleFiles = useCallback(
    async (files: File[]) => {
      // Keep successful results, clear failed ones for fresh retry
      setResults((prev) => prev.filter((r) => r.success));

      // Filter to only PDF files
      const pdfFiles = files.filter((f) =>
        f.name.toLowerCase().endsWith('.pdf')
      );

      if (pdfFiles.length === 0) {
        setResults((prev) => [
          ...prev,
          {
            success: false,
            message: 'Please upload PDF files',
            canDismiss: true,
          },
        ]);
        return;
      }

      const nonPdfCount = files.length - pdfFiles.length;
      const uploadResults: UploadResult[] = [];

      if (nonPdfCount > 0) {
        uploadResults.push({
          success: false,
          message: `Skipped ${nonPdfCount} non-PDF file${
            nonPdfCount > 1 ? 's' : ''
          }`,
          canDismiss: true,
        });
      }

      setIsUploading(true);

      try {
        const response = await importMutation.mutateAsync(pdfFiles);

        for (const result of response.results) {
          uploadResults.push({
            success: result.success,
            message: formatResult(result),
            filename: result.filename,
            canDismiss: !result.success,
          });
        }
      } catch (error) {
        uploadResults.push({
          success: false,
          message: error instanceof Error ? error.message : 'An error occurred',
          canDismiss: true,
        });
      }

      setIsUploading(false);
      // Append new results to preserved successes
      setResults((prev) => [...prev, ...uploadResults]);
    },
    [importMutation]
  );

  const handleDismiss = useCallback((index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearAll = useCallback(() => {
    setResults([]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(Array.from(files));
      }
      // Reset the input so the same file can be selected again
      e.target.value = '';
    },
    [handleFiles]
  );

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return (
    <div className={cn('space-y-4', className)}>
      <input
        ref={fileInputRef}
        type='file'
        accept='.pdf'
        multiple
        className='hidden'
        onChange={handleFileChange}
        disabled={isUploading}
      />
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50',
          isUploading && 'pointer-events-none opacity-60'
        )}
      >
        {isUploading ? (
          <>
            <Loader2 className='h-10 w-10 text-muted-foreground animate-spin' />
            <div className='text-center'>
              <p className='text-sm font-medium'>
                Processing statements...
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                Classifying and parsing PDFs
              </p>
            </div>
          </>
        ) : (
          <>
            <div
              className={cn(
                'rounded-full p-3 transition-colors',
                isDragging ? 'bg-primary/10' : 'bg-muted'
              )}
            >
              {isDragging ? (
                <FileText className='h-6 w-6 text-primary' />
              ) : (
                <Upload className='h-6 w-6 text-muted-foreground' />
              )}
            </div>
            <div className='text-center'>
              <p className='text-sm font-medium'>
                {isDragging ? 'Drop to upload' : 'Drop statement PDFs here'}
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                Brokerage and credit card statements (multiple files supported)
              </p>
            </div>
          </>
        )}
      </div>

      {results.length > 0 && (
        <div className='space-y-2'>
          {/* Summary with clear all button */}
          {results.length > 1 && (
            <Alert variant={failureCount === 0 ? 'default' : 'destructive'}>
              {failureCount === 0 ? (
                <CheckCircle className='h-4 w-4' />
              ) : (
                <XCircle className='h-4 w-4' />
              )}
              <AlertDescription className='flex-1'>
                {successCount > 0 && `${successCount} imported`}
                {successCount > 0 && failureCount > 0 && ', '}
                {failureCount > 0 && `${failureCount} failed`}
              </AlertDescription>
              <Button
                variant='ghost'
                size='sm'
                className='h-6 px-2 text-xs ml-auto'
                onClick={handleClearAll}
              >
                Clear all
              </Button>
            </Alert>
          )}
          {/* Individual results */}
          {results.map((result, idx) => (
            <Alert
              key={idx}
              variant={result.success ? 'default' : 'destructive'}
              className='py-2'
            >
              {result.success ? (
                <CheckCircle className='h-4 w-4' />
              ) : (
                <XCircle className='h-4 w-4' />
              )}
              <AlertDescription className='text-sm flex-1'>
                {result.message}
              </AlertDescription>
              {result.canDismiss && (
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-5 w-5 ml-auto shrink-0 hover:bg-destructive/20'
                  onClick={() => handleDismiss(idx)}
                >
                  <X className='h-3 w-3' />
                  <span className='sr-only'>Dismiss</span>
                </Button>
              )}
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}
