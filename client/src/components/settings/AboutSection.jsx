import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, Shield, Activity, Globe, Cpu, Layers, Sparkles, 
  Info, ExternalLink, MessageCircle, FileText, Code
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import VisaiLogo from '../layout/VisaiLogo';
import { SectionTitle, SettingsGroup, SettingsRow } from './SettingsShared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function AboutSection() {
  const { token } = useAuth();
  const [systemStatus, setSystemStatus] = useState({ api: 'checking', db: 'checking', engine: 'online' });

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/api/test`, { headers: { 'Authorization': `Bearer ${token}` } });
        setSystemStatus(prev => ({ ...prev, api: res.ok ? 'online' : 'offline', db: res.ok ? 'online' : 'offline' }));
      } catch (e) { setSystemStatus(prev => ({ ...prev, api: 'offline', db: 'offline' })); }
    };
    if (token) check();
  }, [token]);

  const StatusBadge = ({ status }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ 
        width: '8px', height: '8px', borderRadius: '50%', 
        background: status === 'online' ? '#10b981' : status === 'offline' ? '#ef4444' : '#fbbf24' 
      }} />
      <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {status.toUpperCase()}
      </span>
    </div>
  );

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '120px' }}>
      {/* Mobile-style Header */}
      <div style={{ textAlign: 'center', padding: '40px 0 32px' }}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }}
          style={{ 
            width: '80px', height: '80px', borderRadius: '22px', background: 'var(--text-primary)', 
            margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
          }}
        >
          <VisaiLogo size="md" className="text-[var(--bg-primary)]" />
        </motion.div>
        <h1 style={{ fontSize: '24px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px' }}>TutorBoard AI</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: 0 }}>Version 2.1.0 (Cinematic)</p>
      </div>

      <SectionTitle>General Information</SectionTitle>
      <SettingsGroup>
        <SettingsRow 
          icon={Activity} 
          label="Model Name" 
          rightElement={<span style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>TutorBoard Pro</span>} 
        />
        <SettingsRow 
          icon={Zap} 
          label="Build Number" 
          rightElement={<span style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>TB-2026-0422-REL</span>} 
        />
        <SettingsRow 
          icon={Globe} 
          label="Network" 
          rightElement={<span style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Global Edge Relay</span>} 
          borderBottom={false}
        />
      </SettingsGroup>

      <SectionTitle>Technological Core</SectionTitle>
      <SettingsGroup>
        <SettingsRow 
          icon={Cpu} 
          label="Pedagogical Engine" 
          description="Context-aware reasoning and adaptive learning paths."
        />
        <SettingsRow 
          icon={Layers} 
          label="Infinite Canvas" 
          description="Hardware-accelerated visual brainstorming environment."
        />
        <SettingsRow 
          icon={Shield} 
          label="Hardened Security" 
          description="Zero-trust architecture with end-to-end encryption."
          borderBottom={false}
        />
      </SettingsGroup>

      <SectionTitle>System Status</SectionTitle>
      <SettingsGroup>
        <SettingsRow 
          icon={Code} 
          label="API Service" 
          rightElement={<StatusBadge status={systemStatus.api} />} 
        />
        <SettingsRow 
          icon={Shield} 
          label="Database Cluster" 
          rightElement={<StatusBadge status={systemStatus.db} />} 
        />
        <SettingsRow 
          icon={Sparkles} 
          label="AI Reasoning Engine" 
          rightElement={<StatusBadge status={systemStatus.engine} />} 
          borderBottom={false}
        />
      </SettingsGroup>

      <SectionTitle>Support & Legal</SectionTitle>
      <SettingsGroup>
        <SettingsRow 
          icon={FileText} 
          label="Documentation" 
          onClick={() => window.open('https://docs.tutorboard.ai', '_blank')}
        />
        <SettingsRow 
          icon={MessageCircle} 
          label="Join Discord Community" 
          onClick={() => window.open('https://discord.gg/tutorboard', '_blank')}
        />
        <SettingsRow 
          icon={Info} 
          label="Privacy Policy" 
          onClick={() => {}}
          borderBottom={false}
        />
      </SettingsGroup>

      <div style={{ textAlign: 'center', marginTop: '32px' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', opacity: 0.6 }}>
          &copy; 2026 TutorBoard AI. All rights reserved.
        </p>
      </div>
    </div>
  );
}
