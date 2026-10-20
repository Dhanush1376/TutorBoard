import { User, Shield, Palette, Key, Info } from 'lucide-react';
import { BASE_URL as API_URL_IMPORT } from '../../services/api';

export const API_URL = API_URL_IMPORT;

// Each section gets its own coloured tile so it can be recognised at a glance.
export const SECTIONS = [
  { id: 'general', label: 'Profile', icon: User, title: 'Profile', tint: '#0a84ff' },
  { id: 'appearance', label: 'Appearance', icon: Palette, title: 'Appearance', tint: '#bf5af2' },
  { id: 'account', label: 'Account', icon: Shield, title: 'Account', tint: '#30b158' },
  { id: 'ai', label: 'API keys', icon: Key, title: 'API keys', tint: '#ff9f0a' },
  { id: 'about', label: 'About', icon: Info, title: 'About', tint: '#8e8e93' },
];
