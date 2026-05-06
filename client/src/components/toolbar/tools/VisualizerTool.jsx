import { Activity } from 'lucide-react';
import ActionButtonBase from './ActionButtonBase';
import useTutorStore from '../../../store/tutorStore';

const VisualizerTool = (props) => {
  const { setCodeEditorOpen } = useTutorStore();

  const handleClick = () => {
    setCodeEditorOpen(true);
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
