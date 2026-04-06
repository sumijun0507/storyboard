<<<<<<< HEAD
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Download,
  Undo2,
  Redo2,
  Pencil,
  Eraser,
  Type,
  Settings,
  Layers,
  Image as ImageIcon,
  MousePointer2,
  Square,
  Circle,
  ArrowRight,
  Type as TextIcon,
  GripVertical,
  Eye,
  EyeOff,
  Layers as LayersIcon,
  Save,
  FolderOpen,
  Copy,
  Sparkles,
  Settings2,
} from 'lucide-react';
import SettingsPage from './SettingsPage';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { v4 as uuidv4 } from 'uuid';
import { cn } from './lib/utils';
import { Frame, Tool, Element, ProjectSettings, DEFAULT_PROJECT_SETTINGS } from './types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DEFAULT_FRAME_DURATION = 2000;
const STORAGE_KEY = 'storyboarder-project';

const DEFAULT_FRAME: Frame = {
  id: '1',
  image: '',
  elements: [],
  dialogue: '',
  action: '',
  notes: '',
  duration: DEFAULT_FRAME_DURATION,
  history: [[]],
  historyIndex: 0,
  shotSize: '指定なし',
  angle: '指定なし',
  cameraMove: '指定なし',
  sound: '',
  aiPrompt: '',
};

const stripHistory = (frames: Frame[]) =>
  frames.map(f => ({ ...f, history: [[...f.elements]], historyIndex: 0 }));

const restoreFrames = (data: any[]): Frame[] =>
  data.map(f => ({
    id: f.id || crypto.randomUUID(),
    image: f.image || '',
    elements: f.elements || [],
    dialogue: f.dialogue || '',
    action: f.action || '',
    notes: f.notes || '',
    duration: f.duration || DEFAULT_FRAME_DURATION,
    shotSize: f.shotSize || '指定なし',
    angle: f.angle || '指定なし',
    cameraMove: f.cameraMove || '指定なし',
    sound: f.sound || '',
    aiPrompt: f.aiPrompt || '',
    history: [f.elements || []],
    historyIndex: 0,
  }));

const loadFromStorage = (): { settings: ProjectSettings; frames: Frame[] } => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { settings: DEFAULT_PROJECT_SETTINGS, frames: [{ ...DEFAULT_FRAME }] };
    const parsed = JSON.parse(saved);
    // Old format: plain array of frames
    if (Array.isArray(parsed)) {
      return { settings: DEFAULT_PROJECT_SETTINGS, frames: restoreFrames(parsed) };
    }
    // New format: { version, settings, frames }
    return {
      settings: { ...DEFAULT_PROJECT_SETTINGS, ...(parsed.settings || {}) },
      frames: restoreFrames(parsed.frames || [{ ...DEFAULT_FRAME }]),
    };
  } catch {
    return { settings: DEFAULT_PROJECT_SETTINGS, frames: [{ ...DEFAULT_FRAME }] };
  }
};

const SHOT_SIZES = [
  "指定なし",
  "ELS｜エクストリーム・ロングショット",
  "LS｜ロングショット",
  "FS｜フルショット",
  "KS｜ニー・ショット（アメリカン）",
  "WS｜ウエスト・ショット",
  "BS｜バスト・ショット",
  "CU｜クローズアップ",
  "ECU｜エクストリーム・クローズアップ",
];

const ANGLES = [
  "指定なし",
  "BEV｜バーズアイ・ビュー（真上）",
  "HA｜ハイアングル（俯瞰）",
  "EL｜アイレベル（目線）",
  "LA｜ローアングル（仰角）",
  "GA｜グランドアングル（地面）",
  "DA｜ダッチアングル（傾き）",
  "OTS｜オーバー・ザ・ショルダー",
  "POV｜主観ショット",
];

const CAMERA_MOVES = [
  "指定なし",
  "STATIC｜固定",
  "PAN→｜パン右",
  "←PAN｜パン左",
  "TILT↑｜チルトアップ",
  "TILT↓｜チルトダウン",
  "ZOOM IN｜ズームイン",
  "ZOOM OUT｜ズームアウト",
  "DOLLY IN｜ドリーイン（前進）",
  "DOLLY OUT｜ドリーアウト（後退）",
  "TRACK→｜トラッキング右",
  "←TRACK｜トラッキング左",
  "CRANE↑｜クレーンアップ",
  "CRANE↓｜クレーンダウン",
  "HANDHELD｜ハンドヘルド",
  "STEADICAM｜ステディカム",
];

