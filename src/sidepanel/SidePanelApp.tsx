import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  ExternalLink,
  FolderPlus,
  Layers,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Favicon } from '@/shared/components/Favicon';
import {
  addWebsiteToCanvasInStorage,
  createEmptyCanvas,
  loadWorkspaceState,
  saveWorkspaceState,
  subscribeWorkspaceChanges,
} from '@/shared/storage/workspaceStorage';
import type {
  CanvasProject,
  CapturedPageInfo,
  PersistedWorkspaceState,
  WebsiteFlowNode,
} from '@/shared/types/canvas';
import {
  getActiveTabInfo,
  isExtensionEnvironment,
  openCanvasWorkspaceTab,
  openExternalUrl,
} from '@/shared/utils/chromeService';
import { formatRelativeTime } from '@/shared/utils/id';
import { isRestrictedUrl, normalizeExternalUrl } from '@/shared/utils/url';

interface FlattenedCardItem {
  canvasId: string;
  canvasName: string;
  node: WebsiteFlowNode;
}

export function SidePanelApp() {
  const [workspace, setWorkspace] = useState<PersistedWorkspaceState | null>(null);
  const [activeTab, setActiveTab] = useState<CapturedPageInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState<'active' | 'all'>('active');

  const [isCreatingCanvas, setIsCreatingCanvas] = useState(false);
  const [newCanvasName, setNewCanvasName] = useState('');
  const [quickAddState, setQuickAddState] = useState<'idle' | 'saving' | 'done'>('idle');

  const refreshActiveTab = useCallback(async () => {
    const info = await getActiveTabInfo();
    setActiveTab(info);
  }, []);

  useEffect(() => {
    let mounted = true;

    void loadWorkspaceState().then((state) => {
      if (mounted) setWorkspace(state);
    });
    void refreshActiveTab();

    const unsubStorage = subscribeWorkspaceChanges((incoming) => {
      if (mounted) setWorkspace(incoming);
    });

    const handleTabUpdate = () => {
      void refreshActiveTab();
    };

    if (isExtensionEnvironment() && chrome.tabs) {
      chrome.tabs.onActivated.addListener(handleTabUpdate);
      chrome.tabs.onUpdated.addListener(handleTabUpdate);
    }

    return () => {
      mounted = false;
      unsubStorage();
      if (isExtensionEnvironment() && chrome.tabs) {
        chrome.tabs.onActivated.removeListener(handleTabUpdate);
        chrome.tabs.onUpdated.removeListener(handleTabUpdate);
      }
    };
  }, [refreshActiveTab]);

  const activeCanvas: CanvasProject | undefined = useMemo(() => {
    if (!workspace) return undefined;
    return (
      workspace.canvases.find((c) => c.id === workspace.activeCanvasId) ?? workspace.canvases[0]
    );
  }, [workspace]);

  const recentItems = useMemo<FlattenedCardItem[]>(() => {
    if (!workspace) return [];
    const targetCanvases =
      filterScope === 'active' && activeCanvas ? [activeCanvas] : workspace.canvases;

    const all: FlattenedCardItem[] = [];
    for (const canvas of targetCanvases) {
      for (const node of canvas.nodes) {
        all.push({ canvasId: canvas.id, canvasName: canvas.name, node });
      }
    }

    all.sort(
      (a, b) =>
        Date.parse(b.node.data.capturedAt) - Date.parse(a.node.data.capturedAt)
    );

    const q = searchQuery.trim().toLowerCase();
    if (!q) return all;

    return all.filter(
      ({ node, canvasName }) =>
        node.data.title.toLowerCase().includes(q) ||
        node.data.domain.toLowerCase().includes(q) ||
        node.data.url.toLowerCase().includes(q) ||
        node.data.description.toLowerCase().includes(q) ||
        canvasName.toLowerCase().includes(q) ||
        node.data.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [workspace, activeCanvas, filterScope, searchQuery]);

  const canCaptureTab =
    Boolean(activeTab) &&
    !isRestrictedUrl(activeTab!.url) &&
    Boolean(normalizeExternalUrl(activeTab!.url));

  const handleSelectCanvas = async (canvasId: string) => {
    if (!workspace) return;
    const next: PersistedWorkspaceState = { ...workspace, activeCanvasId: canvasId };
    setWorkspace(next);
    await saveWorkspaceState(next);
  };

  const handleCreateCanvas = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspace || !newCanvasName.trim()) return;
    const created = createEmptyCanvas(newCanvasName);
    const next: PersistedWorkspaceState = {
      ...workspace,
      activeCanvasId: created.id,
      canvases: [created, ...workspace.canvases],
    };
    setWorkspace(next);
    await saveWorkspaceState(next);
    setNewCanvasName('');
    setIsCreatingCanvas(false);
  };

  const handleQuickAddActiveTab = async () => {
    if (!activeTab || !canCaptureTab || !activeCanvas) return;
    setQuickAddState('saving');
    try {
      await addWebsiteToCanvasInStorage({
        canvasId: activeCanvas.id,
        title: activeTab.title,
        url: activeTab.url,
        favicon: activeTab.favicon,
      });
      const fresh = await loadWorkspaceState();
      setWorkspace(fresh);
      setQuickAddState('done');
      setTimeout(() => setQuickAddState('idle'), 1800);
    } catch {
      setQuickAddState('idle');
    }
  };

  const handleDeleteNode = async (canvasId: string, nodeId: string) => {
    if (!workspace) return;
    const next: PersistedWorkspaceState = {
      ...workspace,
      canvases: workspace.canvases.map((canvas) => {
        if (canvas.id !== canvasId) return canvas;
        return {
          ...canvas,
          updatedAt: new Date().toISOString(),
          nodes: canvas.nodes.filter((n) => n.id !== nodeId),
          edges: canvas.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        };
      }),
    };
    setWorkspace(next);
    await saveWorkspaceState(next);
  };

  if (!workspace || !activeCanvas) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0e0f12] text-xs text-[#7c8599]">
        Loading Side Panel...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0e0f12] text-[#eceef2]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#222630] px-3.5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-indigo-400/30 bg-indigo-500/15 text-indigo-300">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold tracking-wide">Infinite Canvas</span>
        </div>
        <button
          type="button"
          onClick={() => void openCanvasWorkspaceTab(activeCanvas.id)}
          className="inline-flex items-center gap-1 rounded-md bg-indigo-500/90 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 transition-colors cursor-pointer"
        >
          Open Canvas
          <ExternalLink className="w-3 h-3" />
        </button>
      </header>

      {/* Quick Capture Current Tab */}
      <section className="border-b border-[#222630] p-3">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6e778a]">
          Current Page
        </div>
        {canCaptureTab && activeTab ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-[#262b36] bg-[#14171f] p-2.5">
            <Favicon
              src={activeTab.favicon}
              url={activeTab.url}
              domain={activeTab.domain}
              size={18}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-[#eceef2]">
                {activeTab.title}
              </div>
              <div className="truncate text-[10px] text-[#767f93]">{activeTab.domain}</div>
            </div>
            <button
              type="button"
              onClick={() => void handleQuickAddActiveTab()}
              disabled={quickAddState === 'saving'}
              className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                quickAddState === 'done'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-indigo-500 text-white hover:bg-indigo-400'
              }`}
            >
              {quickAddState === 'done' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Added
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#262b36] bg-[#13161d] px-3 py-2.5 text-[11px] text-[#757e92]">
            Navigate to any webpage to capture it directly into{' '}
            <span className="text-[#c8cfde]">{activeCanvas.name}</span>.
          </div>
        )}
      </section>

      {/* Canvases Switcher */}
      <section className="border-b border-[#222630] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6e778a]">
            Canvases ({workspace.canvases.length})
          </span>
          <button
            type="button"
            onClick={() => setIsCreatingCanvas((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-[#2c3140] bg-[#171a22] px-2 py-0.5 text-[10px] font-medium text-[#cfd5e2] hover:bg-[#222633] cursor-pointer"
          >
            <FolderPlus className="w-3 h-3" />
            New
          </button>
        </div>

        {isCreatingCanvas && (
          <form onSubmit={(e) => void handleCreateCanvas(e)} className="mb-2 flex gap-1.5">
            <input
              type="text"
              value={newCanvasName}
              onChange={(e) => setNewCanvasName(e.target.value)}
              placeholder="Canvas name..."
              autoFocus
              className="flex-1 rounded-lg border border-[#303647] bg-[#14171f] px-2.5 py-1.5 text-xs text-[#eceef2] outline-none focus:border-indigo-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400 cursor-pointer"
            >
              Add
            </button>
          </form>
        )}

        <div className="flex flex-wrap gap-1.5">
          {workspace.canvases.map((canvas) => {
            const selected = canvas.id === activeCanvas.id;
            return (
              <button
                key={canvas.id}
                type="button"
                onClick={() => void handleSelectCanvas(canvas.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  selected
                    ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-200'
                    : 'border-[#262b36] bg-[#14171f] text-[#9aa2b1] hover:border-[#373f50] hover:text-white'
                }`}
              >
                <span className="max-w-[140px] truncate">{canvas.name}</span>
                <span className="text-[10px] opacity-65">{canvas.nodes.length}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Search & Recent Captures */}
      <section className="flex min-h-0 flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#677083]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search captured websites..."
              className="w-full rounded-lg border border-[#262b36] bg-[#14171f] py-1.5 pl-8 pr-2.5 text-xs text-[#eceef2] placeholder-[#656e80] outline-none focus:border-indigo-400/70"
            />
          </div>

          <div className="flex rounded-lg border border-[#262b36] bg-[#14171f] p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setFilterScope('active')}
              className={`rounded-md px-2 py-1 font-medium cursor-pointer ${
                filterScope === 'active'
                  ? 'bg-[#242936] text-white'
                  : 'text-[#828ba0] hover:text-white'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setFilterScope('all')}
              className={`rounded-md px-2 py-1 font-medium cursor-pointer ${
                filterScope === 'all'
                  ? 'bg-[#242936] text-white'
                  : 'text-[#828ba0] hover:text-white'
              }`}
            >
              All
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
          {recentItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#242834] px-3 py-8 text-center text-xs text-[#6f788c]">
              {searchQuery
                ? 'No websites match your search.'
                : 'No captured websites yet.'}
            </div>
          ) : (
            recentItems.map(({ canvasId, canvasName, node }) => (
              <div
                key={`${canvasId}-${node.id}`}
                className="group flex items-start gap-2.5 rounded-xl border border-[#222632] bg-[#14171f] p-2.5 hover:border-[#343b4c] transition-colors"
              >
                <Favicon
                  src={node.data.favicon}
                  url={node.data.url}
                  domain={node.data.domain}
                  size={18}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => void openExternalUrl(node.data.url)}
                    className="block w-full truncate text-left text-xs font-medium text-[#e4e7ef] hover:text-indigo-300 cursor-pointer"
                    title={node.data.url}
                  >
                    {node.data.title}
                  </button>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#747d91]">
                    <span className="truncate">{node.data.domain}</span>
                    <span>·</span>
                    <span className="shrink-0">{formatRelativeTime(node.data.capturedAt)}</span>
                    {filterScope === 'all' && (
                      <>
                        <span>·</span>
                        <span className="truncate text-indigo-300/80">{canvasName}</span>
                      </>
                    )}
                  </div>
                  {node.data.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {node.data.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-[#1f232e] px-1.5 py-0.5 text-[9px] text-[#aeb6c6]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => void openExternalUrl(node.data.url)}
                    title="Open website"
                    className="rounded p-1 text-[#828ba0] hover:bg-[#232836] hover:text-white cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteNode(canvasId, node.id)}
                    title="Remove from canvas"
                    className="rounded p-1 text-[#828ba0] hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
