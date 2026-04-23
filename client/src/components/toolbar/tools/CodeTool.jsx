import { SquareCode } from 'lucide-react';
import ActionButtonBase from './ActionButtonBase';
import useTutorStore from '../../../store/tutorStore';

const CodeTool = (props) => {
  const { setCodeEditorOpen } = useTutorStore();

  const handleClick = () => {
    setCodeEditorOpen(true);
  };

  return (
    <ActionButtonBase
      {...props}
      icon={SquareCode}
      label="Code Editor"
      onClick={handleClick}
    />
  );
};

export default CodeTool;
