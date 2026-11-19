import { useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  Download,
  FolderKanban,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { selectActiveCanvas, useWorkspaceStore } from '@/canvas/store/useWorkspaceStore';
import { Favicon } from '@/shared/components/Favicon';
import { formatRelativeTime } from '@/shared/utils/id';

interface CanvasSidebarProps {
  open: boolean;
  onClose: () => void;
  onOpenImportExport: () => void;
  onFocusNode: (nodeId: string) => void;
}

export function CanvasSidebar({
  open,
  onClose,
  onOpenImportExport,
  onFocusNode,
}: CanvasSidebarProps) {
  const canvases = useWorkspaceStore((s) => s.canvases);
  const activeCanvas = useWorkspaceStore(selectActiveCanvas);
  const selectCanvas = useWorkspaceStore((s) => s.selectCanvas);
  const createCanvas = useWorkspaceStore((s) => s.createCanvas);
  const updateCanvasMeta = useWorkspaceStore((s) => s.updateCanvasMeta);
  const duplicateCanvas = useWorkspaceStore((s) => s.duplicateCanvas);
  const deleteCanvas = useWorkspaceStore((s) => s.deleteCanvas);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  if (!open) return null;

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createCanvas(newName, newDesc);
    setNewName('');
    setNewDesc('');
    setIsCreating(false);
  };

  const handleStartEdit = (id: string, name: string, description: string) => {
    setEditingCanvasId(id);
    setEditName(name);
    setEditDesc(description);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      updateCanvasMeta(id, editName, editDesc);
    }
    setEditingCanvasId(null);
  };

  const filteredNodes = (activeCanvas?.nodes ?? []).filter((node) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      node.data.title.toLowerCase().includes(q) ||
      node.data.domain.toLowerCase().includes(q) ||
      node.data.description.toLowerCase().includes(q) ||
      node.data.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <aside className="z-30 flex h-full w-72 shrink-0 flex-col border-r border-[#242833] bg-[#121419]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#222630] px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
            <FolderKanban className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold tracking-wide text-[#eceef2]">
            INFINITE CANVAS
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Collapse sidebar"
          className="rounded-md p-1 text-[#7e879a] hover:bg-[#1f232d] hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Canvases Section */}
      <div className="flex flex-col border-b border-[#222630] p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6e778a]">
            Canvases ({canvases.length})
          </span>
          <button
            type="button"
            onClick={() => setIsCreating((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md bg-[#1d212b] px-2 py-1 text-[11px] font-medium text-[#cfd5e2] border border-[#2d3240] hover:bg-[#252a36] hover:text-white transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        </div>

        {isCreating && (
          <form
            onSubmit={handleCreate}
            className="mb-2.5 flex flex-col gap-2 rounded-lg border border-[#2d3342] bg-[#161921] p-2.5"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Canvas name (e.g. Design Inspo)"
              autoFocus
              className="w-full rounded-md border border-[#323847] bg-[#0e1015] px-2.5 py-1.5 text-xs text-[#eceef2] outline-none focus:border-indigo-400"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Short description (optional)"
              className="w-full rounded-md border border-[#323847] bg-[#0e1015] px-2.5 py-1.5 text-xs text-[#b7bfce] outline-none focus:border-indigo-400"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded px-2 py-1 text-[11px] text-[#868fa3] hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-indigo-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-400 cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        )}

        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-0.5">
          {canvases.map((canvas) => {
            const isActive = canvas.id === activeCanvas?.id;
            const isEditing = editingCanvasId === canvas.id;

            if (isEditing) {
              return (
                <div
                  key={canvas.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-indigo-400/50 bg-[#181c26] p-2"
                >
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(canvas.id);
                      if (e.key === 'Escape') setEditingCanvasId(null);
                    }}
                    autoFocus
                    className="w-full rounded border border-[#353b4a] bg-[#0e1015] px-2 py-1 text-xs text-white outline-none"
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Description..."
                    className="w-full rounded border border-[#353b4a] bg-[#0e1015] px-2 py-1 text-[11px] text-[#b4bccb] outline-none"
                  />
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingCanvasId(null)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-[#8d96a9] hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(canvas.id)}
                      className="inline-flex items-center gap-0.5 rounded bg-indigo-500 px-2 py-0.5 text-[10px] font-medium text-white cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      Save
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={canvas.id}
                className={`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                  isActive
                    ? 'bg-[#1d212d] text-white border border-[#30374a]'
                    : 'text-[#a3abb9] border border-transparent hover:bg-[#171a22] hover:text-[#e1e5ed]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectCanvas(canvas.id)}
                  className="flex min-w-0 flex-1 flex-col text-left cursor-pointer"
                >
                  <span className="truncate text-xs font-medium">{canvas.name}</span>
                  <span className="text-[10px] text-[#6d768a]">
                    {canvas.nodes.length} {canvas.nodes.length === 1 ? 'card' : 'cards'} ·{' '}
                    {formatRelativeTime(canvas.updatedAt)}
                  </span>
                </button>

                <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(canvas.id, canvas.name, canvas.description)}
                    title="Rename canvas"
                    className="rounded p-1 text-[#828ba0] hover:bg-[#272c3a] hover:text-white cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateCanvas(canvas.id)}
                    title="Duplicate canvas"
                    className="rounded p-1 text-[#828ba0] hover:bg-[#272c3a] hover:text-white cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  {canvases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteCanvas(canvas.id)}
                      title="Delete canvas"
                      className="rounded p-1 text-[#828ba0] hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cards on Current Canvas (Search & Jump) */}
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6e778a]">
            Cards on Canvas ({activeCanvas?.nodes.length ?? 0})
          </span>
        </div>

        <div className="relative mb-2.5">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#677083]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter cards by title, tag..."
            className="w-full rounded-lg border border-[#262b36] bg-[#161921] py-1.5 pl-8 pr-2.5 text-xs text-[#e2e5ec] placeholder-[#656e80] outline-none focus:border-indigo-400/70"
          />
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
          {filteredNodes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#252a35] px-3 py-6 text-center text-[11px] text-[#6d768a]">
              {activeCanvas?.nodes.length === 0
                ? 'No website cards yet. Capture a page or click "Add URL".'
                : 'No cards match your filter.'}
            </div>
          ) : (
            filteredNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onFocusNode(node.id)}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[#191d27] transition-colors cursor-pointer"
              >
                <Favicon
                  src={node.data.favicon}
                  url={node.data.url}
                  domain={node.data.domain}
                  size={16}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-[#dde1ea]">
                    {node.data.title}
                  </div>
                  <div className="truncate text-[10px] text-[#6f788c]">{node.data.domain}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Footer Actions: Import / Export */}
      <div className="border-t border-[#222630] p-3">
        <button
          type="button"
          onClick={onOpenImportExport}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2b303d] bg-[#181b23] px-3 py-2 text-xs font-medium text-[#cfd5e2] hover:bg-[#222733] hover:text-white transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Import / Export JSON
        </button>
      </div>
    </aside>
  );
}
