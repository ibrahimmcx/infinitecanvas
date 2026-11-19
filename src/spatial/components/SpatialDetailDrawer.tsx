import { useState, type KeyboardEvent } from 'react';
import {
  Check,
  Crosshair,
  ExternalLink,
  Focus,
  GitBranch,
  Link2,
  MousePointerClick,
  Plus,
  TextCursorInput,
  Trash2,
  X,
} from 'lucide-react';
import { useWorkspaceStore } from '@/canvas/store/useWorkspaceStore';
import { Favicon } from '@/shared/components/Favicon';
import {
  CARD_COLOR_META,
  DEFAULT_CLUSTERS,
  type CanvasFlowEdge,
  type CardColor,
  type WebsiteFlowNode,
} from '@/shared/types/canvas';
import { openExternalUrl } from '@/shared/utils/chromeService';
import { formatShortDate } from '@/shared/utils/id';

interface SpatialDetailDrawerProps {
  node: WebsiteFlowNode | null;
  allNodes: WebsiteFlowNode[];
  edges: CanvasFlowEdge[];
  customClusters: string[];
  isOverlayMode: boolean;
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
  onActivateElement: (icId: string, mode: 'click' | 'scroll') => void;
}

const COLORS: CardColor[] = ['default', 'indigo', 'emerald', 'amber', 'rose', 'sky', 'violet'];

