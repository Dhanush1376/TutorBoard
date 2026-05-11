import React from 'react';
import { motion } from 'framer-motion';

const StreamCursor = () => (
  <motion.span
    animate={{ opacity: [1, 0, 1] }}
    transition={{ duration: 0.8, repeat: Infinity, ease: 'steps(2)' }}
    className="inline-block ml-1 font-normal text-[var(--text-primary)]"
    style={{ verticalAlign: 'baseline', lineHeight: 1 }}
  >
    |
  </motion.span>
);

export default StreamCursor;
