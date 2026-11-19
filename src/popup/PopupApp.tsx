import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ExternalLink,
  Layers,
  PanelRight,
  Plus,
} from 'lucide-react';
import { Favicon } from '@/shared/components/Favicon';
import {
  addWebsiteToCanvasInStorage,
  loadWorkspaceState,
} from '@/shared/storage/workspaceStorage';
import type { CanvasProject, CapturedPageInfo } from '@/shared/types/canvas';
import {
  captureVisibleTabThumbnail,
  getActiveTabInfo,
  openCanvasWorkspaceTab,
  openExtensionSidePanel,
} from '@/shared/utils/chromeService';
import { isRestrictedUrl, normalizeExternalUrl } from '@/shared/utils/url';

export function PopupApp() {
  const [canvases, setCanvases] = useState<CanvasProject[]>([]);
  const [selectedCanvasId, setSelectedCanvasId] = useState('');
  const [pageInfo, setPageInfo] = useState<CapturedPageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [capturedCanvasName, setCapturedCanvasName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const [workspace, tab] = await Promise.all([
          loadWorkspaceState(),
          getActiveTabInfo(),
        ]);
        if (!active) return;

        setCanvases(workspace.canvases);
        setSelectedCanvasId(workspace.activeCanvasId);
        if (tab) {
          setPageInfo(tab);
          setTitle(tab.title);
        }
      } catch {
        if (active) setError('Unable to load workspace data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, []);

  const restricted = !pageInfo || isRestrictedUrl(pageInfo.url) || !normalizeExternalUrl(pageInfo.url);

  const handleCapture = async (e: FormEvent) => {
    e.preventDefault();
    if (!pageInfo || restricted) return;

    setSubmitting(true);
    setError(null);

    try {
      const screenshot = includeScreenshot
        ? await captureVisibleTabThumbnail()
        : undefined;

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const { canvas } = await addWebsiteToCanvasInStorage({
        canvasId: selectedCanvasId || undefined,
        title: title.trim() || pageInfo.title,
        url: pageInfo.url,
        favicon: pageInfo.favicon,
        description: description.trim(),
        tags,
        screenshot,
      });

      setCapturedCanvasName(canvas.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save website to canvas.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex w-[360px] flex-col bg-[#0e0f12] text-[#eceef2]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#222630] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-indigo-400/30 bg-indigo-500/15 text-indigo-300">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold tracking-wide">Infinite Canvas</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void openExtensionSidePanel()}
            title="Open Side Panel"
            className="rounded-md p-1.5 text-[#8f98ab] hover:bg-[#1e222d] hover:text-white transition-colors cursor-pointer"
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void openCanvasWorkspaceTab(selectedCanvasId || undefined)}
            title="Open Canvas Workspace"
            className="inline-flex items-center gap-1 rounded-md border border-[#2b303d] bg-[#171a22] px-2 py-1 text-[11px] font-medium text-[#cfd5e2] hover:bg-[#222633] hover:text-white transition-colors cursor-pointer"
          >
            Open Canvas
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="p-4">
        {loading ? (
          <div className="py-10 text-center text-xs text-[#7c8599]">Loading active page...</div>
        ) : capturedCanvasName ? (
          <div className="flex flex-col items-center py-5 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 text-emerald-300">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="mb-1 text-sm font-semibold text-[#eceef2]">Added to Canvas</h2>
            <p className="mb-4 text-xs text-[#8f98ab]">
              Saved to <span className="font-medium text-[#cfd5e2]">{capturedCanvasName}</span>
            </p>
            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={() => setCapturedCanvasName(null)}
                className="flex-1 rounded-lg border border-[#2c3140] bg-[#161922] px-3 py-2 text-xs font-medium text-[#cfd5e2] hover:bg-[#202432] cursor-pointer"
              >
                Capture Again
              </button>
              <button
                type="button"
                onClick={() => void openCanvasWorkspaceTab(selectedCanvasId || undefined)}
                className="flex-1 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400 cursor-pointer"
              >
                Open Canvas
              </button>
            </div>
          </div>
        ) : restricted ? (
          <div className="flex flex-col items-center rounded-xl border border-[#252a35] bg-[#14171f] p-5 text-center">
            <AlertCircle className="mb-2.5 h-6 w-6 text-amber-400" />
            <h2 className="mb-1 text-xs font-semibold text-[#e6e8ec]">
              This page cannot be captured
            </h2>
            <p className="mb-4 text-[11px] leading-relaxed text-[#858e9f]">
              Browser system pages (such as <code className="text-[#b8c0cf]">chrome://</code> or
              extension pages) cannot be added as website cards.
            </p>
            <button
              type="button"
              onClick={() => void openCanvasWorkspaceTab(selectedCanvasId || undefined)}
              className="w-full rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400 cursor-pointer"
            >
              Open Canvas Workspace
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleCapture(e)} className="flex flex-col gap-3">
            {/* Active Page Preview */}
            <div className="flex items-start gap-2.5 rounded-xl border border-[#252a35] bg-[#14171f] p-3">
              <Favicon
                src={pageInfo.favicon}
                url={pageInfo.url}
                domain={pageInfo.domain}
                size={22}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-[#eceef2]">
                  {pageInfo.title}
                </div>
                <div className="truncate text-[11px] text-[#7c8599]" title={pageInfo.url}>
                  {pageInfo.url}
                </div>
              </div>
            </div>

            {/* Canvas Selector */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#959eb0]">
                Destination Canvas
              </label>
              <select
                value={selectedCanvasId}
                onChange={(e) => setSelectedCanvasId(e.target.value)}
                className="w-full rounded-lg border border-[#2c3140] bg-[#14171f] px-2.5 py-2 text-xs text-[#eceef2] outline-none focus:border-indigo-400"
              >
                {canvases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.nodes.length})
                  </option>
                ))}
              </select>
            </div>

            {/* Editable Title */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#959eb0]">
                Card Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-[#2c3140] bg-[#14171f] px-2.5 py-1.5 text-xs text-[#eceef2] outline-none focus:border-indigo-400"
              />
            </div>

            {/* Optional Note & Tags */}
            <div className="grid grid-cols-1 gap-2">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional note..."
                className="w-full rounded-lg border border-[#2c3140] bg-[#14171f] px-2.5 py-1.5 text-xs text-[#eceef2] placeholder-[#5e6678] outline-none focus:border-indigo-400"
              />
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Tags (comma separated)"
                className="w-full rounded-lg border border-[#2c3140] bg-[#14171f] px-2.5 py-1.5 text-xs text-[#eceef2] placeholder-[#5e6678] outline-none focus:border-indigo-400"
              />
            </div>

            {/* Screenshot Toggle */}
            <label className="flex items-center justify-between rounded-lg border border-[#242834] bg-[#13161d] px-3 py-2 cursor-pointer">
              <span className="flex items-center gap-2 text-[11px] text-[#aeb6c6]">
                <Camera className="w-3.5 h-3.5 text-[#858fa4]" />
                Include visual preview thumbnail
              </span>
              <input
                type="checkbox"
                checked={includeScreenshot}
                onChange={(e) => setIncludeScreenshot(e.target.checked)}
                className="h-3.5 w-3.5 accent-indigo-500 cursor-pointer"
              />
            </label>

            {error && (
              <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {submitting ? 'Capturing...' : 'Add to Canvas'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
