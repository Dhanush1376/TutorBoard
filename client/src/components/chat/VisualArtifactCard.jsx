import React from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import useTutorStore, { CANVAS_LAYOUT } from '../../store/tutorStore';
import { formatConciseTopic, isGenericTitle } from './message/MessageUtils';
import VisaiLogo from '../layout/VisaiLogo';

const CONFIGS = {
  cinematic:  { label: 'Interactive UI',     desc: 'Visual walkthrough', accent: '#ea580c' },
  d3:         { label: 'Concept Graph',      desc: 'Visual walkthrough', accent: '#fb923c' },
  physics:    { label: 'Simulation',        desc: 'Visual walkthrough', accent: '#f97316' },
  three:      { label: '3D Space',           desc: 'Visual walkthrough', accent: '#ea580c' },
  matter:     { label: 'Dynamics',           desc: 'Visual walkthrough', accent: '#fb923c' },
  algorithm:  { label: 'Logic Flow',         desc: 'Visual walkthrough', accent: '#f97316' },
  code:       { label: 'Source Code',        desc: 'Source code',        accent: '#ea580c' },
  'scene-v2': { label: 'Visual Lesson',      desc: 'Visual walkthrough', accent: '#fb923c' },
  default:    { label: 'Artifact',           desc: 'Visual walkthrough', accent: '#fb923c' },
};

/**
 * VisualArtifactCard — TutorBoard AI OS Visual Walkthrough Card.
 * Design matched to specification:
 * - TutorBoard logo in soft peach tile
 * - Bold title (e.g. Pythagoras) + clean "Visual walkthrough" subtitle (zero dots)
 * - Solid orange circular action button with Eye / EyeOff toggle
 */
