import { SquareCode } from 'lucide-react';
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
      icon={SquareCode}
      label="Visualizer"
      onClick={handleClick}
    />
  );
};

export default VisualizerTool;
