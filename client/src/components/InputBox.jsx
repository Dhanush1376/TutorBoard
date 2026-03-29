import React from 'react';
import { Send } from 'lucide-react';
import { cn } from '../lib/utils';

const InputBox = ({ value, onChange, onSubmit, isGenerating }) => {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim() && !isGenerating) onSubmit();
        }}
        className={cn(
          "relative flex items-center w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl px-3 py-2 transition-all duration-200",
          "focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:border-[var(--text-secondary)]",
          isGenerating && "opacity-60 pointer-events-none"
        )}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ask anything..."
          className="flex-1 bg-transparent border-none outline-none px-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-[15px] sm:text-base font-medium"
          disabled={isGenerating}
        />

        <button
          type="submit"
          disabled={isGenerating || !value.trim()}
          className={cn(
            "p-2.5 rounded-xl flex items-center justify-center transition-all duration-200",
            value.trim() && !isGenerating
              ? "bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 active:scale-95"
              : "bg-transparent text-[var(--text-secondary)]"
          )}
        >
          {isGenerating ? (
            <div className="w-5 h-5 border-2 border-[var(--border-color)] border-t-current rounded-full animate-spin" />
          ) : (
            <Send size={18} className="translate-x-[1px] translate-y-[-1px]" />
          )}
        </button>
      </form>
    </div>
  );
};

export default InputBox;
