'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUploadStatement } from '@/lib/hooks/use-statements';

interface FileDropZoneProps {
  className?: string;
}

interface UploadResult {
  success: boolean;
  message: string;
}

export function FileDropZone({ className }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadStatement();
  const isUploading = uploadProgress !== null;

  const handleFiles = useCallback(
    async (files: File[]) => {
      setResults([]);

      // Filter to only PDF files
      const pdfFiles = files.filter((f) =>
        f.name.toLowerCase().endsWith('.pdf')
      );

      if (pdfFiles.length === 0) {
        setResults([
          {
            success: false,
            message: 'Please upload PDF files',
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
        });
      }

      setUploadProgress({ current: 0, total: pdfFiles.length });

      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        setUploadProgress({ current: i + 1, total: pdfFiles.length });

        try {
          const response = await uploadMutation.mutateAsync(file);

          if (response.success) {
            const account = response.account?.replace('_', ' ') || 'statement';
            uploadResults.push({
              success: true,
              message: `Imported ${account} (${response.date})`,
            });
          } else {
            uploadResults.push({
              success: false,
              message: `${file.name}: ${response.error || 'Failed to upload'}`,
            });
          }
        } catch (error) {
          uploadResults.push({
            success: false,
            message: `${file.name}: ${
              error instanceof Error ? error.message : 'An error occurred'
            }`,
          });
        }
      }

      setUploadProgress(null);
      setResults(uploadResults);
    },
    [uploadMutation]
  );

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
                Processing {uploadProgress.current} of {uploadProgress.total}...
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                Parsing PDF and saving snapshot
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
                or click to browse (multiple files supported)
              </p>
            </div>
          </>
        )}
      </div>

      {results.length > 0 && (
        <div className='space-y-2'>
          {/* Summary */}
          {results.length > 1 && (
            <Alert variant={failureCount === 0 ? 'default' : 'destructive'}>
              {failureCount === 0 ? (
                <CheckCircle className='h-4 w-4' />
              ) : (
                <XCircle className='h-4 w-4' />
              )}
              <AlertDescription>
                {successCount > 0 && `${successCount} imported`}
                {successCount > 0 && failureCount > 0 && ', '}
                {failureCount > 0 && `${failureCount} failed`}
              </AlertDescription>
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
              <AlertDescription className='text-sm'>
                {result.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}