export function SpatialDetailDrawer({
  node,
  allNodes,
  edges,
  customClusters,
  isOverlayMode,
  onClose,
  onFocusNode,
  onActivateElement,
}: SpatialDetailDrawerProps) {
  const updateWebsiteCard = useWorkspaceStore((s) => s.updateWebsiteCard);
  const deleteWebsiteCard = useWorkspaceStore((s) => s.deleteWebsiteCard);

  const [editingDesc, setEditingDesc] = useState(false);
  const [draftDesc, setDraftDesc] = useState('');
  const [newTag, setNewTag] = useState('');

  if (!node) return null;

  const connectedEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id
  );
  const connectedNodes = connectedEdges
    .map((edge) => {
      const otherId = edge.source === node.id ? edge.target : edge.source;
      const other = allNodes.find((n) => n.id === otherId);
      return other ? { node: other, label: edge.data?.label } : null;
    })
    .filter((item): item is { node: WebsiteFlowNode; label: string | undefined } => item !== null);

  const clusters = Array.from(new Set([...DEFAULT_CLUSTERS, ...customClusters]));

  const handleSaveDesc = () => {
    updateWebsiteCard(node.id, { description: draftDesc.trim() });
    setEditingDesc(false);
  };

  const handleAddTag = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const clean = newTag.trim().slice(0, 28);
    if (!clean) return;
    if (!node.data.tags.includes(clean)) {
      updateWebsiteCard(node.id, { tags: [...node.data.tags, clean].slice(0, 12) });
    }
    setNewTag('');
  };

  return (
    <aside className="pointer-events-auto absolute bottom-20 right-4 top-16 z-30 flex w-80 flex-col overflow-hidden rounded-2xl border border-[#272d3c] bg-[#0e1017]/92 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#202533] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Favicon
            src={node.data.favicon}
            url={node.data.url}
            domain={node.data.domain}
            size={18}
          />
          <span className="truncate text-xs font-medium text-[#9aa4ba]">{node.data.domain}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onFocusNode(node.id)}
            title="Focus camera on panel (F)"
            className="rounded-lg p-1.5 text-[#8f98ab] hover:bg-[#1e2330] hover:text-white cursor-pointer"
          >
            <Focus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close details (Esc)"
            className="rounded-lg p-1.5 text-[#8f98ab] hover:bg-[#1e2330] hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {node.data.screenshot && (
          <div className="overflow-hidden rounded-xl border border-[#252b38] bg-[#090b10]">
            <img
              src={node.data.screenshot}
              alt={node.data.title}
              className="h-36 w-full object-cover object-top"
            />
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold leading-snug text-[#f0f2f7]">
            {node.data.title}
          </h2>
          <p className="mt-1 break-all text-[11px] text-[#70798e]">{node.data.url}</p>
          <p className="mt-1 text-[10px] text-[#5e6678]">
            Captured {formatShortDate(node.data.capturedAt)}
          </p>
        </div>

        {/* Interactive Buttons & Controls inside this section */}
        {node.data.actions && node.data.actions.length > 0 && (
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#6e778a]">
              Interactive Controls ({node.data.actions.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {node.data.actions.map((action) => (
                <button
                  key={action.icId}
                  type="button"
                  onClick={() => {
                    if (isOverlayMode) {
                      onActivateElement(action.icId, node.data.isCentral ? 'scroll' : 'click');
                    } else if (action.href) {
                      void openExternalUrl(action.href);
                    }
                  }}
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                    action.kind === 'button'
                      ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-100 hover:bg-indigo-500 hover:text-white'
                      : action.kind === 'input'
                        ? 'border-amber-400/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/30'
                        : 'border-[#2c3345] bg-[#161a25] text-[#cbd3e3] hover:border-sky-400/60 hover:bg-sky-500/20 hover:text-white'
                  }`}
                >
                  {action.kind === 'button' ? (
                    <MousePointerClick className="h-3 w-3 shrink-0" />
                  ) : action.kind === 'input' ? (
                    <TextCursorInput className="h-3 w-3 shrink-0" />
                  ) : (
                    <Link2 className="h-3 w-3 shrink-0" />
                  )}
                  <span className="truncate">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6e778a]">
              Notes & Metadata
            </span>
            {!editingDesc && (
              <button
                type="button"
                onClick={() => {
                  setDraftDesc(node.data.description);
                  setEditingDesc(true);
                }}
                className="text-[10px] text-indigo-300 hover:text-indigo-200 cursor-pointer"
              >
                Edit
              </button>
            )}
          </div>
          {editingDesc ? (
            <div className="flex flex-col gap-1.5">
              <textarea
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                rows={3}
                autoFocus
                className="w-full resize-none rounded-lg border border-[#343c4e] bg-[#0a0c12] px-2.5 py-2 text-xs text-[#e2e5ee] outline-none focus:border-indigo-400"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingDesc(false)}
                  className="rounded px-2 py-1 text-[10px] text-[#8891a5] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDesc}
                  className="inline-flex items-center gap-1 rounded bg-indigo-500 px-2.5 py-1 text-[10px] font-medium text-white cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-[#9ca5b8]">
              {node.data.description || 'No description yet. Click Edit to add notes.'}
            </p>
          )}
        </div>

        {/* Spatial Cluster & Color */}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#6e778a]">
              Spatial Cluster
            </label>
            <select
              value={node.data.cluster ?? 'Resources'}
              onChange={(e) => updateWebsiteCard(node.id, { cluster: e.target.value })}
              className="w-full rounded-lg border border-[#2a303f] bg-[#141822] px-2.5 py-1.5 text-xs text-[#e4e7ef] outline-none focus:border-indigo-400"
            >
              {clusters.map((cluster) => (
                <option key={cluster} value={cluster}>
                  {cluster}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#6e778a]">
              Accent Glow
            </span>
            <div className="flex items-center gap-2">
              {COLORS.map((key) => {
                const meta = CARD_COLOR_META[key];
                const active = node.data.color === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateWebsiteCard(node.id, { color: key })}
                    title={meta.label}
                    className={`h-4 w-4 rounded-full transition-transform cursor-pointer ${
                      active
                        ? 'scale-125 ring-2 ring-white/80 ring-offset-2 ring-offset-[#0e1017]'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: meta.dot }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Tags */}
        <div>
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#6e778a]">
            Tags
          </span>
          <div className="mb-2 flex flex-wrap gap-1">
            {node.data.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md border border-[#2b3140] bg-[#171b26] px-2 py-0.5 text-[10px] text-[#b9c1d2]"
              >
                {tag}
                <button
                  type="button"
                  onClick={() =>
                    updateWebsiteCard(node.id, {
                      tags: node.data.tags.filter((t) => t !== tag),
                    })
                  }
                  className="text-[#747e93] hover:text-white cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="relative">
            <Plus className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#697286]" />
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tag and press Enter..."
              className="w-full rounded-lg border border-[#272d3c] bg-[#131721] py-1.5 pl-7 pr-2.5 text-[11px] text-[#e2e5ee] placeholder-[#60697d] outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        {/* Connected Panels */}
        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6e778a]">
            <GitBranch className="w-3 h-3" />
            Connections ({connectedNodes.length})
          </span>
          {connectedNodes.length === 0 ? (
            <p className="text-[11px] text-[#687185]">No linked panels yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {connectedNodes.map(({ node: other, label }) => (
                <button
                  key={other.id}
                  type="button"
                  onClick={() => onFocusNode(other.id)}
                  className="flex items-center gap-2 rounded-lg border border-[#222735] bg-[#131721] px-2.5 py-2 text-left hover:border-indigo-400/50 hover:bg-[#191e2b] transition-colors cursor-pointer"
                >
                  <Favicon
                    src={other.data.favicon}
                    url={other.data.url}
                    domain={other.data.domain}
                    size={15}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium text-[#dde1eb]">
                      {other.data.title}
                    </div>
                    <div className="truncate text-[9px] text-[#757f94]">
                      {label ? `${label} · ` : ''}
                      {other.data.domain}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-2 border-t border-[#202533] p-3">
        {isOverlayMode && node.data.icTargetId ? (
          <button
            type="button"
            onClick={() => onActivateElement(node.data.icTargetId!, 'scroll')}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400 transition-colors cursor-pointer"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Jump to Section on Page
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void openExternalUrl(node.data.url)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Website
          </button>
        )}
        {!node.data.isCentral && (
          <button
            type="button"
            onClick={() => {
              deleteWebsiteCard(node.id);
              onClose();
            }}
            title="Remove panel from universe"
            className="rounded-lg border border-[#2b3140] bg-[#171b24] p-2 text-[#8f98ab] hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
