import { Activity } from 'lucide-react';
import ActionButtonBase from './ActionButtonBase';
import useTutorStore from '../../../store/tutorStore';

const VisualizerTool = (props) => {
  const { setVisualizerOpen } = useTutorStore();

  const handleClick = () => {
    setVisualizerOpen(true);
  };

  return (
    <ActionButtonBase
      {...props}
      icon={Activity}
      label="Explain Solution"
      onClick={handleClick}
    />
  );
};

export default VisualizerTool;
