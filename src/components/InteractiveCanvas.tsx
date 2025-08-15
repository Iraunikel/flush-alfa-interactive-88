import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, ThumbsUp, ThumbsDown, Minus, Eraser, Hand, RotateCcw, TrendingUp, Palette } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export type DrawingTool = 'magic' | 'high' | 'medium' | 'low' | 'neutral' | 'eraser' | 'pan';

export interface CanvasAnnotation {
  id: string;
  type: 'high' | 'medium' | 'low' | 'neutral';
  pressure: number;
  timestamp: number;
  bounds: { x: number; y: number; width: number; height: number };
}

interface InteractiveCanvasProps {
  text: string;
  onAnnotationsChange: (annotations: CanvasAnnotation[]) => void;
  className?: string;
}

interface Point {
  x: number;
  y: number;
  time: number;
}

interface DebugSnapshot {
  points: number;
  zigzag: boolean;
  circle: boolean;
  square: boolean;
  mode: string;
  widthPx: number;
  heightPx: number;
  aspect: number;
  closure: number;
  flips: number;
  corners: number;
  quadrants: number;
  rawX: number;
  rawY: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  canvasW: number;
  canvasH: number;
}

const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({
  text,
  onAnnotationsChange,
  className = ''
}) => {
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const textContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const annotationContextRef = useRef<CanvasRenderingContext2D | null>(null);
  
  const [activeTool, setActiveTool] = useState<DrawingTool>('magic');
  const [annotations, setAnnotations] = useState<CanvasAnnotation[]>([]);
  const [isPencilActive, setIsPencilActive] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [currentPressure, setCurrentPressure] = useState(0.5);
  const [gesturePoints, setGesturePoints] = useState<Point[]>([]);
  const [magicToolMode, setMagicToolMode] = useState<'idle' | 'medium' | 'high' | 'low'>('idle');
  const [debugEnabled, setDebugEnabled] = useState<boolean>(true);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [debugSnapshot, setDebugSnapshot] = useState<DebugSnapshot>({ 
    points: 0, zigzag: false, circle: false, square: false, mode: 'idle', 
    widthPx: 0, heightPx: 0, aspect: 0, closure: 0, flips: 0, corners: 0, 
    quadrants: 0, rawX: 0, rawY: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, 
    canvasW: 0, canvasH: 0 
  });
  const { toast } = useToast();

  // Initialize dual-layer canvas system
  useEffect(() => {
    const textCanvas = textCanvasRef.current;
    const annotationCanvas = annotationCanvasRef.current;
    if (!textCanvas || !annotationCanvas) return;

    // Set canvas sizes for iPad
    const width = 1024;
    const height = 768;
    
    textCanvas.width = width;
    textCanvas.height = height;
    annotationCanvas.width = width;
    annotationCanvas.height = height;
    
    const textContext = textCanvas.getContext('2d');
    const annotationContext = annotationCanvas.getContext('2d');
    if (!textContext || !annotationContext) return;

    // Configure text canvas for crisp text rendering
    textContext.lineCap = 'round';
    textContext.lineJoin = 'round';
    textContext.imageSmoothingEnabled = true;
    
    // Configure annotation canvas for smooth drawing
    annotationContext.lineCap = 'round';
    annotationContext.lineJoin = 'round';
    annotationContext.imageSmoothingEnabled = true;
    annotationContext.globalCompositeOperation = 'source-over';
    
    textContextRef.current = textContext;
    annotationContextRef.current = annotationContext;

    // Draw initial text on text layer only
    drawTextContent(textContext, text);
  }, [text]);

  const drawTextContent = (ctx: CanvasRenderingContext2D, textContent: string) => {
    // Clear canvas with premium white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Configure premium text style
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '18px -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Split text into lines and render with better typography
    const lines = textContent.split('\n');
    let y = 80;
    const lineHeight = 28;
    const maxWidth = 880;

    lines.forEach(line => {
      if (line.trim()) {
        // Word wrap for long lines with better spacing
        const words = line.split(' ');
        let currentLine = '';
        
        words.forEach(word => {
          const testLine = currentLine + word + ' ';
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth && currentLine !== '') {
            ctx.fillText(currentLine, 80, y);
            currentLine = word + ' ';
            y += lineHeight;
          } else {
            currentLine = testLine;
          }
        });
        
        if (currentLine) {
          ctx.fillText(currentLine, 80, y);
          y += lineHeight;
        }
      }
      y += lineHeight * 0.6; // Improved paragraph spacing
    });
  };

  // Debug snapshot update with comprehensive tracking
  const addDebugLog = useCallback((message: string) => {
    if (!debugEnabled) return;
    setDebugLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${message}`]);
  }, [debugEnabled]);

  // Update debug snapshot with all trackable data
  const updateDebugSnapshot = useCallback((updates: Partial<DebugSnapshot>) => {
    setDebugSnapshot(prev => ({ ...prev, ...updates }));
  }, []);

  // Enhanced zig-zag detection with comprehensive tracking
  const detectZigZagGesture = useCallback((points: Point[]): boolean => {
    if (points.length < 10) {
      addDebugLog(`ZigZag: Insufficient points (${points.length}/10)`);
      return false;
    }
    
    let directionChanges = 0;
    let previousDirection: 'up' | 'down' | null = null;
    const directions: string[] = [];
    let totalVerticalMovement = 0;
    let horizontalSpread = 0;
    
    if (points.length > 0) {
      const xCoords = points.map(p => p.x);
      horizontalSpread = Math.max(...xCoords) - Math.min(...xCoords);
    }
    
    for (let i = 1; i < points.length; i++) {
      const yDiff = points[i].y - points[i - 1].y;
      totalVerticalMovement += Math.abs(yDiff);
      
      if (Math.abs(yDiff) > 5) { // Threshold for meaningful direction change
        const currentDirection = yDiff > 0 ? 'down' : 'up';
        directions.push(currentDirection);
        
        if (previousDirection && previousDirection !== currentDirection) {
          directionChanges++;
        }
        previousDirection = currentDirection;
      }
    }
    
    const isZigZag = directionChanges >= 3;
    const avgVerticalMovement = totalVerticalMovement / (points.length - 1);
    
    updateDebugSnapshot({ 
      flips: directionChanges,
      quadrants: directions.length
    });
    
    addDebugLog(`ZigZag Analysis: ${directionChanges} flips, ${totalVerticalMovement.toFixed(1)}px vertical, ${horizontalSpread.toFixed(1)}px horizontal, avg: ${avgVerticalMovement.toFixed(1)}, pattern: [${directions.slice(-5).join(',')}], result: ${isZigZag}`);
    return isZigZag;
  }, [addDebugLog, updateDebugSnapshot]);

  // Enhanced circle detection with detailed tracking
  const detectCircleGesture = useCallback((points: Point[]): boolean => {
    if (points.length < 15) {
      addDebugLog(`Circle: Insufficient points (${points.length}/15)`);
      return false;
    }
    
    // Calculate bounding box and center
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Check if shape is roughly circular (aspect ratio close to 1)
    const aspectRatio = Math.min(width, height) / Math.max(width, height);
    
    // Check closure - distance between first and last points
    const closure = Math.sqrt(
      Math.pow(points[0].x - points[points.length - 1].x, 2) +
      Math.pow(points[0].y - points[points.length - 1].y, 2)
    );
    const avgRadius = (width + height) / 4;
    const closureRatio = closure / avgRadius;
    
    // Calculate distance variation from center
    const distances = points.map(p => 
      Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2))
    );
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
    const stdDev = Math.sqrt(variance);
    const consistency = 1 - (stdDev / avgDistance);
    
    // Check quadrant coverage
    const quadrants = [0, 0, 0, 0]; // top-right, top-left, bottom-left, bottom-right
    points.forEach(p => {
      if (p.x >= centerX && p.y <= centerY) quadrants[0] = 1; // top-right
      if (p.x < centerX && p.y <= centerY) quadrants[1] = 1;  // top-left
      if (p.x < centerX && p.y > centerY) quadrants[2] = 1;   // bottom-left
      if (p.x >= centerX && p.y > centerY) quadrants[3] = 1;  // bottom-right
    });
    const quadrantCoverage = quadrants.reduce((a, b) => a + b, 0);
    
    const isCircle = aspectRatio >= 0.6 && closureRatio < 0.5 && consistency > 0.6 && quadrantCoverage >= 3;
    
    updateDebugSnapshot({ 
      aspect: aspectRatio,
      closure: closureRatio,
      quadrants: quadrantCoverage
    });
    
    addDebugLog(`Circle Analysis: ${width.toFixed(1)}×${height.toFixed(1)}px, aspect: ${aspectRatio.toFixed(2)}, closure: ${closure.toFixed(1)}px (${closureRatio.toFixed(2)}), consistency: ${consistency.toFixed(2)}, quadrants: ${quadrantCoverage}/4, center: (${centerX.toFixed(1)}, ${centerY.toFixed(1)}), avgR: ${avgRadius.toFixed(1)}, result: ${isCircle}`);
    return isCircle;
  }, [addDebugLog, updateDebugSnapshot]);

  // Enhanced square detection with corner analysis
  const detectSquareGesture = useCallback((points: Point[]): boolean => {
    if (points.length < 20) {
      addDebugLog(`Square: Insufficient points (${points.length}/20)`);
      return false;
    }
    
    // Calculate bounding box
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Check aspect ratio for square-like shape
    const aspectRatio = Math.min(width, height) / Math.max(width, height);
    
    // Check for corners by looking for direction changes
    let corners = 0;
    let straightSegments = 0;
    const cornerDetails: Array<{index: number, angle: number, pos: string}> = [];
    const threshold = Math.min(width, height) * 0.1; // 10% of smallest dimension
    
    for (let i = 5; i < points.length - 5; i++) {
      const prev = points[i - 5];
      const curr = points[i];
      const next = points[i + 5];
      
      const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
      let angleDiff = Math.abs(angle2 - angle1);
      
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      
      // Check for sharp turns (corners)
      if (angleDiff > Math.PI / 3) { // > 60 degrees
        corners++;
        const angleInDegrees = (angleDiff * 180 / Math.PI);
        const position = `(${curr.x.toFixed(0)},${curr.y.toFixed(0)})`;
        cornerDetails.push({index: i, angle: angleInDegrees, pos: position});
      }
      
      // Check for straight segments
      if (angleDiff < Math.PI / 12) { // < 15 degrees (fairly straight)
        straightSegments++;
      }
    }
    
    // Check closure
    const closure = Math.sqrt(
      Math.pow(points[0].x - points[points.length - 1].x, 2) +
      Math.pow(points[0].y - points[points.length - 1].y, 2)
    );
    const diagonal = Math.sqrt(width * width + height * height);
    const closureRatio = closure / diagonal;
    
    const isSquare = aspectRatio >= 0.7 && corners >= 3 && closureRatio < 0.3;
    
    updateDebugSnapshot({ 
      corners: corners,
      aspect: aspectRatio,
      closure: closureRatio
    });
    
    const cornerPositions = cornerDetails.slice(0, 4).map(c => `${c.pos}:${c.angle.toFixed(0)}°`).join(', ');
    addDebugLog(`Square Analysis: ${width.toFixed(1)}×${height.toFixed(1)}px, aspect: ${aspectRatio.toFixed(2)}, corners: ${corners} [${cornerPositions}], straight: ${straightSegments}, closure: ${closure.toFixed(1)}px (${closureRatio.toFixed(2)}), result: ${isSquare}`);
    return isSquare;
  }, [addDebugLog, updateDebugSnapshot]);

  const getMagicToolMode = (pressure: number, currentTool: DrawingTool): 'medium' | 'high' | 'low' => {
    if (currentTool !== 'magic') return 'medium';
    
    // Pressure-based switching for Magic Pencil
    if (pressure >= 0.7) return 'high';    // Hard press → High (red)
    return 'medium';                       // Light press → Medium (orange)
  };

  const getDrawingColor = (tool: DrawingTool, pressure: number = 1, magicMode?: 'idle' | 'medium' | 'high' | 'low'): string => {
    const intensity = Math.max(0.2, Math.min(1, pressure));
    const alpha = 0.3 + (intensity * 0.5);
    
    // Handle Magic Pencil mode
    if (tool === 'magic') {
      switch (magicMode) {
        case 'idle':
          return `rgba(100, 116, 139, ${alpha * 0.7})`; // Slate/gray while detecting
        case 'high': 
          return `rgba(239, 68, 68, ${alpha})`;  // Red
        case 'low': 
          return `rgba(59, 130, 246, ${alpha * 0.8})`;  // Blue
        case 'medium':
        default:
          return `rgba(249, 115, 22, ${alpha * 0.9})`;  // Orange
      }
    }
    
    switch (tool) {
      case 'high': 
        return `rgba(239, 68, 68, ${alpha})`;  // Red
      case 'medium': 
        return `rgba(249, 115, 22, ${alpha * 0.9})`;  // Orange
      case 'low': 
        return `rgba(59, 130, 246, ${alpha * 0.8})`;  // Blue
      case 'neutral': 
        return `rgba(234, 179, 8, ${alpha * 0.7})`;  // Yellow
      case 'eraser': 
        return '#ffffff';
      default: 
        return `rgba(239, 68, 68, ${alpha})`;
    }
  };

  const getStrokeWidth = (pressure: number, tool: DrawingTool): number => {
    const baseWidth = tool === 'eraser' ? 24 : 16;
    const pressureMultiplier = Math.max(0.6, Math.min(2.5, pressure));
    return Math.max(6, Math.min(40, baseWidth * pressureMultiplier));
  };

  const startDrawing = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === 'pan') return;

    const annotationCanvas = annotationCanvasRef.current;
    const ctx = annotationContextRef.current;
    if (!annotationCanvas || !ctx) return;

    setIsDrawing(true);
    
    const rect = annotationCanvas.getBoundingClientRect();
    const scaleX = annotationCanvas.width / rect.width;
    const scaleY = annotationCanvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    setLastPos({ x, y });

    // Detect Apple Pencil and handle eraser
    if (e.pointerType === 'pen') {
      setIsPencilActive(true);
      // Check if Apple Pencil is flipped (eraser mode)
      const twist = (e as any).twist;
      if (twist !== undefined && Math.abs(twist) > 90) {
        setActiveTool('eraser');
      }
    }

    // Get pressure and determine tool
    const pressure = e.pressure || 0.5;
    setCurrentPressure(pressure);
    
    // Handle Magic Pencil mode — start in idle (gray) until a gesture is recognized
    let effectiveTool = activeTool;
    let currentMagicMode: 'idle' | 'medium' | 'high' | 'low' = magicToolMode;
    if (activeTool === 'magic') {
      currentMagicMode = 'idle';
      setMagicToolMode('idle');
    }
    
    // Initialize gesture tracking
    setGesturePoints([{ x, y, time: Date.now() }]);
    
    const color = getDrawingColor(effectiveTool, pressure, currentMagicMode);
    const strokeWidth = getStrokeWidth(pressure, effectiveTool === 'magic' ? 'medium' : effectiveTool);

    // Configure drawing style for annotation layer only
    if (effectiveTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Add premium glow effect for non-eraser tools
    if (effectiveTool !== 'eraser') {
      ctx.shadowColor = color;
      ctx.shadowBlur = strokeWidth * 0.8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else {
      ctx.shadowBlur = 0;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [activeTool, magicToolMode]);

  const draw = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTool === 'pan') return;

    const annotationCanvas = annotationCanvasRef.current;
    const ctx = annotationContextRef.current;
    if (!annotationCanvas || !ctx) return;

    const rect = annotationCanvas.getBoundingClientRect();
    const scaleX = annotationCanvas.width / rect.width;
    const scaleY = annotationCanvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Update drawing properties based on pressure
    const pressure = e.pressure || 0.5;
    setCurrentPressure(pressure);
    
    // Update comprehensive debug snapshot with current drawing state
    const canvas = annotationCanvas;
    
    // Add gesture detection flag scope
    let gestureDetected = false;
    
    // Track gesture points for magic tool with detailed analysis
    if (activeTool === 'magic') {
      const newPoint = { x, y, time: Date.now() };
      const updatedPoints = [...gesturePoints, newPoint];
      setGesturePoints(updatedPoints);
      
      // Log coordinate details for debugging
      addDebugLog(`📍 Point #${updatedPoints.length}: Raw(${e.clientX}, ${e.clientY}) → Canvas(${x.toFixed(1)}, ${y.toFixed(1)}) | Scale: ${scaleX.toFixed(2)}×${scaleY.toFixed(2)} | Canvas: ${canvas.width}×${canvas.height}`);
      
      // Try to detect gestures with priority: Zig-Zag > Circle > Square
      let newMode: typeof magicToolMode = 'idle';
      let gestureDetected = false;
      let detectedColor = '';
      let gestureType = '';
      
      // GESTURE RECOGNITION ANCHOR POINT - Track detection attempts
      addDebugLog(`🔍 GESTURE ANALYSIS START - Points: ${updatedPoints.length}, Current mode: ${magicToolMode}`);
      
      if (detectZigZagGesture(updatedPoints)) {
        newMode = 'low';
        gestureDetected = true;
        detectedColor = getDrawingColor('magic', pressure, 'low');
        gestureType = 'ZIG-ZAG';
        addDebugLog('✅ 🔵 ZIG-ZAG DETECTED - Switching to LOW relevance (blue)');
        toast({
          title: "Zig-Zag Detected!",
          description: "Switched to Low relevance mode (blue)",
          duration: 1500,
        });
      } else if (detectCircleGesture(updatedPoints)) {
        newMode = 'high';
        gestureDetected = true;
        detectedColor = getDrawingColor('magic', pressure, 'high');
        gestureType = 'CIRCLE';
        addDebugLog('✅ 🔴 CIRCLE DETECTED - Switching to HIGH relevance (red)');
        toast({
          title: "Circle Detected!",
          description: "Switched to High relevance mode (red)",
          duration: 1500,
        });
      } else if (detectSquareGesture(updatedPoints)) {
        newMode = 'medium';
        gestureDetected = true;
        detectedColor = getDrawingColor('magic', pressure, 'medium');
        gestureType = 'SQUARE';
        addDebugLog('✅ 🟠 SQUARE DETECTED - Switching to MEDIUM relevance (orange)');
        toast({
          title: "Square Detected!",
          description: "Switched to Medium relevance mode (orange)",
          duration: 1500,
        });
      } else {
        addDebugLog(`❌ No gesture detected with ${updatedPoints.length} points`);
      }
      
      if (gestureDetected && newMode !== magicToolMode) {
        addDebugLog(`🎯 GESTURE ANCHOR: ${gestureType} confirmed at point ${updatedPoints.length}, switching ${magicToolMode} → ${newMode}`);
        setMagicToolMode(newMode);
        
        // Apply new color immediately
        ctx.strokeStyle = detectedColor;
        ctx.shadowColor = detectedColor;
        ctx.beginPath();
        
        // Reset gesture tracking without clearing completely
        setGesturePoints([{ x, y, time: Date.now() }]);
        
        addDebugLog(`🎨 Color switch applied: ${detectedColor}, Path reset, tracking restarted`);
      }
    }

    // Handle Magic Pencil mode - keep current mode during drawing to prevent flickering
    let effectiveTool = activeTool;
    let currentMagicMode = magicToolMode;

    // Only set color if gesture was NOT just detected to prevent override
    if (!gestureDetected) {
      const color = getDrawingColor(effectiveTool, pressure, currentMagicMode);
      const strokeWidth = getStrokeWidth(pressure, effectiveTool === 'magic' ? 'medium' : effectiveTool);
      
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      
      // Update premium glow effect
      if (effectiveTool !== 'eraser') {
        ctx.shadowColor = color;
        ctx.shadowBlur = strokeWidth * 0.8;
      }
    }

    // Continue drawing stroke
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    setLastPos({ x, y });

    // Update debug snapshot with current state
    updateDebugSnapshot({
      points: gesturePoints.length,
      rawX: e.clientX,
      rawY: e.clientY,
      x: x,
      y: y,
      scaleX: scaleX,
      scaleY: scaleY,
      canvasW: canvas.width,
      canvasH: canvas.height,
      mode: magicToolMode
    });
  }, [isDrawing, activeTool, magicToolMode, gesturePoints, detectZigZagGesture, detectCircleGesture, detectSquareGesture, addDebugLog, updateDebugSnapshot, toast]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    const ctx = annotationContextRef.current;
    if (ctx) {
      ctx.closePath();
    }
    
    // Clear gesture tracking
    setGesturePoints([]);
    
    // Create annotation record if drawing was substantial
    if (activeTool !== 'eraser' && activeTool !== 'pan') {
      const annotation: CanvasAnnotation = {
        id: Date.now().toString(),
        type: activeTool === 'magic' ? 
          (magicToolMode === 'high' ? 'high' : magicToolMode === 'low' ? 'low' : 'medium') :
          activeTool as 'high' | 'medium' | 'low' | 'neutral',
        pressure: currentPressure,
        timestamp: Date.now(),
        bounds: { x: lastPos.x, y: lastPos.y, width: 50, height: 50 }
      };
      
      setAnnotations(prev => {
        const updated = [...prev, annotation];
        onAnnotationsChange(updated);
        return updated;
      });
    }
  }, [isDrawing, activeTool, magicToolMode, currentPressure, lastPos, onAnnotationsChange]);

  const clearCanvas = () => {
    const ctx = annotationContextRef.current;
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    setAnnotations([]);
    setGesturePoints([]);
    onAnnotationsChange([]);
  };

  const colors = {
    high: 'rgba(239, 68, 68, 0.8)',
    medium: 'rgba(249, 115, 22, 0.8)', 
    low: 'rgba(59, 130, 246, 0.8)'
  };

  return (
    <div className={`relative w-full ${className}`}>
      {/* Enhanced Magic Debug Console */}
      {debugEnabled && (
        <div className="absolute top-4 right-4 bg-black/90 text-white p-3 rounded-lg text-xs font-mono max-w-lg z-10 select-text">
          <div className="flex justify-between items-center mb-2">
            <span className="text-green-400 font-bold">🔍 Magic Debug Console</span>
            <button
              onClick={() => setDebugEnabled(false)}
              className="text-gray-400 hover:text-white ml-2"
            >
              ✕
            </button>
          </div>
          
          {/* Current State */}
          <div className="grid grid-cols-2 gap-2 mb-3 p-2 bg-gray-900/50 rounded">
            <div>Points: <span className="text-blue-400">{debugSnapshot.points}</span></div>
            <div>Mode: <span className="text-yellow-400">{debugSnapshot.mode}</span></div>
            <div>Raw: <span className="text-gray-400">{debugSnapshot.rawX.toFixed(0)},{debugSnapshot.rawY.toFixed(0)}</span></div>
            <div>Canvas: <span className="text-gray-400">{debugSnapshot.x.toFixed(0)},{debugSnapshot.y.toFixed(0)}</span></div>
            <div>Scale: <span className="text-purple-400">{debugSnapshot.scaleX.toFixed(2)}×{debugSnapshot.scaleY.toFixed(2)}</span></div>
            <div>Size: <span className="text-cyan-400">{debugSnapshot.canvasW}×{debugSnapshot.canvasH}</span></div>
          </div>
          
          {/* Gesture Detection Status */}
          <div className="border-t border-gray-600 pt-2 mb-3">
            <div className="text-gray-300 font-semibold mb-1">Gesture Detection:</div>
            <div className="grid grid-cols-3 gap-2">
              <div>Zigzag: <span className={debugSnapshot.zigzag ? "text-blue-400" : "text-gray-500"}>{debugSnapshot.zigzag ? "✓" : "✗"}</span></div>
              <div>Circle: <span className={debugSnapshot.circle ? "text-red-400" : "text-gray-500"}>{debugSnapshot.circle ? "✓" : "✗"}</span></div>
              <div>Square: <span className={debugSnapshot.square ? "text-orange-400" : "text-gray-500"}>{debugSnapshot.square ? "✓" : "✗"}</span></div>
            </div>
            <div className="mt-1 text-xs text-gray-400">
              Aspect: {debugSnapshot.aspect.toFixed(2)} | Closure: {debugSnapshot.closure.toFixed(2)} | Flips: {debugSnapshot.flips} | Corners: {debugSnapshot.corners} | Quads: {debugSnapshot.quadrants}
            </div>
          </div>
          
          {/* Live Debug Logs */}
          <div className="border-t border-gray-600 pt-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400 text-xs">Live Debug Feed:</span>
              <button
                onClick={() => navigator.clipboard?.writeText(debugLogs.join('\n'))}
                className="text-xs text-blue-400 hover:text-blue-300"
                title="Copy all logs to clipboard"
              >
                📋 Copy
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 bg-gray-900/30 p-2 rounded select-text">
              {debugLogs.slice(-8).map((log, i) => (
                <div key={i} className="text-xs text-gray-200 leading-tight select-text" style={{userSelect: 'text'}}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tool palette */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gradient-to-r from-background/80 to-background/60 backdrop-blur-sm rounded-2xl border shadow-lg">
        {/* Magic Pencil */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setActiveTool('magic')}
            variant={activeTool === 'magic' ? 'default' : 'outline'}
            size="sm"
            className={`relative group transition-all duration-300 ${
              activeTool === 'magic' 
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105' 
                : 'hover:scale-105'
            }`}
          >
            <Palette className="h-4 w-4" />
            Magic Pencil
            {activeTool === 'magic' && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full animate-pulse"></div>
            )}
          </Button>
          {activeTool === 'magic' && (
            <Badge 
              variant="secondary" 
              className={`text-xs transition-all duration-300 ${
                magicToolMode === 'high' ? 'bg-red-100 text-red-800 border-red-200' :
                magicToolMode === 'medium' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                magicToolMode === 'low' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                'bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              {magicToolMode === 'idle' ? 'Detecting...' : `${magicToolMode} relevance`}
            </Badge>
          )}
        </div>

        {/* Standard tools */}
        <Button
          onClick={() => setActiveTool('high')}
          variant={activeTool === 'high' ? 'default' : 'outline'}
          size="sm"
          className={`transition-all duration-300 ${
            activeTool === 'high' 
              ? 'bg-red-500 text-white shadow-lg hover:bg-red-600 scale-105' 
              : 'hover:scale-105'
          }`}
        >
          <Heart className="h-4 w-4" />
          High
        </Button>
        
        <Button
          onClick={() => setActiveTool('medium')}
          variant={activeTool === 'medium' ? 'default' : 'outline'}
          size="sm"
          className={`transition-all duration-300 ${
            activeTool === 'medium' 
              ? 'bg-orange-500 text-white shadow-lg hover:bg-orange-600 scale-105' 
              : 'hover:scale-105'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Medium
        </Button>
        
        <Button
          onClick={() => setActiveTool('low')}
          variant={activeTool === 'low' ? 'default' : 'outline'}
          size="sm"
          className={`transition-all duration-300 ${
            activeTool === 'low' 
              ? 'bg-blue-500 text-white shadow-lg hover:bg-blue-600 scale-105' 
              : 'hover:scale-105'
          }`}
        >
          <ThumbsDown className="h-4 w-4" />
          Low
        </Button>
        
        <Button
          onClick={() => setActiveTool('neutral')}
          variant={activeTool === 'neutral' ? 'default' : 'outline'}
          size="sm"
          className={`transition-all duration-300 ${
            activeTool === 'neutral' 
              ? 'bg-yellow-500 text-white shadow-lg hover:bg-yellow-600 scale-105' 
              : 'hover:scale-105'
          }`}
        >
          <Minus className="h-4 w-4" />
          Neutral
        </Button>
        
        <Button
          onClick={() => setActiveTool('eraser')}
          variant={activeTool === 'eraser' ? 'default' : 'outline'}
          size="sm"
          className={`transition-all duration-300 ${
            activeTool === 'eraser' 
              ? 'bg-gray-700 text-white shadow-lg hover:bg-gray-800 scale-105' 
              : 'hover:scale-105'
          }`}
        >
          <Eraser className="h-4 w-4" />
          Eraser
        </Button>
        
        <Button
          onClick={() => setActiveTool('pan')}
          variant={activeTool === 'pan' ? 'default' : 'outline'}
          size="sm"
          className={`transition-all duration-300 ${
            activeTool === 'pan' 
              ? 'bg-green-500 text-white shadow-lg hover:bg-green-600 scale-105' 
              : 'hover:scale-105'
          }`}
        >
          <Hand className="h-4 w-4" />
          Pan
        </Button>

        <div className="ml-auto flex gap-2">
          <Button onClick={clearCanvas} variant="outline" size="sm" className="hover:scale-105 transition-all duration-300">
            <RotateCcw className="h-4 w-4" />
            Clear
          </Button>
          <Button 
            onClick={() => setDebugEnabled(!debugEnabled)} 
            variant="outline" 
            size="sm" 
            className="hover:scale-105 transition-all duration-300"
          >
            🔍 Debug
          </Button>
        </div>
      </div>

      {/* Canvas container */}
      <div className="relative w-full bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-100">
        <div className="relative aspect-[4/3] w-full max-w-full">
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Text canvas (background layer) */}
            <canvas
              ref={textCanvasRef}
              className="absolute inset-0 w-full h-auto pointer-events-none"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
            {/* Annotation canvas (overlay layer) */}
            <canvas
              ref={annotationCanvasRef}
              className="relative w-full touch-action-none cursor-crosshair"
              style={{ maxWidth: '100%', height: 'auto' }}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
            />
          </div>
        </div>
      </div>
      
      {/* Premium analytics cards */}
      {annotations.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-annotation-high/20 to-annotation-high/10 rounded-2xl transition-all duration-300"></div>
            <div className="relative bg-card/80 border border-annotation-high/20 rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300">
              <div className="text-3xl font-bold text-annotation-high mb-2">
                {annotations.filter(a => a.type === 'high').length}
              </div>
              <div className="text-sm font-medium text-muted-foreground">High Relevance</div>
              <div className="w-full h-2 bg-annotation-high/20 rounded-full mt-3">
                <div 
                  className="h-2 bg-annotation-high rounded-full transition-all duration-500"
                  style={{ width: `${(annotations.filter(a => a.type === 'high').length / annotations.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-annotation-medium/20 to-annotation-medium/10 rounded-2xl transition-all duration-300"></div>
            <div className="relative bg-card/80 border border-annotation-medium/20 rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300">
              <div className="text-3xl font-bold text-annotation-medium mb-2">
                {annotations.filter(a => a.type === 'medium').length}
              </div>
              <div className="text-sm font-medium text-muted-foreground">Medium Relevance</div>
              <div className="w-full h-2 bg-annotation-medium/20 rounded-full mt-3">
                <div 
                  className="h-2 bg-annotation-medium rounded-full transition-all duration-500"
                  style={{ width: `${(annotations.filter(a => a.type === 'medium').length / annotations.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-annotation-low/20 to-annotation-low/10 rounded-2xl transition-all duration-300"></div>
            <div className="relative bg-card/80 border border-annotation-low/20 rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300">
              <div className="text-3xl font-bold text-annotation-low mb-2">
                {annotations.filter(a => a.type === 'low').length}
              </div>
              <div className="text-sm font-medium text-muted-foreground">Low Relevance</div>
              <div className="w-full h-2 bg-annotation-low/20 rounded-full mt-3">
                <div 
                  className="h-2 bg-annotation-low rounded-full transition-all duration-500"
                  style={{ width: `${(annotations.filter(a => a.type === 'low').length / annotations.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-annotation-neutral/20 to-annotation-neutral/10 rounded-2xl transition-all duration-300"></div>
            <div className="relative bg-card/80 border border-annotation-neutral/20 rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300">
              <div className="text-3xl font-bold text-annotation-neutral mb-2">
                {annotations.filter(a => a.type === 'neutral').length}
              </div>
              <div className="text-sm font-medium text-muted-foreground">Neutral Content</div>
              <div className="w-full h-2 bg-annotation-neutral/20 rounded-full mt-3">
                <div 
                  className="h-2 bg-annotation-neutral rounded-full transition-all duration-500"
                  style={{ width: `${(annotations.filter(a => a.type === 'neutral').length / annotations.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveCanvas;
