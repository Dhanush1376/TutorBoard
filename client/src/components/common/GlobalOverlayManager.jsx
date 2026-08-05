import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import useTutorStore from '../../store/tutorStore';
import SettingsModal from '../settings/SettingsModal';
import CodeVisualizerModal from '../canvas/CodeVisualizerModal';
import GlobalStatusOverlay from '../layout/GlobalStatusOverlay';
import ThemedPopup from '../layout/ThemedPopup';

const GlobalOverlayManager = () => {
  const { 
    activeOverlay, setOverlay, 
    globalOverlay, globalAlert,
    guestTrialStatus 
  } = useTutorStore(useShallow(s => ({
    activeOverlay: s.activeOverlay,
    setOverlay: s.setOverlay,
    globalOverlay: s.globalOverlay,
    globalAlert: s.globalAlert,
    guestTrialStatus: s.guestTrialStatus
  })));

  const closeOverlay = () => setOverlay(null);

  // UX-09: Priority-based overlay rendering
  // Priority 2: Global Status (Error/Network/Sync)
  if (globalOverlay.isActive) {
    return <GlobalStatusOverlay />;
  }

  // Priority 3: Alerts/Popups
  if (globalAlert.isActive) {
    return <ThemedPopup />;
  }

  // Priority 4: Standard Modals
  return (
    <>
      <CodeVisualizerModal />
      <SettingsModal 
        isOpen={activeOverlay === 'settings'} 
        onClose={closeOverlay} 
      />
    </>
  );
};

export default GlobalOverlayManager;
