import React from 'react';
import useTutorStore from '../../store/tutorStore';
import ExplainSolutionOverlay from '../canvas/ExplainSolutionOverlay';
import SettingsModal from '../settings/SettingsModal';
import CodeVisualizerModal from '../canvas/CodeVisualizerModal';

const GlobalOverlayManager = () => {
  const { activeOverlay, setOverlay } = useTutorStore();

  const closeOverlay = () => setOverlay(null);

  return (
    <>
      <ExplainSolutionOverlay 
        isOpen={activeOverlay === 'scene-visualizer'} 
        onClose={closeOverlay} 
      />
      <CodeVisualizerModal />
      <SettingsModal 
        isOpen={activeOverlay === 'settings'} 
        onClose={closeOverlay} 
      />
    </>
  );
};

export default GlobalOverlayManager;
