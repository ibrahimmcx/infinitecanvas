import { useRef, useState, type ChangeEvent } from 'react';
import { AlertTriangle, CheckCircle2, Download, Upload, X } from 'lucide-react';
import { selectActiveCanvas, useWorkspaceStore } from '@/canvas/store/useWorkspaceStore';

interface ImportExportModalProps {
  open: boolean;
  onClose: () => void;
}

function downloadJsonFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ImportExportModal({ open, onClose }: ImportExportModalProps) {
  const activeCanvas = useWorkspaceStore(selectActiveCanvas);
  const canvases = useWorkspaceStore((s) => s.canvases);
  const exportActiveCanvasJson = useWorkspaceStore((s) => s.exportActiveCanvasJson);
  const exportAllCanvasesJson = useWorkspaceStore((s) => s.exportAllCanvasesJson);
  const importFromJson = useWorkspaceStore((s) => s.importFromJson);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  if (!open) return null;

  const handleExportCurrent = () => {
    const safeName = (activeCanvas?.name ?? 'canvas')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    downloadJsonFile(exportActiveCanvasJson(), `infinite-canvas-${safeName || 'project'}.json`);
  };

  const handleExportAll = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJsonFile(exportAllCanvasesJson(), `infinite-canvas-backup-${stamp}.json`);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportErrors([]);
    setImportWarnings([]);
    setImportSuccess(null);

    try {
      const text = await file.text();
      const result = importFromJson(text);
      if (!result.valid) {
        setImportErrors(result.errors);
      } else {
        setImportWarnings(result.warnings);
        setImportSuccess(
          `Imported ${result.canvases.length} ${
            result.canvases.length === 1 ? 'canvas' : 'canvases'
          } safely without overwriting existing projects.`
        );
      }
    } catch {
      setImportErrors(['Unable to read the selected file.']);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#2b303d] bg-[#151820] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#eceef2]">Import & Export Projects</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#7f889b] hover:bg-[#232834] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Export Section */}
        <div className="mb-5 rounded-xl border border-[#252a35] bg-[#111319] p-3.5">
          <h3 className="mb-1 text-xs font-semibold text-[#dfe3ec]">Export to JSON</h3>
          <p className="mb-3 text-[11px] text-[#838c9f]">
            All data stays local. Export individual canvases or a full backup anytime.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportCurrent}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[#2f3545] bg-[#1a1e28] px-3 py-2 text-xs font-medium text-[#e1e5ee] hover:bg-[#232836] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-300" />
              Current Canvas
            </button>
            <button
              type="button"
              onClick={handleExportAll}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[#2f3545] bg-[#1a1e28] px-3 py-2 text-xs font-medium text-[#e1e5ee] hover:bg-[#232836] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-300" />
              All ({canvases.length})
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div className="rounded-xl border border-[#252a35] bg-[#111319] p-3.5">
          <h3 className="mb-1 text-xs font-semibold text-[#dfe3ec]">Import from JSON</h3>
          <p className="mb-3 text-[11px] text-[#838c9f]">
            Imported files are validated and added alongside your existing canvases to prevent
            accidental data loss.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#384054] bg-[#171a23] px-3 py-3 text-xs font-medium text-[#cfd5e2] hover:border-indigo-400/70 hover:bg-[#1c202c] hover:text-white transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4 text-indigo-300" />
            Choose JSON Export File
          </button>

          {importErrors.length > 0 && (
            <div className="mt-3 rounded-lg border border-rose-500/35 bg-rose-500/10 p-2.5 text-[11px] text-rose-300">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Import failed
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                {importErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {importSuccess && (
            <div className="mt-3 rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {importSuccess}
              </div>
              {importWarnings.length > 0 && (
                <ul className="mt-1.5 list-disc pl-4 text-amber-300 space-y-0.5">
                  {importWarnings.slice(0, 5).map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
