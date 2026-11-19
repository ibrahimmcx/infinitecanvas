import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  FolderPlus,
  GitBranch,
  Layers,
  MousePointerClick,
  Move,
  X,
} from 'lucide-react';
import { useWorkspaceStore } from '@/canvas/store/useWorkspaceStore';

const SUGGESTED_CANVASES = [
  'Competitor Research',
  'Design Inspiration',
  'Development Resources',
  'Product Research',
  'Personal Ideas',
];

const STEPS = [
  {
    id: 'intro',
    icon: Layers,
    title: 'Welcome to Infinite Canvas',
    subtitle: 'A visual spatial workspace for the web',
    description:
      'Instead of burying websites in nested bookmark folders, arrange pages spatially on an infinite canvas. Everything stays 100% local in your browser.',
  },
  {
    id: 'capture',
    icon: MousePointerClick,
    title: 'Capture Websites in One Click',
    subtitle: 'Popup, Side Panel, or Right-Click',
    description:
      'Click the Infinite Canvas toolbar icon (or press Alt+Shift+C) to capture the active tab with optional screenshot thumbnails. You can also right-click any page or link to send it straight to a canvas.',
  },
  {
    id: 'arrange',
    icon: Move,
    title: 'Drag, Resize & Style Cards',
    subtitle: 'Organize ideas spatially',
    description:
      'Drag website cards freely anywhere on the canvas. Select a card to resize it, double-click to edit notes, add tags, switch layouts, or apply muted accent colors.',
  },
  {
    id: 'connect',
    icon: GitBranch,
    title: 'Connect Related Websites',
    subtitle: 'Map relationships visually',
    description:
      'Hover over any card edge to reveal connection handles. Drag from one card to another to draw a link, then select the edge to add labels or toggle animated flow.',
  },
  {
    id: 'navigate',
    icon: Compass,
    title: 'Fluid Pan, Zoom & Shortcuts',
    subtitle: 'Built for speed',
    description:
      'Scroll to zoom, hold Space + Drag to pan, or drag-select multiple cards. Press Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z to redo, Delete to remove selected items, and Ctrl/Cmd+S to save.',
  },
  {
    id: 'create',
    icon: FolderPlus,
    title: 'Create Your First Canvas',
    subtitle: 'Give your workspace a name',
    description:
      'Choose a starter name below or enter your own. You can create as many independent canvases as you like from the sidebar.',
  },
];

export function OnboardingModal() {
  const showOnboarding = useWorkspaceStore((s) => s.showOnboarding);
  const completeOnboarding = useWorkspaceStore((s) => s.completeOnboarding);
  const createCanvas = useWorkspaceStore((s) => s.createCanvas);
  const canvases = useWorkspaceStore((s) => s.canvases);
  const updateCanvasMeta = useWorkspaceStore((s) => s.updateCanvasMeta);

  const [stepIndex, setStepIndex] = useState(0);
  const [canvasName, setCanvasName] = useState('Design Inspiration');
  const [canvasDesc, setCanvasDesc] = useState('');

  if (!showOnboarding) return null;

  const step = STEPS[stepIndex]!;
  const Icon = step.icon;
  const isLastStep = stepIndex === STEPS.length - 1;

  const handleFinish = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = canvasName.trim();
    if (trimmed) {
      // If user only has the empty starter canvas, rename it cleanly instead of cluttering with an empty one
      if (
        canvases.length === 1 &&
        canvases[0]!.nodes.length === 0 &&
        canvases[0]!.name === 'My First Canvas'
      ) {
        updateCanvasMeta(canvases[0]!.id, trimmed, canvasDesc.trim());
      } else {
        createCanvas(trimmed, canvasDesc.trim());
      }
    }
    completeOnboarding();
    setStepIndex(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#2c3140] bg-[#14171f] shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="flex h-1 w-full bg-[#1e222d]">
          <div
            className="h-full bg-indigo-400 transition-all duration-200"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6">
          {/* Header */}
          <div className="mb-5 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/15 text-indigo-300">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
                  Step {stepIndex + 1} of {STEPS.length}
                </span>
                <h2 className="text-base font-semibold text-[#eceef2]">{step.title}</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={completeOnboarding}
              title="Skip onboarding"
              className="rounded-lg p-1.5 text-[#7a8396] hover:bg-[#222733] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="mb-2 text-xs font-medium text-[#cfd5e2]">{step.subtitle}</p>
          <p className="mb-5 text-xs leading-relaxed text-[#929bad]">{step.description}</p>

          {/* Visual / Interactive Area per Step */}
          {step.id === 'navigate' && (
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-[#242936] bg-[#0f1117] p-3 text-[11px]">
              <div className="flex items-center justify-between text-[#9aa2b1]">
                <span>Pan Canvas</span>
                <kbd className="rounded bg-[#1e222e] px-1.5 py-0.5 text-[10px] text-[#dfe3ec] border border-[#2f3545]">
                  Space + Drag
                </kbd>
              </div>
              <div className="flex items-center justify-between text-[#9aa2b1]">
                <span>Undo / Redo</span>
                <kbd className="rounded bg-[#1e222e] px-1.5 py-0.5 text-[10px] text-[#dfe3ec] border border-[#2f3545]">
                  Ctrl + Z / Shift+Z
                </kbd>
              </div>
              <div className="flex items-center justify-between text-[#9aa2b1]">
                <span>Select All</span>
                <kbd className="rounded bg-[#1e222e] px-1.5 py-0.5 text-[10px] text-[#dfe3ec] border border-[#2f3545]">
                  Ctrl + A
                </kbd>
              </div>
              <div className="flex items-center justify-between text-[#9aa2b1]">
                <span>Delete Selected</span>
                <kbd className="rounded bg-[#1e222e] px-1.5 py-0.5 text-[10px] text-[#dfe3ec] border border-[#2f3545]">
                  Delete
                </kbd>
              </div>
            </div>
          )}

          {isLastStep ? (
            <form onSubmit={handleFinish} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_CANVASES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCanvasName(preset)}
                    className={`rounded-md border px-2 py-1 text-[11px] transition-colors cursor-pointer ${
                      canvasName === preset
                        ? 'border-indigo-400/70 bg-indigo-500/20 text-indigo-200'
                        : 'border-[#2a2f3d] bg-[#191d27] text-[#9aa2b1] hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={canvasName}
                onChange={(e) => setCanvasName(e.target.value)}
                placeholder="Canvas name"
                className="w-full rounded-lg border border-[#303647] bg-[#0e1015] px-3 py-2 text-xs text-[#eceef2] outline-none focus:border-indigo-400"
              />
              <input
                type="text"
                value={canvasDesc}
                onChange={(e) => setCanvasDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-lg border border-[#303647] bg-[#0e1015] px-3 py-2 text-xs text-[#b5bdcc] outline-none focus:border-indigo-400"
              />

              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-[#9aa2b1] hover:bg-[#222733] hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-400 transition-colors cursor-pointer"
                >
                  Start Exploring
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={completeOnboarding}
                className="text-xs text-[#798296] hover:text-[#cfd5e2] cursor-pointer"
              >
                Skip guide
              </button>

              <div className="flex items-center gap-2">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#2c3140] px-3 py-1.5 text-xs text-[#b7bfce] hover:bg-[#1f2430] hover:text-white cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-400 transition-colors cursor-pointer"
                >
                  Next
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
