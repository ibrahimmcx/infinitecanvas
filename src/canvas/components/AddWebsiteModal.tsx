import { useState, type FormEvent } from 'react';
import { Globe, X } from 'lucide-react';
import { useWorkspaceStore } from '@/canvas/store/useWorkspaceStore';
import { CARD_COLOR_META, type CardColor } from '@/shared/types/canvas';
import { extractDomain, normalizeExternalUrl } from '@/shared/utils/url';

interface AddWebsiteModalProps {
  open: boolean;
  onClose: () => void;
  getPlacementPosition?: () => { x: number; y: number };
}

const COLORS: CardColor[] = ['default', 'indigo', 'emerald', 'amber', 'rose', 'sky', 'violet'];

export function AddWebsiteModal({
  open,
  onClose,
  getPlacementPosition,
}: AddWebsiteModalProps) {
  const addWebsiteCard = useWorkspaceStore((s) => s.addWebsiteCard);
  const notify = useWorkspaceStore((s) => s.notify);

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [color, setColor] = useState<CardColor>('default');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeExternalUrl(url);
    if (!normalized) {
      setError('Please enter a valid http:// or https:// website URL.');
      return;
    }

    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const created = addWebsiteCard({
      url: normalized,
      title: title.trim() || extractDomain(normalized),
      description: description.trim(),
      tags,
      color,
      position: getPlacementPosition?.(),
    });

    if (created) {
      notify(`Added "${created.data.title}"`);
      setUrl('');
      setTitle('');
      setDescription('');
      setTagsText('');
      setColor('default');
      setError(null);
      onClose();
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
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
              <Globe className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-[#eceef2]">Add Website Card</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#7f889b] hover:bg-[#232834] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#9aa2b1]">
              Website URL *
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://example.com"
              autoFocus
              className="w-full rounded-lg border border-[#2f3544] bg-[#0e1015] px-3 py-2 text-xs text-[#eceef2] placeholder-[#5e6678] outline-none focus:border-indigo-400"
            />
            {error && <p className="mt-1 text-[11px] text-rose-400">{error}</p>}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#9aa2b1]">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Leave blank to use domain name"
              className="w-full rounded-lg border border-[#2f3544] bg-[#0e1015] px-3 py-2 text-xs text-[#eceef2] placeholder-[#5e6678] outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#9aa2b1]">
              Notes / Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Why are you saving this page?"
              className="w-full resize-none rounded-lg border border-[#2f3544] bg-[#0e1015] px-3 py-2 text-xs text-[#eceef2] placeholder-[#5e6678] outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#9aa2b1]">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="research, inspiration, reference"
              className="w-full rounded-lg border border-[#2f3544] bg-[#0e1015] px-3 py-2 text-xs text-[#eceef2] placeholder-[#5e6678] outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-[#9aa2b1]">
              Card Accent
            </label>
            <div className="flex items-center gap-2">
              {COLORS.map((key) => {
                const meta = CARD_COLOR_META[key];
                const active = color === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setColor(key)}
                    title={meta.label}
                    className={`h-5 w-5 rounded-full transition-transform cursor-pointer ${
                      active
                        ? 'scale-115 ring-2 ring-white/75 ring-offset-2 ring-offset-[#151820]'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: meta.dot }}
                  />
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-[#9aa2b1] hover:bg-[#222733] hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-400 transition-colors cursor-pointer"
            >
              Add to Canvas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
