import { memo, useState, type KeyboardEvent } from 'react';
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import {
  Check,
  Copy,
  Crosshair,
  ExternalLink,
  LayoutGrid,
  Link2,
  MousePointerClick,
  Palette,
  Pencil,
  Plus,
  TextCursorInput,
  Trash2,
  X,
} from 'lucide-react';
import { useWorkspaceStore } from '@/canvas/store/useWorkspaceStore';
import { Favicon } from '@/shared/components/Favicon';
import {
  CARD_COLOR_META,
  type CardColor,
  type CardVariant,
  type WebsiteFlowNode,
} from '@/shared/types/canvas';
import { openExternalUrl } from '@/shared/utils/chromeService';
import { formatShortDate } from '@/shared/utils/id';

const COLOR_KEYS: CardColor[] = [
  'default',
  'indigo',
  'emerald',
  'amber',
  'rose',
  'sky',
  'violet',
];

const VARIANT_CYCLE: CardVariant[] = ['standard', 'compact', 'featured'];

function isOverlayContext(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('mode') === 'overlay';
}

function triggerLivePageElement(icId: string, mode: 'click' | 'scroll'): void {
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    window.parent.postMessage(
      { type: 'INFINITE_CANVAS_ACTIVATE_ELEMENT', icId, mode },
      '*'
    );
  }
}