const VisualArtifactCard = ({
  artifactId,
  artifactData,
  title,
  type = 'visual',
  rendererType = 'cinematic',
  status = 'completed',
  onOpenCanvas,
  messageId,
  onRetry,
}) => {
  const { openArtifactOnCanvas, setCanvasLayout, activeScene, canvasLayout } = useTutorStore();
  const activeSnapshotId = useTutorStore((state) => state.activeSnapshotId);
  const conversationTopic = useTutorStore((state) => state.conversationTopic);

  const artifact = useTutorStore(
    (state) => state.artifacts?.find((a) => a.id === artifactId || a.dbId === artifactId)
  ) || artifactData;

  const isPersisting = status === 'completed' && artifact && !artifact.dbId && !artifactData && artifactId;
  const isGenerating = status === 'generating';
  const isFailed     = status === 'failed';
  const isCancelled  = status === 'cancelled';
  const canOpen     = status === 'completed' && !isPersisting;

  const currentId    = artifact?.dbId || artifact?.id || artifactId || messageId || 'visual-sim';
  const isTitleMatch = activeScene?.title && (activeScene.title === (artifact?.title || title));
  const isActive     = ((activeScene?.id === currentId || isTitleMatch) || (messageId && activeSnapshotId === messageId)) && canvasLayout !== CANVAS_LAYOUT.INLINE;

  const cfgType  = (artifact?.metadata?.rendererType || artifact?.rendererType || rendererType || 'cinematic').toLowerCase();
  const cfg      = CONFIGS[cfgType] || CONFIGS.default;

  // Resolve clear, specific topic title (1-2 words max, zero dots)
  const rawCandidate = 
    (!isGenericTitle(artifact?.title) && artifact?.title) ||
    (!isGenericTitle(artifact?.timeline?.title) && artifact?.timeline?.title) ||
    (!isGenericTitle(artifact?.data?.title) && artifact?.data?.title) ||
    (!isGenericTitle(artifact?.sceneV2?.title) && artifact?.sceneV2?.title) ||
    (!isGenericTitle(artifact?.metadata?.title) && artifact?.metadata?.title) ||
    (!isGenericTitle(artifact?.metadata?.artifactTitle) && artifact?.metadata?.artifactTitle) ||
    (!isGenericTitle(activeScene?.title) && activeScene?.title) ||
    (!isGenericTitle(title) && title) ||
    (!isGenericTitle(conversationTopic) && conversationTopic) ||
    'Visual';

  const displayTitle = (formatConciseTopic(rawCandidate, 'Visual') || 'Visual').replace(/\.+/g, '').trim();

  // Subtitle strictly cleaned so it never ends with "..."
  // short enough to fit beside the card's button (the subtitle never wraps)
  const rawDesc = isGenerating
    ? 'Preparing visual'
    : isFailed
      ? "Visual didn't build"
      : isCancelled
        ? 'Visual stopped'
        : (cfg.desc || 'Visual walkthrough');
  const cleanDesc = rawDesc.replace(/\.+/g, '').trim();

  const handleToggle = React.useCallback((e) => {
    e?.stopPropagation();
    if (!canOpen) return;

    if (isActive) {
      setCanvasLayout(CANVAS_LAYOUT.INLINE);
      useTutorStore.getState().setActiveSnapshotId?.(null);
    } else {
      const store = useTutorStore.getState();
      const msg = store.conversationMessages?.find(m => m.id?.toString() === messageId?.toString() || m._id?.toString() === messageId?.toString());
      const latestArtifact = store.artifacts?.find((a) => a.id === artifactId || a.dbId === artifactId || a.id === `art-${artifactId}` || a._id === artifactId) || artifact || msg?.canvasSnapshot || msg?.metadata?.visuals;

      const rawSceneV2 = latestArtifact?.sceneV2 || latestArtifact?.visuals?.sceneV2 || latestArtifact?.metadata?.sceneV2 || latestArtifact?.sceneGraph?.sceneV2 || latestArtifact?.canvasSnapshot?.sceneV2 || msg?.canvasSnapshot?.sceneV2 || msg?.metadata?.visuals?.sceneV2;

      const resolvedRenderer = (latestArtifact?.metadata?.rendererType || latestArtifact?.rendererType || msg?.metadata?.rendererType || msg?.canvasType || (rawSceneV2 ? 'scene-v2' : rendererType) || 'cinematic').toLowerCase();

      if (onOpenCanvas && messageId) {
        onOpenCanvas(messageId);
      }
      // onOpenCanvas loaded this message's lesson (restored to the saved step)
      const s = useTutorStore.getState();
      const alreadyLoaded = !!messageId && s.activeSnapshotId === messageId && !!s.activeScene;

      openArtifactOnCanvas({
        alreadyLoaded,
        id: currentId,
        title: title || latestArtifact?.title || msg?.canvasSnapshot?.title || cfg.label,
        type: latestArtifact?.type || type,
        rendererType: resolvedRenderer,
        sceneV2: rawSceneV2,
        sceneGraph: latestArtifact?.sceneGraph,
        metadata: latestArtifact?.metadata || msg?.metadata,
        canvasSnapshot: latestArtifact?.canvasSnapshot || msg?.canvasSnapshot,
        content: latestArtifact?.content || rawSceneV2 || latestArtifact?.visual_steps || latestArtifact?.animation_steps || latestArtifact?.timeline || latestArtifact?.narrations || latestArtifact?.steps || latestArtifact?.script || latestArtifact?.canvasSteps || latestArtifact?.canvasObjects || msg?.metadata?.visuals || (latestArtifact?.script ? latestArtifact.script : (Array.isArray(latestArtifact) ? latestArtifact : [])),
      });
    }
  }, [canOpen, isActive, currentId, title, cfg.label, type, rendererType, artifactId, artifact, onOpenCanvas, messageId, openArtifactOnCanvas, setCanvasLayout]);

  // Auto-open visual canvas when generation completes if not already active
  const prevStatusRef = React.useRef(status);
  React.useEffect(() => {
    if (prevStatusRef.current === 'generating' && status === 'completed' && !isActive) {
      handleToggle();
    }
    prevStatusRef.current = status;
  }, [status, isActive, handleToggle]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="w-full my-2"
    >
      <div
        onClick={handleToggle}
        // a button only when it can open/close the lesson (never around the Try again button)
        role={canOpen || isActive ? 'button' : undefined}
        tabIndex={canOpen || isActive ? 0 : undefined}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}
        aria-busy={isGenerating || undefined}
        title={isActive ? 'Active on canvas — click to close' : canOpen ? 'Click to open visual walkthrough' : rawDesc}
        className={`group relative cursor-pointer overflow-hidden rounded-[26px] transition-all duration-200 select-none bg-zinc-900 dark:bg-white ${
          isActive 
            ? 'border-2 border-[#ea580c] shadow-[0_3px_16px_rgba(234,88,12,0.18)] ring-1 ring-[#ea580c]/30' 
            : 'border border-zinc-800/80 dark:border-zinc-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-zinc-700 dark:hover:border-zinc-300'
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-4 sm:py-3">
          {/* Left: TutorBoard Logo & Title/Subtitle */}
          <div className="flex items-center gap-3 min-w-0">
            <VisaiLogo size={36} className="text-white dark:text-zinc-900 shrink-0 transition-colors" />

            {/* Middle: Title & Subtitle with neat vertical alignment */}
            <div className="flex flex-col justify-center min-w-0">
              <span 
                className="text-[14.5px] font-bold tracking-tight text-white dark:text-zinc-900 !leading-tight whitespace-nowrap overflow-hidden transition-colors !m-0 !p-0 block"
                style={{ textOverflow: 'clip' }}
              >
                {displayTitle}
              </span>
              <span 
                className={`text-[12px] font-normal !leading-tight whitespace-nowrap overflow-hidden block !m-0 !p-0 mt-0.5 ${
                  isActive 
                    ? 'text-[#ea580c] font-medium' 
                    : 'text-zinc-400 dark:!text-zinc-500'
                }`}
                style={{ textOverflow: 'clip' }}
              >
                {isActive ? 'Viewing on canvas' : cleanDesc}
              </span>
            </div>
          </div>

          {/* Right: Symmetrically Aligned Toggle Button */}
          {isFailed && onRetry ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRetry(); }}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[12px] font-semibold bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-[#ea580c] hover:text-white hover:border-[#ea580c] dark:bg-zinc-100 dark:text-zinc-700 dark:border-zinc-200 transition-colors"
              aria-label="Try the visualization again"
            >
              <RotateCcw size={13} strokeWidth={2.2} aria-hidden="true" />
              Try again
            </button>
          ) : (
          <div className="shrink-0 flex items-center">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
                !canOpen && !isActive
                  ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 opacity-60 dark:bg-zinc-100 dark:text-zinc-400 dark:border-zinc-200'
                  : isActive
                  ? 'bg-[#ea580c] text-white shadow-[0_2px_8px_rgba(234,88,12,0.4)]'
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-[#ea580c] hover:text-white hover:border-[#ea580c] dark:bg-zinc-100 dark:text-zinc-700 dark:border-zinc-200 dark:hover:bg-[#ea580c] dark:hover:text-white dark:hover:border-[#ea580c]'
              }`}
            >
              {isActive ? (
                <EyeOff size={15} strokeWidth={2.2} />
              ) : (
                <Eye size={15} strokeWidth={2} />
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default VisualArtifactCard;