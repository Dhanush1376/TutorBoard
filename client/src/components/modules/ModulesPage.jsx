import React, { useState } from 'react';
import { Search, Plus, LayoutDashboard } from 'lucide-react';
import { motion } from 'framer-motion';
import CreateModuleModal from './CreateModuleModal';

const ModulesPage = ({ customModules, setCustomModules, onLoadModule }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModules = customModules.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full h-full flex flex-col items-center bg-[var(--bg-primary)] overflow-y-auto font-sans pt-12 pb-24">
      <div className="w-full max-w-4xl px-8 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-serif font-bold text-[var(--text-primary)]">Learning Modules</h1>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[var(--text-primary)] text-[var(--bg-primary)] px-4 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            New module
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={18} />
          <input 
            type="text" 
            placeholder="Search modules..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl py-3 pl-12 pr-4 text-[15px] focus:outline-none focus:border-blue-500 transition-colors shadow-sm"
          />
        </div>

        {/* Sort */}
        <div className="flex justify-end mb-12">
          <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] border border-[var(--border-color)] px-4 py-2 rounded-lg bg-[var(--bg-primary)] cursor-pointer hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors shadow-sm">
            <span>Sort by</span>
            <span className="font-semibold text-[var(--text-primary)]">Activity</span>
          </div>
        </div>

        {/* Content Area */}
        {customModules.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center mt-12 text-center max-w-sm mx-auto"
          >
            <div className="mb-6 opacity-80">
              <LayoutDashboard size={56} className="text-[var(--text-primary)]" strokeWidth={1} />
            </div>
            <h2 className="text-[17px] font-semibold text-[var(--text-primary)] mb-3">Looking to start a module?</h2>
            <p className="text-[14px] text-[var(--text-secondary)] mb-8 leading-relaxed">
              Upload materials, set custom instructions, and organize conversations in one space.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-2 rounded-full text-sm font-semibold hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <Plus size={16} />
              New module
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredModules.map((mod, i) => (
              <motion.div 
                key={mod.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                onClick={() => onLoadModule(mod)}
                className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-secondary)] transition-all cursor-pointer group shadow-sm flex flex-col"
              >
                <div className="flex items-start justify-between mb-2">
                   <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-blue-500 transition-colors">{mod.title}</h3>
                </div>
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2 leading-relaxed flex-1">
                  {mod.description}
                </p>
                <div className="mt-6 text-[11px] font-medium text-[var(--text-tertiary)] tracking-wider">
                  Created {new Date(mod.createdAt).toLocaleDateString()}
                </div>
              </motion.div>
            ))}
          </div>
        )}

      </div>

      <CreateModuleModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={(newMod) => {
          setCustomModules([newMod, ...customModules]);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
};

export default ModulesPage;
