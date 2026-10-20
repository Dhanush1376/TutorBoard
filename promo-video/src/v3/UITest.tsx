import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { AppCam } from './ui/AppCam';
import { LessonUI, LessonState } from './ui/LessonUI';
import { BubbleBoard } from './boards/BubbleBoard';
import { manifest } from '../lib/capture';

const lesson = manifest.data.lesson!;
export const step1: LessonState = {
  title: 'Bubble Sort Work on [5, 1, 4, 2, 8]',
  kind: 'ALGORITHM SESSION',
  guide: 'ALGORITHM GUIDE',
  steps: lesson.steps.map((s) => s.title),
  active: 0,
  explanation: lesson.steps[0].narration,
  playing: false,
  progress: 0.02,
  time: ['0:00', '0:32'],
  chatQuestion: manifest.question,
};

export const UITest: React.FC<{ variant?: string }> = ({ variant = 'step1' }) => {
  const frame = useCurrentFrame();
  const s: LessonState = variant === 'answer'
    ? { ...step1, active: 2, explanation: lesson.steps[2].narration, progress: 0.66, time: ['0:32', '0:32'], muted: true,
        question: { q: manifest.doubt, step: 3, answer: manifest.data.doubt!.answer, answerChars: 999, followUp: manifest.data.doubt!.followUp, in: 1 } }
    : variant === 'doubtbar'
      ? { ...step1, active: 2, progress: 0.66, time: ['0:32', '0:32'], muted: true, doubtOpen: 1, doubtText: manifest.doubt, caret: true }
      : step1;
  const values = variant === 'step1' ? [5, 1, 4, 2, 8] : [1, 4, 2, 5, 8];
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AppCam cam={{ x: 960, y: 540, z: 1 }} radius={0}>
        <LessonUI s={s} board={<BubbleBoard values={values} ops={[]} doubt={variant === 'answer' ? { slot: 3, at: frame - 100, calloutAt: frame - 100, text: 'larger than neighbors, bubbled right' } : undefined} />} />
      </AppCam>
    </AbsoluteFill>
  );
};