function drawArrowForExport(ctx: CanvasRenderingContext2D, fromx: number, fromy: number, tox: number, toy: number, width: number) {
  const headlen = 10 + width;
  const dx = tox - fromx;
  const dy = toy - fromy;
  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(fromx, fromy);
  ctx.lineTo(tox, toy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tox, toy);
  ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function drawElementForExport(ctx: CanvasRenderingContext2D, el: Element) {
  if (el.visible === false) return;
  const scale = el.scale || 1;
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineWidth = el.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const w = (el.width || 0) * scale;
  const h = (el.height || 0) * scale;
  switch (el.type) {
    case 'pencil':
    case 'eraser':
      if (el.points && el.points.length > 0) {
        const minX = Math.min(...el.points.map(p => p.x));
        const maxX = Math.max(...el.points.map(p => p.x));
        const minY = Math.min(...el.points.map(p => p.y));
        const maxY = Math.max(...el.points.map(p => p.y));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        ctx.beginPath();
        el.points.forEach((p, i) => {
          const px = el.x + (p.x - centerX) * scale;
          const py = el.y + (p.y - centerY) * scale;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
      break;
    case 'rect':
      ctx.strokeRect(el.x - w / 2, el.y - h / 2, w, h);
      break;
    case 'circle': {
      const radius = Math.min(Math.abs(w), Math.abs(h)) / 2;
      ctx.beginPath();
      ctx.arc(el.x, el.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'arrow':
      drawArrowForExport(ctx, el.x - w / 2, el.y - h / 2, el.x + w / 2, el.y + h / 2, el.size);
      break;
    case 'text':
      ctx.font = `${(el.fontSize || 40) * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.text || '', el.x, el.y);
      break;
  }
}

async function renderFrameToDataURL(frame: Frame, width: number, height: number): Promise<string> {
  return new Promise((resolve) => {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    const drawAll = () => {
      frame.elements.forEach(el => drawElementForExport(ctx, el));
      resolve(offscreen.toDataURL('image/png'));
    };
    if (frame.image) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, width, height); drawAll(); };
      img.src = frame.image;
    } else {
      drawAll();
    }
  });
}

function SortableLayerItem({ 
  element, 
  isSelected, 
  onSelect, 
  onDelete, 
  onToggleVisibility 
}: { 
  element: Element, 
  isSelected: boolean, 
  onSelect: () => void, 
  onDelete: () => void,
  onToggleVisibility: () => void,
  key?: string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const getIcon = () => {
    switch (element.type) {
      case 'pencil': return <Pencil size={12} />;
      case 'rect': return <Square size={12} />;
      case 'circle': return <Circle size={12} />;
      case 'arrow': return <ArrowRight size={12} />;
      case 'text': return <Type size={12} />;
      default: return <ImageIcon size={12} />;
    }
  };

  const getLabel = () => {
    switch (element.type) {
      case 'pencil': return '鉛筆';
      case 'rect': return '四角';
      case 'circle': return '円';
      case 'arrow': return '矢印';
      case 'text': return element.text ? (element.text.length > 10 ? element.text.substring(0, 10) + '...' : element.text) : 'テキスト';
      default: return '画像';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded text-[10px] group transition-colors",
        isSelected ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-zinc-900/50 text-zinc-400 border border-transparent hover:bg-zinc-800"
      )}
      onClick={onSelect}
    >
      <button 
        {...attributes} 
        {...listeners} 
        className="cursor-grab active:cursor-grabbing p-1 hover:text-zinc-200"
      >
        <GripVertical size={12} />
      </button>
      
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="relative">
          <span className="opacity-50">{getIcon()}</span>
          <div 
            className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-zinc-950"
            style={{ backgroundColor: element.color }}
          />
        </div>
        <span className="truncate font-medium">{getLabel()}</span>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
          className={cn("p-1 hover:text-amber-400", element.visible === false && "text-zinc-600 opacity-100")}
        >
          {element.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 hover:text-red-400"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<'settings' | 'editor'>('settings');
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(() => loadFromStorage().settings);
  const [frames, setFrames] = useState<Frame[]>(() => loadFromStorage().frames);
  const [isGeneratingCuts, setIsGeneratingCuts] = useState(false);
  const [aiDialogStep, setAiDialogStep] = useState<null | 'choice' | 'confirm-overwrite'>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [tool, setTool] = useState<Tool>('pencil');
  const [brushSize, setBrushSize] = useState(2);
  const [brushColor, setBrushColor] = useState('#000000');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [isResizingElement, setIsResizingElement] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [initialElementPos, setInitialElementPos] = useState({ x: 0, y: 0 });
  const [initialElementDim, setInitialElementDim] = useState({ width: 0, height: 0, scale: 1 });
  const [isTextInputOpen, setIsTextInputOpen] = useState(false);
  const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 });
  const [textInputValue, setTextInputValue] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [onionSkin, setOnionSkin] = useState(true);
  const [currentElement, setCurrentElement] = useState<Element | null>(null);
  const [printFrameImages, setPrintFrameImages] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [panelTab, setPanelTab] = useState<'cut' | 'layers'>('cut');

  // Frame-level undo/redo stacks (for add/duplicate/delete frame)
  const framesUndoStack = useRef<{ frames: Frame[], currentFrameIndex: number }[]>([]);
  const framesRedoStack = useRef<{ frames: Frame[], currentFrameIndex: number }[]>([]);

  const pushFramesUndo = useCallback(() => {
    framesUndoStack.current.push({ frames, currentFrameIndex });
    framesRedoStack.current = [];
  }, [frames, currentFrameIndex]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const reversedElements = [...currentFrame.elements].reverse();
      const oldIndex = reversedElements.findIndex((el) => el.id === active.id);
      const newIndex = reversedElements.findIndex((el) => el.id === over.id);
      
      const newReversed = arrayMove(reversedElements, oldIndex, newIndex);
      const newElements = [...newReversed].reverse();
      saveFrame(newElements);
    }
  };

  const currentFrame = frames[currentFrameIndex];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Auto-save to localStorage whenever frames or settings change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        settings: projectSettings,
        frames: stripHistory(frames),
      }));
    } catch {}
  }, [frames, projectSettings]);

  const saveProjectToFile = () => {
    const data = JSON.stringify(stripHistory(frames), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'storyboard.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadProjectFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          setFrames(restoreFrames(parsed));
        } else {
          if (parsed.settings) setProjectSettings({ ...DEFAULT_PROJECT_SETTINGS, ...parsed.settings });
          setFrames(restoreFrames(parsed.frames || []));
        }
        setCurrentFrameIndex(0);
        setCurrentPage('editor');
      } catch {
        console.error('プロジェクトの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background image
    if (currentFrame.image) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawElements();
      };
      img.src = currentFrame.image;
    } else {
      drawElements();
    }

    function drawElements() {
      // Onion Skinning
      if (onionSkin && currentFrameIndex > 0) {
        const prevFrame = frames[currentFrameIndex - 1];
        ctx.globalAlpha = 0.2;
        prevFrame.elements.forEach(el => drawElement(ctx, el));
        ctx.globalAlpha = 1.0;
      }

      currentFrame.elements.forEach(el => {
        const isSelected = el.id === selectedElementId;
        drawElement(ctx, el, isSelected);
        if (isSelected) drawBoundingBox(ctx, el);
      });
      if (currentElement) drawElement(ctx, currentElement, false, true);
    }
  }, [currentFrame, currentFrameIndex, frames, onionSkin, selectedElementId, currentElement]);

  const getElementBounds = (el: Element) => {
    const scale = el.scale || 1;
    let w = Math.abs(el.width || 0) * scale;
    let h = Math.abs(el.height || 0) * scale;
    
    // Ensure a minimum hit area for selection of thin elements
    if (el.type === 'arrow' || el.type === 'pencil') {
      w = Math.max(w, 20);
      h = Math.max(h, 20);
    }

    let x = el.x - w / 2;
    let y = el.y - h / 2;

    if (el.type === 'pencil' && el.points) {
      const minX = Math.min(...el.points.map(p => p.x));
      const maxX = Math.max(...el.points.map(p => p.x));
      const minY = Math.min(...el.points.map(p => p.y));
      const maxY = Math.max(...el.points.map(p => p.y));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const origW = maxX - minX;
      const origH = maxY - minY;
      w = origW * scale;
      h = origH * scale;
      x = el.x - w / 2;
      y = el.y - h / 2;
    } else if (el.type === 'text') {
      const ctx = contextRef.current;
      if (ctx) {
        ctx.font = `${(el.fontSize || 40) * scale}px sans-serif`;
        const metrics = ctx.measureText(el.text || '');
        w = metrics.width;
        h = (el.fontSize || 40) * scale;
        x = el.x - w / 2;
        y = el.y - h / 2;
      }
    }

    return { x, y, w, h };
  };

  const drawBoundingBox = (ctx: CanvasRenderingContext2D, el: Element) => {
    if (el.visible === false) return;
    const { x, y, w, h } = getElementBounds(el);

    if (el.type !== 'arrow') {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
      ctx.setLineDash([]);
    }

    // Draw handles
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    const handleSize = 8;
    
    const scale = el.scale || 1;
    const handles = el.type === 'arrow' ? [
      { x: el.x - (el.width || 0) * scale / 2, y: el.y - (el.height || 0) * scale / 2, cursor: 'move', id: 'arrow-start' },
      { x: el.x + (el.width || 0) * scale / 2, y: el.y + (el.height || 0) * scale / 2, cursor: 'move', id: 'arrow-end' },
    ] : [
      { x: x - 5, y: y - 5, cursor: 'nw-resize', id: 'nw' },
      { x: x + w / 2, y: y - 5, cursor: 'n-resize', id: 'n' },
      { x: x + w + 5, y: y - 5, cursor: 'ne-resize', id: 'ne' },
      { x: x - 5, y: y + h / 2, cursor: 'w-resize', id: 'w' },
      { x: x + w + 5, y: y + h / 2, cursor: 'e-resize', id: 'e' },
      { x: x - 5, y: y + h + 5, cursor: 'sw-resize', id: 'sw' },
      { x: x + w / 2, y: y + h + 5, cursor: 's-resize', id: 's' },
      { x: x + w + 5, y: y + h + 5, cursor: 'se-resize', id: 'se' },
    ];

    handles.forEach(h => {
      ctx.beginPath();
      if (el.type === 'arrow') {
        ctx.arc(h.x, h.y, handleSize / 2 + 2, 0, Math.PI * 2);
      } else {
        ctx.rect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      }
      ctx.fill();
      ctx.stroke();
    });
  };

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const drawElement = (ctx: CanvasRenderingContext2D, el: Element, isSelected = false, isLive = false) => {
    if (el.visible === false) return;
    const scale = el.scale || 1;
    ctx.strokeStyle = el.color;
    ctx.fillStyle = el.color;
    ctx.lineWidth = el.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const w = (el.width || 0) * scale;
    const h = (el.height || 0) * scale;

    switch (el.type) {
      case 'pencil':
        if (el.points && el.points.length > 0) {
          if (isLive) {
            ctx.beginPath();
            el.points.forEach((p, i) => {
              if (i === 0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
          } else {
            const minX = Math.min(...el.points.map(p => p.x));
            const maxX = Math.max(...el.points.map(p => p.x));
            const minY = Math.min(...el.points.map(p => p.y));
            const maxY = Math.max(...el.points.map(p => p.y));
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            ctx.beginPath();
            el.points.forEach((p, i) => {
              const px = el.x + (p.x - centerX) * scale;
              const py = el.y + (p.y - centerY) * scale;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.stroke();
          }
        }
        break;
      case 'rect':
        ctx.strokeRect(el.x - w / 2, el.y - h / 2, w, h);
        break;
      case 'circle':
        ctx.beginPath();
        const radius = Math.min(Math.abs(w), Math.abs(h)) / 2;
        ctx.arc(el.x, el.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'arrow':
        drawArrow(ctx, el.x - w / 2, el.y - h / 2, el.x + w / 2, el.y + h / 2, el.size);
        break;
      case 'text':
        ctx.font = `${(el.fontSize || 40) * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.text || '', el.x, el.y);
        break;
    }
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, fromx: number, fromy: number, tox: number, toy: number, width: number) => {
    const headlen = 10 + width;
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      updateFrameData('image', event.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const generateAIImage = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const base = `A storyboard frame. Shot size: ${currentFrame.shotSize}. Camera angle: ${currentFrame.angle}. Camera move: ${currentFrame.cameraMove}. Action: ${currentFrame.action}. Dialogue: ${currentFrame.dialogue}. Style: black and white storyboard sketch, clean lines, professional.`;
      const prompt = currentFrame.aiPrompt ? `${base} ${currentFrame.aiPrompt}` : base;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-preview-image-generation',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          updateFrameData('image', imageUrl);
          break;
        }
      }
    } catch (error) {
      console.error("AI Image Generation Error:", error);
      alert('AI画像生成はGemini APIの課金設定が必要だよ。Google AI StudioでBillingを有効にしてね。');
    } finally {
      setIsGenerating(false);
    }
  };

  // Initialize Canvas + ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) contextRef.current = ctx;
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const saveFrame = useCallback((newElements: Element[]) => {
    setFrames(prev => prev.map((f, i) => {
      if (i !== currentFrameIndex) return f;
      
      const newHistory = f.history.slice(0, f.historyIndex + 1);
      newHistory.push(newElements);
      
      return { 
        ...f, 
        elements: newElements, 
        history: newHistory,
        historyIndex: newHistory.length - 1
      };
    }));
  }, [currentFrameIndex]);

  const undo = useCallback(() => {
    const frame = frames[currentFrameIndex];
    if (frame.historyIndex > 0) {
      // Element-level undo
      const newIndex = frame.historyIndex - 1;
      setFrames(prev => prev.map((f, i) => i === currentFrameIndex ? {
        ...f,
        elements: f.history[newIndex],
        historyIndex: newIndex
      } : f));
      setSelectedElementId(null);
    } else if (framesUndoStack.current.length > 0) {
      // Frame-level undo
      const snapshot = framesUndoStack.current.pop()!;
      framesRedoStack.current.push({ frames, currentFrameIndex });
      setFrames(snapshot.frames);
      setCurrentFrameIndex(snapshot.currentFrameIndex);
      setSelectedElementId(null);
    }
  }, [currentFrameIndex, frames]);

  const redo = useCallback(() => {
    const frame = frames[currentFrameIndex];
    if (frame.historyIndex < frame.history.length - 1) {
      // Element-level redo
      const newIndex = frame.historyIndex + 1;
      setFrames(prev => prev.map((f, i) => i === currentFrameIndex ? {
        ...f,
        elements: f.history[newIndex],
        historyIndex: newIndex
      } : f));
      setSelectedElementId(null);
    } else if (framesRedoStack.current.length > 0) {
      // Frame-level redo
      const snapshot = framesRedoStack.current.pop()!;
      framesUndoStack.current.push({ frames, currentFrameIndex });
      setFrames(snapshot.frames);
      setCurrentFrameIndex(snapshot.currentFrameIndex);
      setSelectedElementId(null);
    }
  }, [currentFrameIndex, frames]);

  const clearCanvas = () => {
    saveFrame([]);
    setSelectedElementId(null);
  };

  const startDrawing = ({ nativeEvent }: React.MouseEvent | React.TouchEvent) => {
    const { offsetX, offsetY } = getCoordinates(nativeEvent);
    
    if (tool === 'select') {
      // Check handles first if an element is selected
      if (selectedElementId) {
        const el = currentFrame.elements.find(e => e.id === selectedElementId);
        if (el) {
          const { x, y, w, h } = getElementBounds(el);
          const handleSize = 12; // Larger hit area for handles
          const scale = el.scale || 1;
          const handles = el.type === 'arrow' ? [
            { x: el.x - (el.width || 0) * scale / 2, y: el.y - (el.height || 0) * scale / 2, id: 'arrow-start' },
            { x: el.x + (el.width || 0) * scale / 2, y: el.y + (el.height || 0) * scale / 2, id: 'arrow-end' },
          ] : [
            { x: x - 5, y: y - 5, id: 'nw' },
            { x: x + w / 2, y: y - 5, id: 'n' },
            { x: x + w + 5, y: y - 5, id: 'ne' },
            { x: x - 5, y: y + h / 2, id: 'w' },
            { x: x + w + 5, y: y + h / 2, id: 'e' },
            { x: x - 5, y: y + h + 5, id: 'sw' },
            { x: x + w / 2, y: y + h + 5, id: 's' },
            { x: x + w + 5, y: y + h + 5, id: 'se' },
          ];

          const hitHandle = handles.find(hand => 
            offsetX >= hand.x - handleSize / 2 && offsetX <= hand.x + handleSize / 2 &&
            offsetY >= hand.y - handleSize / 2 && offsetY <= hand.y + handleSize / 2
          );

          if (hitHandle) {
            setIsResizingElement(true);
            setResizeHandle(hitHandle.id);
            setDragStartPos({ x: offsetX, y: offsetY });
            setInitialElementPos({ x: el.x, y: el.y });
            setInitialElementDim({ 
              width: el.width || 0, 
              height: el.height || 0, 
              scale: el.scale || 1 
            });
            return;
          }
        }
      }

      const clickedEl = [...currentFrame.elements].reverse().find(el => {
        if (el.visible === false) return false;
        const { x, y, w, h } = getElementBounds(el);
        return offsetX >= x && offsetX <= x + w && offsetY >= y && offsetY <= y + h;
      });

      if (clickedEl) {
        setSelectedElementId(clickedEl.id);
        setIsDraggingElement(true);
        setDragStartPos({ x: offsetX, y: offsetY });
        setInitialElementPos({ x: clickedEl.x, y: clickedEl.y });
      } else {
        setSelectedElementId(null);
      }
      return;
    }

    if (tool === 'text') {
      setTextInputPos({ x: offsetX, y: offsetY });
      setTextInputValue('');
      setIsTextInputOpen(true);
      return;
    }

    setIsDrawing(true);
    setDragStartPos({ x: offsetX, y: offsetY });
    const newEl: Element = {
      id: uuidv4(),
      type: tool,
      x: offsetX,
      y: offsetY,
      width: 0,
      height: 0,
      color: tool === 'eraser' ? '#ffffff' : brushColor,
      size: brushSize,
      scale: 1,
      fontSize: tool === 'text' ? 72 : undefined,
      points: tool === 'pencil' ? [{ x: offsetX, y: offsetY }] : undefined
    };
    setCurrentElement(newEl);
  };

  const draw = ({ nativeEvent }: React.MouseEvent | React.TouchEvent) => {
    const { offsetX, offsetY } = getCoordinates(nativeEvent);

    // Handle cursor for selection tool
    if (tool === 'select' && !isDrawing && !isDraggingElement && !isResizingElement) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (selectedElementId) {
        const el = currentFrame.elements.find(e => e.id === selectedElementId);
        if (el && el.visible !== false) {
          const { x, y, w, h } = getElementBounds(el);
          const handleSize = 12;
          const scale = el.scale || 1;
          const handles = el.type === 'arrow' ? [
            { x: el.x - (el.width || 0) * scale / 2, y: el.y - (el.height || 0) * scale / 2, id: 'arrow-start', cursor: 'move' },
            { x: el.x + (el.width || 0) * scale / 2, y: el.y + (el.height || 0) * scale / 2, id: 'arrow-end', cursor: 'move' },
          ] : [
            { x: x - 5, y: y - 5, id: 'nw', cursor: 'nw-resize' },
            { x: x + w / 2, y: y - 5, id: 'n', cursor: 'n-resize' },
            { x: x + w + 5, y: y - 5, id: 'ne', cursor: 'ne-resize' },
            { x: x - 5, y: y + h / 2, id: 'w', cursor: 'w-resize' },
            { x: x + w + 5, y: y + h / 2, id: 'e', cursor: 'e-resize' },
            { x: x - 5, y: y + h + 5, id: 'sw', cursor: 'sw-resize' },
            { x: x + w / 2, y: y + h + 5, id: 's', cursor: 's-resize' },
            { x: x + w + 5, y: y + h + 5, id: 'se', cursor: 'se-resize' },
          ];
          const hit = handles.find(hand => 
            offsetX >= hand.x - handleSize / 2 && offsetX <= hand.x + handleSize / 2 &&
            offsetY >= hand.y - handleSize / 2 && offsetY <= hand.y + handleSize / 2
          );
          
          if (hit) {
            canvas.style.cursor = hit.cursor || 'pointer';
            setHoveredHandle(hit.id);
            return;
          }
        }
      }

      const hoveredEl = [...currentFrame.elements].reverse().find(el => {
        if (el.visible === false) return false;
        const { x, y, w, h } = getElementBounds(el);
        return offsetX >= x && offsetX <= x + w && offsetY >= y && offsetY <= y + h;
      });

      if (hoveredEl) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'default';
      }
      setHoveredHandle(null);
    }

    if (isResizingElement && selectedElementId && resizeHandle) {
      const el = currentFrame.elements.find(e => e.id === selectedElementId);
      if (!el) return;

      const dx = offsetX - dragStartPos.x;
      const dy = offsetY - dragStartPos.y;

      let newWidth = initialElementDim.width;
      let newHeight = initialElementDim.height;
      let newScale = initialElementDim.scale;
      let newX = el.x;
      let newY = el.y;

      if (el.type === 'arrow' && resizeHandle.startsWith('arrow-')) {
        const isStart = resizeHandle === 'arrow-start';
        const fixedX = isStart ? initialElementPos.x + initialElementDim.width / 2 : initialElementPos.x - initialElementDim.width / 2;
        const fixedY = isStart ? initialElementPos.y + initialElementDim.height / 2 : initialElementPos.y - initialElementDim.height / 2;
        
        newX = (offsetX + fixedX) / 2;
        newY = (offsetY + fixedY) / 2;
        newWidth = isStart ? fixedX - offsetX : offsetX - fixedX;
        newHeight = isStart ? fixedY - offsetY : offsetY - fixedY;
      } else if (el.type === 'rect' || el.type === 'circle' || el.type === 'arrow') {
        if (resizeHandle.includes('e')) newWidth = initialElementDim.width + dx * 2;
        if (resizeHandle.includes('w')) newWidth = initialElementDim.width - dx * 2;
        if (resizeHandle.includes('s')) newHeight = initialElementDim.height + dy * 2;
        if (resizeHandle.includes('n')) newHeight = initialElementDim.height - dy * 2;
      } else {
        // Uniform scaling for text and pencil
        const bounds = getElementBounds(el);
        const startDistToCenter = Math.sqrt((dragStartPos.x - el.x) ** 2 + (dragStartPos.y - el.y) ** 2);
        const currentDistToCenter = Math.sqrt((offsetX - el.x) ** 2 + (offsetY - el.y) ** 2);
        const factor = currentDistToCenter / (startDistToCenter || 1);
        newScale = Math.max(0.1, initialElementDim.scale * factor);
      }

      const newElements = currentFrame.elements.map(e => 
        e.id === selectedElementId ? { ...e, x: newX, y: newY, width: newWidth, height: newHeight, scale: newScale } : e
      );
      setFrames(prev => prev.map((f, i) => i === currentFrameIndex ? { ...f, elements: newElements } : f));
      return;
    }

    if (isDraggingElement && selectedElementId) {
      const dx = offsetX - dragStartPos.x;
      const dy = offsetY - dragStartPos.y;
      
      const el = currentFrame.elements.find(e => e.id === selectedElementId);
      if (el) {
        const newX = initialElementPos.x + dx;
        const newY = initialElementPos.y + dy;
        
        const newElements = currentFrame.elements.map(e => 
          e.id === selectedElementId ? { ...e, x: newX, y: newY } : e
        );
        setFrames(prev => prev.map((f, i) => i === currentFrameIndex ? { ...f, elements: newElements } : f));
      }
      return;
    }

    if (!isDrawing || !currentElement) return;

    if (currentElement.type === 'pencil') {
      setCurrentElement(prev => ({
        ...prev!,
        points: [...(prev!.points || []), { x: offsetX, y: offsetY }]
      }));
    } else {
      // Draw from start point to current point
      const dx = offsetX - dragStartPos.x;
      const dy = offsetY - dragStartPos.y;
      
      let width = dx;
      let height = dy;

      if (currentElement.type === 'circle') {
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        const signX = dx >= 0 ? 1 : -1;
        const signY = dy >= 0 ? 1 : -1;
        width = size * signX;
        height = size * signY;
      }

      setCurrentElement(prev => ({
        ...prev!,
        x: dragStartPos.x + width / 2,
        y: dragStartPos.y + height / 2,
        width,
        height
      }));
    }
  };

  const stopDrawing = () => {
    if (isResizingElement) {
      setIsResizingElement(false);
      setResizeHandle(null);
      saveFrame(currentFrame.elements);
      return;
    }

    if (isDraggingElement) {
      setIsDraggingElement(false);
      saveFrame(currentFrame.elements); // Finalize position in history
      return;
    }

    if (!isDrawing || !currentElement) return;
    setIsDrawing(false);

    let finalizedElement = { ...currentElement };
    if (currentElement.type === 'pencil' && currentElement.points) {
      const minX = Math.min(...currentElement.points.map(p => p.x));
      const maxX = Math.max(...currentElement.points.map(p => p.x));
      const minY = Math.min(...currentElement.points.map(p => p.y));
      const maxY = Math.max(...currentElement.points.map(p => p.y));
      finalizedElement.x = (minX + maxX) / 2;
      finalizedElement.y = (minY + maxY) / 2;
    }

    saveFrame([...currentFrame.elements, finalizedElement]);
    setCurrentElement(null);
  };

  const getCoordinates = (event: any) => {
    if (event.touches) {
      const rect = canvasRef.current?.getBoundingClientRect();
      return {
        offsetX: event.touches[0].clientX - (rect?.left || 0),
        offsetY: event.touches[0].clientY - (rect?.top || 0)
      };
    }
    return {
      offsetX: event.offsetX,
      offsetY: event.offsetY
    };
  };

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = tool === 'eraser' ? '#ffffff' : brushColor;
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushColor, brushSize, tool]);

  const updateElement = (id: string, updates: Partial<Element>) => {
    const newElements = currentFrame.elements.map(el => el.id === id ? { ...el, ...updates } : el);
    saveFrame(newElements);
  };

  const addFrame = useCallback(() => {
    pushFramesUndo();
    const newFrame: Frame = {
      id: uuidv4(),
      image: '',
      elements: [],
      dialogue: '',
      action: '',
      notes: '',
      duration: DEFAULT_FRAME_DURATION,
      history: [[]],
      historyIndex: 0,
      shotSize: SHOT_SIZES[0],
      angle: ANGLES[0],
      cameraMove: CAMERA_MOVES[0],
      sound: '',
      aiPrompt: '',
    };
    setFrames(prev => [...prev.slice(0, currentFrameIndex + 1), newFrame, ...prev.slice(currentFrameIndex + 1)]);
    setCurrentFrameIndex(prev => prev + 1);
  }, [currentFrameIndex, pushFramesUndo]);

  const duplicateFrame = useCallback((index: number) => {
    pushFramesUndo();
    const frameToDuplicate = frames[index];
    const newFrame: Frame = {
      ...frameToDuplicate,
      id: uuidv4(),
      history: [[...frameToDuplicate.elements]],
      historyIndex: 0,
    };
    setFrames(prev => [...prev.slice(0, index + 1), newFrame, ...prev.slice(index + 1)]);
    setCurrentFrameIndex(index + 1);
  }, [frames, pushFramesUndo]);

  const deleteFrame = (index: number) => {
    if (frames.length <= 1) return;
    pushFramesUndo();
    const newFrames = frames.filter((_, i) => i !== index);
    setFrames(newFrames);
    if (currentFrameIndex >= newFrames.length) {
      setCurrentFrameIndex(newFrames.length - 1);
    }
  };

  const updateFrameData = (key: keyof Frame, value: any) => {
    setFrames(prev => prev.map((f, i) => i === currentFrameIndex ? { ...f, [key]: value } : f));
  };

  // Playback logic
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isPlaying) {
      timeout = setTimeout(() => {
        if (currentFrameIndex < frames.length - 1) {
          setCurrentFrameIndex(prev => prev + 1);
        } else {
          setIsPlaying(false);
          setCurrentFrameIndex(0);
        }
      }, currentFrame.duration);
    }
    return () => clearTimeout(timeout);
  }, [isPlaying, currentFrameIndex, frames.length, currentFrame.duration]);

  const generateCutsWithAI = async (mode: 'overwrite' | 'append') => {
    setIsGeneratingCuts(true);
    setAiDialogStep(null);
    try {
      const apiKey = process.env.GEMINI_API_KEY || "";
      console.log('API Key length:', apiKey.length, 'starts with:', apiKey.slice(0, 8));
      const ai = new GoogleGenAI({ apiKey });
      const s = projectSettings;
      const toneStr = [s.tonePreset, s.toneCustom].filter(Boolean).join('・');
      const cutCount = s.estimatedCuts || Math.max(3, Math.round(s.totalDuration / 5));

      const prompt = `あなたはプロの映像ディレクターです。以下のプロジェクト情報をもとに、映像コンテのカット構成を生成してください。

プロジェクト情報:
- タイトル: ${s.title}
- 目的: ${s.purpose || '未指定'}
- ターゲット: ${s.target || '未指定'}
- 総尺: ${s.totalDuration}秒
- フォーマット: ${s.format || '未指定'}
- ブランド/商品: ${s.brand || '未指定'}
- 訴求ポイント: ${s.usp || '未指定'}
- CTA: ${s.cta || '未指定'}
- トーン＆マナー: ${toneStr || '未指定'}
- ナレーション: ${s.narration === 'yes' ? 'あり' : 'なし'}
- BGMの雰囲気: ${s.bgmMood || '未指定'}
- 特記事項: ${s.notes || 'なし'}

${cutCount}カットのコンテを生成してください。全カットの合計尺が約${s.totalDuration}秒になるようにしてください。

以下のJSON配列のみを返してください（説明文・コードブロック・マークダウン不要）:
[{"shotSize":"...","angle":"...","cameraMove":"...","action":"...","dialogue":"...","sound":"...","notes":"...","duration":数値}]

shotSizeは必ず以下から選択: ${SHOT_SIZES.join(' / ')}
angleは必ず以下から選択: ${ANGLES.join(' / ')}
cameraMoveは必ず以下から選択: ${CAMERA_MOVES.join(' / ')}
durationはミリ秒（整数）で指定してください。`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('JSONの取得に失敗しました');
      const cutsData: any[] = JSON.parse(jsonMatch[0]);

      const newFrames: Frame[] = cutsData.map(cut => ({
        id: uuidv4(),
        image: '',
        elements: [],
        dialogue: cut.dialogue || '',
        action: cut.action || '',
        notes: cut.notes || '',
        sound: cut.sound || '',
        aiPrompt: '',
        duration: typeof cut.duration === 'number' ? cut.duration : DEFAULT_FRAME_DURATION,
        history: [[]],
        historyIndex: 0,
        shotSize: SHOT_SIZES.includes(cut.shotSize) ? cut.shotSize : SHOT_SIZES[0],
        angle: ANGLES.includes(cut.angle) ? cut.angle : ANGLES[0],
        cameraMove: CAMERA_MOVES.includes(cut.cameraMove) ? cut.cameraMove : CAMERA_MOVES[0],
      }));

      if (mode === 'overwrite') {
        setFrames(newFrames);
        setCurrentFrameIndex(0);
      } else {
        setFrames(prev => {
          setCurrentFrameIndex(prev.length);
          return [...prev, ...newFrames];
        });
      }
      setCurrentPage('editor');
    } catch (err) {
      console.error('カット生成エラー:', err);
      alert('カットの生成に失敗しちゃった。もう一度試してみてね。');
    } finally {
      setIsGeneratingCuts(false);
    }
  };

  const handleAIGenerateRequest = () => {
    const hasContent = frames.some(f => f.action || f.dialogue || f.elements.length > 0 || f.image);
    if (hasContent) {
      setAiDialogStep('choice');
    } else {
      generateCutsWithAI('overwrite');
    }
  };

  const exportStoryboard = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const canvas = canvasRef.current;
    const W = canvas?.width || 1280;
    const H = canvas?.height || 720;
    const images = await Promise.all(frames.map(f => renderFrameToDataURL(f, W, H)));
    setPrintFrameImages(images);
    setIsExporting(false);
    setTimeout(() => window.print(), 100);
  };

  const downloadFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `frame-${currentFrameIndex + 1}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      switch (e.key.toLowerCase()) {
        case 'b': setTool('pencil'); break;
        case 'p': setTool('pencil'); break;
        case 'e': setTool('eraser'); break;
        case 's': setTool('select'); break;
        case 'r': setTool('rect'); break;
        case 'c': setTool('circle'); break;
        case 'a': setTool('arrow'); break;
        case 't': setTool('text'); break;
        case 'z': 
          if (e.metaKey || e.ctrlKey) { 
            e.preventDefault(); 
            if (e.shiftKey) redo(); else undo();
          } 
          break;
        case 'y': if (e.metaKey || e.ctrlKey) { e.preventDefault(); redo(); } break;
        case 'n': addFrame(); break;
        case 'd': if (e.metaKey || e.ctrlKey) { e.preventDefault(); duplicateFrame(currentFrameIndex); } break;
        case 'backspace':
        case 'delete':
          if (selectedElementId) {
            saveFrame(currentFrame.elements.filter(el => el.id !== selectedElementId));
            setSelectedElementId(null);
          }
          break;
        case 'arrowleft': setCurrentFrameIndex(prev => Math.max(0, prev - 1)); break;
        case 'arrowright': setCurrentFrameIndex(prev => Math.min(frames.length - 1, prev + 1)); break;
        case ' ': e.preventDefault(); setIsPlaying(prev => !prev); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [frames.length, currentFrameIndex, undo, redo, addFrame, duplicateFrame, selectedElementId, currentFrame.elements, saveFrame]);

  const selectedElement = currentFrame.elements.find(el => el.id === selectedElementId);

  const hasFrameContent = frames.some(f => f.action || f.dialogue || f.elements.length > 0 || f.image);

  if (currentPage === 'settings') {
    return (
      <>
        <SettingsPage
          settings={projectSettings}
          onChange={setProjectSettings}
          onStartEditing={() => setCurrentPage('editor')}
          onGenerateWithAI={handleAIGenerateRequest}
          isGenerating={isGeneratingCuts}
          hasExistingFrames={hasFrameContent}
        />

        {/* Dialog: 上書き or 追記 */}
        {aiDialogStep === 'choice' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="bg-[#1e1e1e] border border-zinc-700 rounded-xl p-6 w-80 space-y-4 shadow-2xl">
              <h3 className="text-sm font-bold text-zinc-200">既存のカットがあるよ</h3>
              <p className="text-xs text-zinc-500">今あるカットをどうする？</p>
              <div className="flex flex-col gap-2">
                <button onClick={() => setAiDialogStep('confirm-overwrite')} className="w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-bold text-zinc-300 transition-colors">上書きする</button>
                <button onClick={() => generateCutsWithAI('append')} className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-sm font-bold text-[#0f0f0f] transition-colors">追記する</button>
                <button onClick={() => setAiDialogStep(null)} className="w-full py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">キャンセル</button>
              </div>
            </div>
          </div>
        )}

        {/* Dialog: 上書き確認 */}
        {aiDialogStep === 'confirm-overwrite' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="bg-[#1e1e1e] border border-zinc-700 rounded-xl p-6 w-80 space-y-4 shadow-2xl">
              <h3 className="text-sm font-bold text-zinc-200">本当に上書きしていい？</h3>
              <p className="text-xs text-zinc-500">今のカットが全部消えちゃうけど、大丈夫？</p>
              <div className="flex flex-col gap-2">
                <button onClick={() => generateCutsWithAI('overwrite')} className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-bold text-white transition-colors">上書きする</button>
                <button onClick={() => setAiDialogStep(null)} className="w-full py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">やっぱりやめる</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
    <div className="flex h-screen w-full bg-[#0f0f0f] text-zinc-300 font-sans overflow-hidden print:hidden">
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0 overflow-hidden">
        {/* Top Bar: Navigation & Playback */}
        <header className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-[#252525] z-20 shrink-0">
          {/* Left: Logo + Frame counter */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Layers className="text-amber-500 w-4 h-4" />
              <span className="text-sm font-bold tracking-tight text-zinc-200">Storyboarder</span>
            </div>
            <div className="h-4 w-px bg-zinc-800" />
            <span className="text-xs font-mono text-zinc-500">
              C-{currentFrameIndex + 1} / {frames.length}
            </span>
            {projectSettings.title && (
              <span className="text-xs text-zinc-600 truncate max-w-32">{projectSettings.title}</span>
            )}
          </div>

          {/* Center: Edit actions */}
          <div className="flex items-center gap-1">
            <button onClick={undo} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors" title="元に戻す (Cmd+Z)"><Undo2 size={15} /></button>
            <button onClick={redo} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors" title="やり直し (Cmd+Shift+Z)"><Redo2 size={15} /></button>
            <div className="h-4 w-px bg-zinc-800 mx-1" />
            <button onClick={() => duplicateFrame(currentFrameIndex)} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors" title="フレームを複製 (Cmd+D)"><Copy size={15} /></button>
          </div>

          {/* Right: Playback + File actions */}
          <div className="flex items-center gap-1">
            <div className="flex items-center bg-zinc-900 rounded-full p-0.5 border border-zinc-800 mr-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all",
                  isPlaying ? "bg-amber-500 text-white" : "hover:bg-zinc-800 text-zinc-400"
                )}
              >
                {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                {isPlaying ? "停止" : "再生"}
              </button>
            </div>
            <button onClick={() => setCurrentPage('settings')} className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-zinc-300 text-xs" title="全体設定"><Settings2 size={14} />全体設定</button>
            <div className="h-4 w-px bg-zinc-800 mx-0.5" />
            <button onClick={() => jsonInputRef.current?.click()} className="p-1.5 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-zinc-300" title="プロジェクトを開く"><FolderOpen size={15} /></button>
            <button onClick={saveProjectToFile} className="p-1.5 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-zinc-300" title="プロジェクトを保存"><Save size={15} /></button>
            <button onClick={downloadFrame} className="p-1.5 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-zinc-300" title="フレームをPNGで保存"><Download size={15} /></button>
            <div className="h-4 w-px bg-zinc-800 mx-1" />
            <button
              onClick={exportStoryboard}
              disabled={isExporting}
              className={cn("px-3 py-1 rounded text-xs font-bold transition-colors", isExporting ? "bg-zinc-700 text-zinc-500 cursor-wait" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300")}
            >
              {isExporting ? '準備中...' : '書き出し'}
            </button>
            <input ref={jsonInputRef} type="file" accept=".json" className="hidden" onChange={loadProjectFromFile} />
          </div>
        </header>

        {/* Tool Bar: Drawing Tools & Controls */}
        <div className="h-14 border-b border-zinc-800 bg-[#1e1e1e] flex items-center px-4 gap-4 z-10 shadow-lg overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800/50">
            <ToolButton 
              active={tool === 'select'} 
              onClick={() => setTool('select')} 
              icon={<MousePointer2 size={18} />} 
              label="選択 (S)"
            />
            <ToolButton 
              active={tool === 'pencil'} 
              onClick={() => setTool('pencil')} 
              icon={<Pencil size={18} />} 
              label="鉛筆 (P)"
            />
            <ToolButton 
              active={tool === 'rect'} 
              onClick={() => setTool('rect')} 
              icon={<Square size={18} />} 
              label="四角 (R)"
            />
            <ToolButton 
              active={tool === 'circle'} 
              onClick={() => setTool('circle')} 
              icon={<Circle size={18} />} 
              label="円 (C)"
            />
            <ToolButton 
              active={tool === 'arrow'} 
              onClick={() => setTool('arrow')} 
              icon={<ArrowRight size={18} />} 
              label="矢印 (A)"
            />
            <ToolButton 
              active={tool === 'text'} 
              onClick={() => setTool('text')} 
              icon={<TextIcon size={18} />} 
              label="テキスト (T)"
            />
            <ToolButton 
              active={tool === 'eraser'} 
              onClick={() => setTool('eraser')} 
              icon={<Eraser size={18} />} 
              label="消しゴム (E)"
            />
          </div>

          <div className="h-6 w-px bg-zinc-800 mx-1" />

          {/* Contextual Controls */}
          {(tool !== 'select' && tool !== 'eraser') && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-6 px-3 py-1 bg-zinc-900/30 rounded-lg border border-zinc-800/30"
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-zinc-600 uppercase">サイズ</span>
                <input 
                  type="range" 
                  min="1" 
                  max="50" 
                  value={brushSize} 
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-24 h-1 accent-amber-500"
                />
                <span className="text-[10px] font-mono text-zinc-500 w-6">{brushSize}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-zinc-600 uppercase">カラー</span>
                <div className="relative w-6 h-6 rounded border border-zinc-700 overflow-hidden">
                  <div 
                    className="absolute inset-0"
                    style={{ backgroundColor: brushColor }}
                  />
                  <input 
                    type="color" 
                    value={brushColor} 
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Selection Controls */}
          {selectedElement && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-6 px-3 py-1 bg-amber-500/10 rounded-lg border border-amber-500/30"
            >
              <span className="text-[10px] font-bold text-amber-400 uppercase">編集中</span>
              
              {selectedElement.type !== 'arrow' && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-zinc-600 uppercase">
                    {selectedElement.type === 'text' ? 'サイズ (pt)' : 'スケール'}
                  </span>
                  <input 
                    type="range" 
                    min={selectedElement.type === 'text' ? "8" : "1"} 
                    max={selectedElement.type === 'text' ? "600" : "50"} 
                    step="1"
                    value={selectedElement.type === 'text' ? (selectedElement.fontSize || 72) : (selectedElement.scale || 1)} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (selectedElement.type === 'text') {
                        updateElement(selectedElement.id, { fontSize: val });
                      } else {
                        updateElement(selectedElement.id, { scale: val });
                      }
                    }}
                    className="w-24 h-1 accent-amber-500"
                  />
                  <span className="text-[10px] font-mono text-zinc-500 w-6">
                    {selectedElement.type === 'text' ? (selectedElement.fontSize || 72) : (selectedElement.scale || 1)}
                  </span>
                </div>
              )}

              {(selectedElement.type !== 'text' && selectedElement.type !== 'arrow') && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-zinc-600 uppercase">線の太さ</span>
                  <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    value={selectedElement.size} 
                    onChange={(e) => updateElement(selectedElement.id, { size: parseInt(e.target.value) })}
                    className="w-24 h-1 accent-amber-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-zinc-600 uppercase">カラー</span>
                <div className="relative w-6 h-6 rounded border border-zinc-700 overflow-hidden">
                  <div 
                    className="absolute inset-0"
                    style={{ backgroundColor: selectedElement.color }}
                  />
                  <input 
                    type="color" 
                    value={selectedElement.color} 
                    onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
                  />
                </div>
              </div>

              {selectedElement.type === 'text' && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-zinc-600 uppercase">テキスト</span>
                  <input 
                    type="text" 
                    value={selectedElement.text || ''} 
                    onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                    className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs px-2 py-1 rounded focus:outline-none focus:border-amber-500 w-32"
                  />
                </div>
              )}

              <button 
                onClick={() => {
                  saveFrame(currentFrame.elements.filter(el => el.id !== selectedElementId));
                  setSelectedElementId(null);
                }}
                className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                title="削除"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          )}

          <div className="h-6 w-px bg-zinc-800 mx-1" />

          <div className="flex items-center gap-1">
            <ToolButton
              active={false}
              onClick={clearCanvas}
              icon={<Trash2 size={18} />}
              label="キャンバスをクリア"
            />
            <ToolButton
              active={onionSkin}
              onClick={() => setOnionSkin(!onionSkin)}
              icon={<Layers size={18} />}
              label="オニオンスキン"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-lg transition-all text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              title="リファレンス画像をアップロード"
            >
              <ImageIcon size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>
        </div>

        {/* Canvas Container */}
        <div className="flex-1 bg-[#141414] flex items-center justify-center p-3 overflow-hidden">
          <div className="relative aspect-video w-full max-w-5xl bg-[#ffffff] shadow-2xl rounded-sm overflow-hidden ring-1 ring-zinc-800">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className={cn(
                "w-full h-full touch-none",
                isResizingElement ? "cursor-grabbing" : 
                isDraggingElement ? "cursor-move" : 
                (hoveredHandle ? `${hoveredHandle}-resize` : 
                (tool === 'select' ? "cursor-default" : "cursor-crosshair"))
              )}
            />

            {/* Text Input Modal */}
            {isTextInputOpen && (
              <div 
                className="absolute z-50 bg-zinc-900 border border-zinc-800 p-2 rounded shadow-xl flex flex-col gap-2"
                style={{ left: textInputPos.x, top: textInputPos.y }}
              >
                <input 
                  autoFocus
                  type="text" 
                  value={textInputValue}
                  onChange={(e) => setTextInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (textInputValue) {
                        const newEl: Element = {
                          id: uuidv4(),
                          type: 'text',
                          x: textInputPos.x,
                          y: textInputPos.y,
                          color: brushColor,
                          size: 2,
                          scale: 1,
                          text: textInputValue,
                          fontSize: 72
                        };
                        saveFrame([...currentFrame.elements, newEl]);
                      }
                      setIsTextInputOpen(false);
                    } else if (e.key === 'Escape') {
                      setIsTextInputOpen(false);
                    }
                  }}
                  className="bg-zinc-950 border border-zinc-700 text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-amber-500 w-64"
                  placeholder="テキストを入力..."
                />
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => setIsTextInputOpen(false)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-1"
                  >
                    キャンセル
                  </button>
                  <button 
                    onClick={() => {
                      if (textInputValue) {
                        const newEl: Element = {
                          id: uuidv4(),
                          type: 'text',
                          x: textInputPos.x,
                          y: textInputPos.y,
                          color: brushColor,
                          size: 2,
                          scale: 1,
                          text: textInputValue,
                          fontSize: 72
                        };
                        saveFrame([...currentFrame.elements, newEl]);
                      }
                      setIsTextInputOpen(false);
                    }}
                    className="text-[10px] bg-amber-500 text-white px-3 py-1 rounded hover:bg-amber-500"
                  >
                    確定
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Frame Strip */}
        <footer className="h-32 border-t border-zinc-800 bg-[#252525] flex items-center px-4 py-4 gap-2 overflow-x-auto scrollbar-hide shrink-0">
          <AnimatePresence initial={false}>
            {frames.map((frame, index) => (
              <motion.div
                key={frame.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                onClick={() => setCurrentFrameIndex(index)}
                className={cn(
                  "flex-shrink-0 w-40 aspect-video bg-zinc-900 rounded border-2 transition-all cursor-pointer relative group overflow-hidden",
                  currentFrameIndex === index ? "border-amber-500 ring-2 ring-amber-500/20" : "border-zinc-800 hover:border-zinc-700"
                )}
              >
                {frame.image ? (
                  <img src={frame.image} alt={`フレーム ${index + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-700 uppercase tracking-tighter">
                    空のフレーム
                  </div>
                )}
                <div className="absolute bottom-1 left-1 text-[10px] font-mono text-white bg-black/60 px-1.5 py-0.5 rounded">
                  C-{index + 1}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); duplicateFrame(index); }}
                  className="absolute top-1 right-8 p-1 bg-zinc-700/80 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="複製"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteFrame(index); }}
                  className="absolute top-1 right-1 p-1 bg-red-500/80 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="削除"
                >
                  <Trash2 size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="flex-shrink-0 flex flex-col gap-1">
            <button
              onClick={addFrame}
              className="w-40 aspect-video border-2 border-dashed border-zinc-800 rounded flex flex-col items-center justify-center hover:bg-zinc-800/50 hover:border-zinc-700 transition-all text-zinc-500 gap-1"
              title="新規フレーム (N)"
            >
              <Plus size={20} />
              <span className="text-[9px] uppercase tracking-widest">新規</span>
            </button>
          </div>
        </footer>
      </main>

      {/* Right Panel */}
      <aside className="w-72 border-l border-zinc-800 bg-[#252525] flex flex-col overflow-hidden">
        {/* Top: AI section (always visible) */}
        <div className="p-3 border-b border-zinc-800 space-y-2 shrink-0">
          <button
            onClick={generateAIImage}
            disabled={isGenerating}
            className={cn(
              "w-full py-2.5 rounded text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              isGenerating ? "bg-zinc-800 text-zinc-600" : "bg-amber-500 text-[#0f0f0f] hover:bg-amber-400"
            )}
          >
            {isGenerating ? (
              <><div className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />生成中...</>
            ) : (
              <><ImageIcon size={14} />AI画像生成</>
            )}
          </button>
          <textarea
            value={currentFrame.aiPrompt}
            onChange={(e) => updateFrameData('aiPrompt', e.target.value)}
            placeholder="AIへの追加指示（例: rainy night, cinematic...）"
            className="w-full bg-[#1e1e1e] border border-zinc-800 rounded p-2 text-xs focus:outline-none focus:border-amber-500/50 min-h-[40px] resize-none text-zinc-400 placeholder:text-zinc-600"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 shrink-0">
          <button
            onClick={() => setPanelTab('cut')}
            className={cn(
              "flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors",
              panelTab === 'cut' ? "text-zinc-200 border-b-2 border-amber-500 bg-amber-500/5" : "text-zinc-600 hover:text-zinc-400"
            )}
          >
            カット情報
          </button>
          <button
            onClick={() => setPanelTab('layers')}
            className={cn(
              "flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors",
              panelTab === 'layers' ? "text-zinc-200 border-b-2 border-amber-500 bg-amber-500/5" : "text-zinc-600 hover:text-zinc-400"
            )}
          >
            レイヤー
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {panelTab === 'cut' && (
            <div className="p-4 space-y-4">
              {/* Cut number */}
              <div className="flex items-center justify-between py-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">カット番号</span>
                <span className="text-sm font-mono font-bold text-zinc-200">
                  C-{currentFrameIndex + 1}
                  <span className="text-[10px] font-normal text-zinc-600 ml-1">/ {frames.length}</span>
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">ショットサイズ</label>
                <select
                  value={currentFrame.shotSize}
                  onChange={(e) => updateFrameData('shotSize', e.target.value)}
                  className="w-full bg-[#252525] border border-zinc-800 rounded p-2 text-xs focus:outline-none focus:border-amber-500/50"
                >
                  {SHOT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">アングル</label>
                <select
                  value={currentFrame.angle}
                  onChange={(e) => updateFrameData('angle', e.target.value)}
                  className="w-full bg-[#252525] border border-zinc-800 rounded p-2 text-xs focus:outline-none focus:border-amber-500/50"
                >
                  {ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">カメラムーブ</label>
                <select
                  value={currentFrame.cameraMove}
                  onChange={(e) => updateFrameData('cameraMove', e.target.value)}
                  className="w-full bg-[#252525] border border-zinc-800 rounded p-2 text-xs focus:outline-none focus:border-amber-500/50"
                >
                  {CAMERA_MOVES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="h-px bg-zinc-800" />

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">台詞</label>
                <textarea
                  value={currentFrame.dialogue}
                  onChange={(e) => updateFrameData('dialogue', e.target.value)}
                  placeholder="何が話されていますか？"
                  className="w-full bg-[#252525] border border-zinc-800 rounded p-2 text-xs focus:outline-none focus:border-amber-500/50 min-h-[52px] resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">アクション</label>
                <textarea
                  value={currentFrame.action}
                  onChange={(e) => updateFrameData('action', e.target.value)}
                  placeholder="何が起きていますか？"
                  className="w-full bg-[#252525] border border-zinc-800 rounded p-2 text-xs focus:outline-none focus:border-amber-500/50 min-h-[52px] resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">BGM・SE</label>
                <textarea
                  value={currentFrame.sound}
                  onChange={(e) => updateFrameData('sound', e.target.value)}
                  placeholder="BGM・効果音の指示..."
                  className="w-full bg-[#252525] border border-zinc-800 rounded p-2 text-xs focus:outline-none focus:border-amber-500/50 min-h-[44px] resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">メモ</label>
                <textarea
                  value={currentFrame.notes}
                  onChange={(e) => updateFrameData('notes', e.target.value)}
                  placeholder="追加のメモ..."
                  className="w-full bg-[#252525] border border-zinc-800 rounded p-2 text-xs focus:outline-none focus:border-amber-500/50 min-h-[44px] resize-none"
                />
              </div>

              <div className="h-px bg-zinc-800" />

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">デュレーション</label>
                  <span className="text-xs font-mono text-zinc-400">{(currentFrame.duration / 1000).toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="10000"
                  step="100"
                  value={currentFrame.duration}
                  onChange={(e) => updateFrameData('duration', parseInt(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>
          )}

          {panelTab === 'layers' && (
            <div className="p-4 space-y-2">
              {currentFrame.elements.length === 0 ? (
                <div className="text-[10px] text-zinc-600 text-center py-8 italic">
                  オブジェクトがありません
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={[...currentFrame.elements].reverse().map(el => el.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-1">
                      {[...currentFrame.elements].reverse().map((el) => (
                        <SortableLayerItem
                          key={el.id}
                          element={el}
                          isSelected={selectedElementId === el.id}
                          onSelect={() => setSelectedElementId(el.id)}
                          onDelete={() => {
                            saveFrame(currentFrame.elements.filter(e => e.id !== el.id));
                            if (selectedElementId === el.id) setSelectedElementId(null);
                          }}
                          onToggleVisibility={() => {
                            updateElement(el.id, { visible: el.visible === false });
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}
        </div>

      </aside>
    </div>

    {/* Print View */}
    <div className="hidden print:block p-8 bg-white text-black">
      <div className="text-center mb-6 pb-4 border-b-2 border-black">
        <h1 className="text-2xl font-bold tracking-wide">ストーリーボード</h1>
        <p className="text-sm text-gray-500 mt-1">{frames.length} カット</p>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-100 border border-gray-300">
            <th className="border border-gray-300 p-2 text-center w-12">CUT</th>
            <th className="border border-gray-300 p-2 w-48">フレーム</th>
            <th className="border border-gray-300 p-2 text-left">ショット</th>
            <th className="border border-gray-300 p-2 text-left">アングル</th>
            <th className="border border-gray-300 p-2 text-left">カメラムーブ</th>
            <th className="border border-gray-300 p-2 text-left">アクション</th>
            <th className="border border-gray-300 p-2 text-left">台詞</th>
            <th className="border border-gray-300 p-2 text-left">BGM・SE</th>
            <th className="border border-gray-300 p-2 text-left">メモ</th>
            <th className="border border-gray-300 p-2 text-center w-12">尺</th>
          </tr>
        </thead>
        <tbody>
          {frames.map((frame, i) => (
            <tr key={frame.id} className="border border-gray-300 align-top">
              <td className="border border-gray-300 p-2 text-center font-bold font-mono">C-{i + 1}</td>
              <td className="border border-gray-300 p-1">
                {printFrameImages[i] ? (
                  <img src={printFrameImages[i]} alt={`CUT ${i + 1}`} className="w-full aspect-video object-cover bg-white" />
                ) : (
                  <div className="w-full aspect-video bg-gray-50 flex items-center justify-center text-gray-400">空</div>
                )}
              </td>
              <td className="border border-gray-300 p-2">{frame.shotSize}</td>
              <td className="border border-gray-300 p-2">{frame.angle}</td>
              <td className="border border-gray-300 p-2">{frame.cameraMove}</td>
              <td className="border border-gray-300 p-2 whitespace-pre-wrap">{frame.action}</td>
              <td className="border border-gray-300 p-2 whitespace-pre-wrap">{frame.dialogue && `「${frame.dialogue}」`}</td>
              <td className="border border-gray-300 p-2 whitespace-pre-wrap">{frame.sound}</td>
              <td className="border border-gray-300 p-2 whitespace-pre-wrap">{frame.notes}</td>
              <td className="border border-gray-300 p-2 text-center">{(frame.duration / 1000).toFixed(1)}s</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

function ToolButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      title={label}
      className={cn(
        "p-2.5 rounded-lg transition-all relative group",
        active ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
      )}
    >
      {icon}
      <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity delay-0 group-hover:delay-700">
        {label}
      </span>
    </button>
  );
=======
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {
  return <div></div>;
>>>>>>> aistudio/main
}