function WebsiteNodeComponent({ id, data, selected }: NodeProps<WebsiteFlowNode>) {
  const updateWebsiteCard = useWorkspaceStore((s) => s.updateWebsiteCard);
  const duplicateWebsiteCard = useWorkspaceStore((s) => s.duplicateWebsiteCard);
  const deleteWebsiteCard = useWorkspaceStore((s) => s.deleteWebsiteCard);

  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);

  const [draftTitle, setDraftTitle] = useState(data.title);
  const [draftDescription, setDraftDescription] = useState(data.description);
  const [draftTag, setDraftTag] = useState('');

  const colorMeta = CARD_COLOR_META[data.color ?? 'default'] ?? CARD_COLOR_META.default;
  const variant = data.variant ?? 'standard';
  const overlayMode = isOverlayContext();
  const actions = data.actions ?? [];
  const hasActions = actions.length > 0;
  const isSectionCard = Boolean(data.icTargetId) || Boolean(data.sectionKind);

  const startEditing = () => {
    setDraftTitle(data.title);
    setDraftDescription(data.description);
    setIsEditing(true);
    setShowColorPicker(false);
  };

  const commitEdits = () => {
    const trimmedTitle = draftTitle.trim();
    updateWebsiteCard(id, {
      title: trimmedTitle || data.domain,
      description: draftDescription.trim(),
    });
    setIsEditing(false);
  };

  const handleAddTag = () => {
    const clean = draftTag.trim().slice(0, 28);
    if (!clean) return;
    if (!data.tags.includes(clean)) {
      updateWebsiteCard(id, { tags: [...data.tags, clean].slice(0, 12) });
    }
    setDraftTag('');
    setShowTagInput(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    updateWebsiteCard(id, { tags: data.tags.filter((t) => t !== tagToRemove) });
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Escape') {
      setShowTagInput(false);
      setDraftTag('');
    }
  };

  const cycleVariant = () => {
    const idx = VARIANT_CYCLE.indexOf(variant);
    const next = VARIANT_CYCLE[(idx + 1) % VARIANT_CYCLE.length]!;
    updateWebsiteCard(id, { variant: next });
  };

  const handleOpenOrFocus = () => {
    if (overlayMode && data.icTargetId) {
      triggerLivePageElement(data.icTargetId, 'scroll');
      return;
    }
    void openExternalUrl(data.url);
  };

  return (
    <div
      className={`group relative flex h-full w-full min-w-[240px] flex-col rounded-xl bg-[#12141b]/95 border transition-shadow duration-150 ${
        selected
          ? 'border-indigo-400/90 shadow-[0_0_0_2px_rgba(129,140,248,0.22),0_16px_40px_rgba(0,0,0,0.65)]'
          : `${colorMeta.border} shadow-[0_10px_32px_rgba(0,0,0,0.52)] hover:border-[#434c62]`
      }`}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={variant === 'compact' ? 96 : 148}
        maxWidth={760}
      />

      {/* Connection Handles (All 4 sides) */}
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!opacity-0 group-hover:!opacity-100 !transition-opacity"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!opacity-0 group-hover:!opacity-100 !transition-opacity"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!opacity-0 group-hover:!opacity-100 !transition-opacity"
      />
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="!opacity-0 group-hover:!opacity-100 !transition-opacity"
      />

      {/* Floating Quick Action Bar */}
      <div
        className={`nodrag nopan absolute -top-9 right-0 flex items-center gap-0.5 rounded-lg border border-[#2c313d] bg-[#141720]/95 px-1 py-1 shadow-lg transition-opacity duration-150 ${
          selected || showColorPicker
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
        }`}
      >
        <button
          type="button"
          onClick={handleOpenOrFocus}
          title={overlayMode && data.icTargetId ? 'Jump to section on page' : 'Open website'}
          className="rounded p-1.5 text-[#9aa2b1] hover:bg-[#252a35] hover:text-white transition-colors cursor-pointer"
        >
          {overlayMode && data.icTargetId ? (
            <Crosshair className="w-3.5 h-3.5" />
          ) : (
            <ExternalLink className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={startEditing}
          title="Edit title and notes"
          className="rounded p-1.5 text-[#9aa2b1] hover:bg-[#252a35] hover:text-white transition-colors cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setShowColorPicker((v) => !v)}
          title="Change card color"
          className="rounded p-1.5 text-[#9aa2b1] hover:bg-[#252a35] hover:text-white transition-colors cursor-pointer"
        >
          <Palette className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={cycleVariant}
          title={`Card layout: ${variant}`}
          className="rounded p-1.5 text-[#9aa2b1] hover:bg-[#252a35] hover:text-white transition-colors cursor-pointer"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => duplicateWebsiteCard(id)}
          title="Duplicate card"
          className="rounded p-1.5 text-[#9aa2b1] hover:bg-[#252a35] hover:text-white transition-colors cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <div className="mx-0.5 h-3.5 w-px bg-[#2b303c]" />
        <button
          type="button"
          onClick={() => deleteWebsiteCard(id)}
          title="Delete card"
          className="rounded p-1.5 text-[#9aa2b1] hover:bg-rose-500/15 hover:text-rose-400 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Color Picker Popover */}
      {showColorPicker && (
        <div className="nodrag nopan absolute -top-[74px] right-0 z-30 flex items-center gap-1.5 rounded-lg border border-[#303645] bg-[#181b22] px-2.5 py-2 shadow-xl">
          {COLOR_KEYS.map((colorKey) => {
            const meta = CARD_COLOR_META[colorKey];
            const active = data.color === colorKey;
            return (
              <button
                key={colorKey}
                type="button"
                onClick={() => {
                  updateWebsiteCard(id, { color: colorKey });
                  setShowColorPicker(false);
                }}
                title={meta.label}
                className={`h-4 w-4 rounded-full transition-transform cursor-pointer ${
                  active
                    ? 'scale-125 ring-2 ring-white/70 ring-offset-1 ring-offset-[#181b22]'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: meta.dot }}
              />
            );
          })}
        </div>
      )}

      {/* Window-style Top Header Bar (matches Image 2 aesthetic) */}
      <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-[#222633] bg-[#171a23] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Favicon src={data.favicon} url={data.url} domain={data.domain} size={15} />
          <span className="truncate text-[11px] font-medium text-[#cfd5e2]">
            {data.title}
          </span>
        </div>
        <span className="shrink-0 text-[9.5px] font-medium uppercase tracking-wider text-[#6f788d]">
          {data.isCentral
            ? 'PAGE HUB'
            : data.sectionKind
              ? data.sectionKind
              : formatShortDate(data.capturedAt)}
        </span>
      </div>

      {/* Crisp Visual Screenshot of this Website Section! */}
      {data.screenshot && variant !== 'compact' && (
        <button
          type="button"
          onClick={handleOpenOrFocus}
          title={overlayMode && data.icTargetId ? `Jump to ${data.title} on page` : `Open ${data.url}`}
          className={`nodrag relative block w-full overflow-hidden border-b border-[#222633] bg-[#0a0c11] text-left cursor-pointer ${
            variant === 'featured' ? 'h-48' : 'h-32'
          }`}
        >
          <img
            src={data.screenshot}
            alt={data.title}
            draggable={false}
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.015]"
          />
        </button>
      )}

      {/* Card Body: Edit Mode OR Live Interactive Buttons + Metadata */}
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        {isEditing ? (
          <div className="nodrag nopan flex flex-col gap-2">
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdits();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              autoFocus
              placeholder="Title"
              className="w-full rounded-md border border-[#353b4a] bg-[#0f1116] px-2.5 py-1.5 text-xs font-medium text-[#eceef2] outline-none focus:border-indigo-400"
            />
            <textarea
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              rows={3}
              placeholder="Add notes..."
              className="w-full resize-none rounded-md border border-[#353b4a] bg-[#0f1116] px-2.5 py-1.5 text-xs text-[#c6cbd6] outline-none focus:border-indigo-400"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-md px-2 py-1 text-[11px] text-[#8f97a8] hover:bg-[#232732] hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitEdits}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-500/90 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 cursor-pointer"
              >
                <Check className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            {data.description && (!data.screenshot || data.isCentral) && (
              <p
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditing();
                }}
                className="text-[11px] leading-relaxed text-[#929bad] line-clamp-3"
              >
                {data.description}
              </p>
            )}

            {/* Real Interactive Buttons & Links from this Website Section */}
            {hasActions && (
              <div className="nodrag nopan flex flex-wrap gap-1.5">
                {actions.slice(0, 8).map((action) => (
                  <button
                    key={action.icId}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (overlayMode) {
                        triggerLivePageElement(action.icId, data.isCentral ? 'scroll' : 'click');
                      } else if (action.href) {
                        void openExternalUrl(action.href);
                      }
                    }}
                    title={
                      overlayMode
                        ? data.isCentral
                          ? `Jump to "${action.label}" on page`
                          : `Click "${action.label}" on live page`
                        : action.label
                    }
                    className={`inline-flex max-w-[165px] items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors cursor-pointer ${
                      action.kind === 'button'
                        ? 'border-amber-400/35 bg-amber-500/12 text-amber-100 hover:border-amber-300 hover:bg-amber-500/28 hover:text-white'
                        : action.kind === 'input'
                          ? 'border-indigo-400/35 bg-indigo-500/15 text-indigo-100 hover:bg-indigo-500/30'
                          : 'border-[#2d3446] bg-[#181c27] text-[#c3cbe0] hover:border-sky-400/60 hover:bg-sky-500/20 hover:text-white'
                    }`}
                  >
                    {action.kind === 'button' ? (
                      <MousePointerClick className="h-2.5 w-2.5 shrink-0 opacity-80" />
                    ) : action.kind === 'input' ? (
                      <TextCursorInput className="h-2.5 w-2.5 shrink-0 opacity-80" />
                    ) : (
                      <Link2 className="h-2.5 w-2.5 shrink-0 opacity-80" />
                    )}
                    <span className="truncate">{action.label}</span>
                  </button>
                ))}
                {actions.length > 8 && (
                  <span className="inline-flex items-center rounded-md bg-[#1a1f2b] px-1.5 py-1 text-[9.5px] text-[#838ca2]">
                    +{actions.length - 8}
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer Tags + Live Page Action */}
        <div className="nodrag nopan mt-auto flex items-center justify-between gap-2 border-t border-[#1e222e] pt-2">
          <div className="flex flex-wrap items-center gap-1">
            {data.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded bg-[#1b1f2b] px-1.5 py-0.5 text-[9.5px] font-medium text-[#9aa3b8]"
              >
                <span>{tag}</span>
                {!isSectionCard && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-[#70798d] hover:text-white cursor-pointer"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            ))}

            {showTagInput ? (
              <input
                type="text"
                value={draftTag}
                onChange={(e) => setDraftTag(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => {
                  if (draftTag.trim()) {
                    handleAddTag();
                  } else {
                    setShowTagInput(false);
                  }
                }}
                autoFocus
                placeholder="tag..."
                className="w-16 rounded border border-indigo-400/60 bg-[#0f1116] px-1.5 py-0.5 text-[9.5px] text-[#eceef2] outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowTagInput(true)}
                className="inline-flex items-center gap-0.5 rounded border border-dashed border-[#2f3543] px-1.5 py-0.5 text-[9.5px] text-[#727a8c] opacity-0 group-hover:opacity-100 hover:border-[#4b5368] hover:text-[#b8c0cf] transition-opacity cursor-pointer"
              >
                <Plus className="w-2.5 h-2.5" />
                Tag
              </button>
            )}
          </div>

          {overlayMode && data.icTargetId && (
            <button
              type="button"
              onClick={handleOpenOrFocus}
              className="inline-flex shrink-0 items-center gap-1 rounded bg-[#1b2030] px-2 py-0.5 text-[9.5px] font-medium text-indigo-300 hover:bg-indigo-500 hover:text-white transition-colors cursor-pointer"
            >
              <Crosshair className="w-2.5 h-2.5" />
              Go to Section
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const WebsiteNode = memo(WebsiteNodeComponent);
