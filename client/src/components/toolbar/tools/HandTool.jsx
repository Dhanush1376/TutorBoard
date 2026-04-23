import React from 'react';
import { MousePointer2 } from 'lucide-react';
import useTutorStore from '../../../store/tutorStore';
import ToolButtonBase from './ToolButtonBase';

const HandTool = ({ closeMenu, ...props }) => {
  const { activeTool, setActiveTool } = useTutorStore();

  const handleMainClick = () => {
    setActiveTool('select');
  };

  const isActive = activeTool === 'select' || activeTool === 'hand';

  return (
    <ToolButtonBase
      {...props}
      id="hand"
      icon={MousePointer2}
      label="Select"
      onClick={handleMainClick}
      isActive={isActive}
    />
  );
};

export default HandTool;
