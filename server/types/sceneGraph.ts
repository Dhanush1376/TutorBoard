export interface SceneElement {
  id: string;               // stable, never changes
  type: 'node' | 'edge' | 'group' | 'label' | 'annotation';
  subtype?: string;         // 'service' | 'database' | 'user' | 'process' etc
  label: string;
  position: { x: number; y: number };
  dimensions?: { width: number; height: number };
  style: {
    fill?: string;
    stroke?: string;
    textColor?: string;
    fontSize?: number;
    fontWeight?: string;
    borderRadius?: number;
    opacity?: number;
    icon?: string;
  };
  data?: Record<string, unknown>;  // custom metadata
  parentId?: string;               // for groups
  tags?: string[];                 // semantic tags: ['database', 'auth', 'backend']
}

export interface SceneConnection {
  id: string;
  source: string;           // element id
  target: string;           // element id
  label?: string;
  style?: {
    strokeColor?: string;
    strokeWidth?: number;
    animated?: boolean;
    arrowType?: 'arrow' | 'none' | 'both';
  };
}

export interface SceneGraph {
  artifactId: string;
  artifactClass: string;
  title: string;
  elements: SceneElement[];
  connections: SceneConnection[];
  layout: {
    direction?: 'LR' | 'TB' | 'RL' | 'BT';
    spacing?: number;
    viewport?: { x: number; y: number; zoom: number };
  };
  theme: {
    background: string;
    fontFamily: string;
    primaryColor: string;
    accentColor: string;
  };
  metadata: Record<string, unknown>;
  version: number;
}
