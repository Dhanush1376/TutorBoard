import { 
  User, Shield, Palette, Key, Info 
} from 'lucide-react';
import { BASE_URL as API_URL_IMPORT } from '../../services/api';

export const API_URL = API_URL_IMPORT;

export const SECTIONS = [
  { id: 'general', label: 'General', icon: User },
  { id: 'account', label: 'Account', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'ai', label: 'API Configuration', icon: Key },
  { id: 'about', label: 'About', icon: Info },
];
