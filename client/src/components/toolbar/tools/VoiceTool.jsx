import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import ActionButtonBase from './ActionButtonBase';
import useTutorStore from '../../../store/tutorStore';

const VoiceTool = (props) => {
  const { voiceEnabled, toggleVoice } = useTutorStore();

  return (
    <ActionButtonBase
      {...props}
      icon={voiceEnabled ? Volume2 : VolumeX}
      label={voiceEnabled ? "Voice ON" : "Voice OFF"}
      onClick={toggleVoice}
      isActive={voiceEnabled}
      activeColor="var(--accent-primary)"
    />
  );
};

export default VoiceTool;
