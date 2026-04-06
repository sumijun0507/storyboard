export type Tool = 'pencil' | 'eraser' | 'select' | 'rect' | 'circle' | 'arrow' | 'text';

export interface ProjectSettings {
  title: string;
  purpose: string;
  target: string;
  totalDuration: number;
  format: string;
  brand: string;
  usp: string;
  cta: string;
  tonePreset: string;
  toneCustom: string;
  estimatedCuts: number | null;
  narration: 'yes' | 'no';
  bgmMood: string;
  notes: string;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  title: '',
  purpose: '',
  target: '',
  totalDuration: 30,
  format: '',
  brand: '',
  usp: '',
  cta: '',
  tonePreset: '',
  toneCustom: '',
  estimatedCuts: null,
  narration: 'no',
  bgmMood: '',
  notes: '',
};

export interface Element {
  id: string;
  type: Tool;
  points?: { x: number, y: number }[]; // for pencil
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  size: number; // line thickness
  scale?: number; // scaling factor
  text?: string;
  fontSize?: number;
  visible?: boolean;
}

export interface Frame {
  id: string;
  image: string; // Background image (base64)
  elements: Element[];
  dialogue: string;
  action: string;
  notes: string;
  duration: number; // in ms
  history: Element[][];
  historyIndex: number;
  shotSize: string;
  angle: string;
  cameraMove: string;
  sound: string;
  aiPrompt: string;
}

export interface CanvasState {
  color: string;
  size: number;
  tool: Tool;
}
