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
  const [gesturePoints, setGesturePoints] = useState<Array<{ x: number; y: number; time: number }>>([]);
  const [magicToolMode, setMagicToolMode] = useState<'idle' | 'medium' | 'high' | 'low'>('idle');
  const [debugEnabled, setDebugEnabled] = useState<boolean>(true);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [debugSnapshot, setDebugSnapshot] = useState<{ points: number; zigzag: boolean; circle: boolean; square: boolean; mode: string }>({ points: 0, zigzag: false, circle: false, square: false, mode: 'idle' });
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

  // Enhanced Gesture Detection Functions
  const detectCircleGesture = (points: Array<{ x: number; y: number; time: number }>): boolean => {
    if (points.length < 8) return false;
    
    // Calculate bounding box
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Require minimum size and roughly circular proportions (very lenient for desktop)
    if (width < 6 || height < 6) return false;
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    if (aspectRatio > 4.0) return false;
    
    // Simple circular motion detection - check if path curves around
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Count points in different quadrants
    let quadrants = [0, 0, 0, 0];
    points.forEach(point => {
      const dx = point.x - centerX;
      const dy = point.y - centerY;
      
      if (dx >= 0 && dy >= 0) quadrants[0]++;      // Top-right
      else if (dx < 0 && dy >= 0) quadrants[1]++;  // Top-left
      else if (dx < 0 && dy < 0) quadrants[2]++;   // Bottom-left
      else quadrants[3]++;                         // Bottom-right
    });
    
    // Must have points in at least 3 quadrants for circular motion
    const activeQuadrants = quadrants.filter(q => q > 0).length;
    
    // Also check if we have some closure (start and end points reasonably close)
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const closureDistance = Math.sqrt(Math.pow(lastPoint.x - firstPoint.x, 2) + Math.pow(lastPoint.y - firstPoint.y, 2));
    const maxDimension = Math.max(width, height);
    
    return activeQuadrants >= 3 && closureDistance < maxDimension * 0.95;
  };

  const detectSquareGesture = (points: Array<{ x: number; y: number; time: number }>): boolean => {
    if (points.length < 8) return false;
    
    // Find bounding box
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Require minimum size and reasonable proportions for square/rectangle (very lenient)
    if (width < 6 || height < 6) return false;
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    if (aspectRatio > 5.0) return false;
    
    // Check closure (should end near start for complete square) - relaxed
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const closureDistance = Math.sqrt(Math.pow(lastPoint.x - firstPoint.x, 2) + Math.pow(lastPoint.y - firstPoint.y, 2));
    if (closureDistance > Math.max(width, height) * 0.98) return false;
    
    // Simplified corner detection
    let corners = 0;
    let i = 4;
    while (i < points.length - 4) {
      const dx1 = points[i].x - points[i - 4].x;
      const dy1 = points[i].y - points[i - 4].y;
      const dx2 = points[i + 4].x - points[i].x;
      const dy2 = points[i + 4].y - points[i].y;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (len1 >= 6 && len2 >= 6) {
        const angle1 = Math.atan2(dy1, dx1);
        const angle2 = Math.atan2(dy2, dx2);
        let angleDiff = Math.abs(angle2 - angle1);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        if (angleDiff > Math.PI / 3) corners = corners + 1;
      }
      i = i + 2;
    }
    return corners >= 3;
  };

  const detectZigZagGesture = (points: Array<{ x: number; y: number; time: number }>): boolean => {
    if (points.length < 6) return false;
    
    let directionChanges = 0;
    let lastDirection: 'up' | 'down' | null = null;
    let i = 2;
    while (i < points.length) {
      const currentY = points[i].y;
      const previousY = points[i - 2].y;
      const deltaY = currentY - previousY;
      if (Math.abs(deltaY) >= 1) {
        const currentDirection = deltaY > 0 ? 'down' : 'up';
        if (lastDirection && lastDirection !== currentDirection) {
          directionChanges++;
        }
        lastDirection = currentDirection;
      }
      i = i + 1;
    }
    return directionChanges >= 2;
  };

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
  }, [activeTool]);

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
    
    // Update gesture tracking with real-time detection (keep only recent points)
    let updatedPoints: Array<{ x: number; y: number; time: number }> = [];
    setGesturePoints((prev) => {
      updatedPoints = [...prev, { x, y, time: Date.now() }].slice(-40);
      return updatedPoints;
    });
    if (debugEnabled) {
      setDebugSnapshot((prev) => ({ ...prev, points: updatedPoints.length }));
    }

    // Add gesture detection flag scope
    let gestureDetected = false;
    let newMode: 'medium' | 'high' | 'low' | null = null;

    // Real-time gesture detection for Magic Pencil - reduced threshold for faster detection
    if (activeTool === 'magic' && updatedPoints.length >= 6) {
      
      // Debug logging
      const isZigZag = detectZigZagGesture(updatedPoints);
      const isCircle = detectCircleGesture(updatedPoints);
      const isSquare = detectSquareGesture(updatedPoints);
      if (debugEnabled) {
        setDebugSnapshot({ points: updatedPoints.length, zigzag: isZigZag, circle: isCircle, square: isSquare, mode: magicToolMode });
        setDebugLogs((prev) => [`points=${updatedPoints.length} z:${isZigZag} c:${isCircle} s:${isSquare} mode:${magicToolMode}`, ...prev].slice(0, 50));
      }
      
      // Check for zig-zag first (Low relevance)
      if (isZigZag) {
        newMode = 'low';
        gestureDetected = true;
        if (debugEnabled) setDebugLogs((prev) => ["DETECTED: zigzag -> low", ...prev].slice(0, 50));
        toast({
          title: "Zig-zag gesture detected!",
          description: "Switched to Low relevance (Blue)",
          duration: 1500,
        });
      }
      // Then check for circle (High relevance)
      else if (isCircle) {
        newMode = 'high';
        gestureDetected = true;
        if (debugEnabled) setDebugLogs((prev) => ["DETECTED: circle -> high", ...prev].slice(0, 50));
        toast({
          title: "Circle gesture detected!",
          description: "Switched to High relevance (Red)",
          duration: 1500,
        });
      }
      // Finally check for square (Medium relevance)
      else if (isSquare) {
        newMode = 'medium';
        gestureDetected = true;
        if (debugEnabled) setDebugLogs((prev) => ["DETECTED: square -> medium", ...prev].slice(0, 50));
        toast({
          title: "Square gesture detected!",
          description: "Switched to Medium relevance (Orange)",
          duration: 1500,
        });
      }

      // Apply gesture detection immediately
      if (newMode && newMode !== magicToolMode) {
        setMagicToolMode(newMode);
        
        // Get new color and apply immediately
        const newColor = getDrawingColor('magic', pressure, newMode);
        const newStrokeWidth = getStrokeWidth(pressure, 'medium');
        ctx.strokeStyle = newColor;
        ctx.lineWidth = newStrokeWidth;
        ctx.shadowColor = newColor;
        ctx.beginPath();
        if (debugEnabled) setDebugLogs((prev) => [`APPLY: mode=${newMode}, color=${newColor}`, ...prev].slice(0, 50));
        
        // Reset gesture tracking without clearing completely
        setGesturePoints([{ x, y, time: Date.now() }]);
      }
    }
    
    // Handle Magic Pencil mode - use the newly detected mode if gesture was detected
    let effectiveTool = activeTool;
    let currentMagicMode: 'idle' | 'medium' | 'high' | 'low' = magicToolMode;
    if (gestureDetected && newMode) {
      currentMagicMode = newMode;
    }

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
      if (debugEnabled) setDebugLogs((prev) => [`DRAW: color=${color} width=${strokeWidth} mode=${currentMagicMode}`, ...prev].slice(0, 50));
    }
    
    ctx.lineTo(x, y);
    ctx.stroke();
    
    setLastPos({ x, y });
  }, [isDrawing, activeTool, magicToolMode]);

  const stopDrawing = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    setIsDrawing(false);
    setIsPencilActive(false);
    setCurrentPressure(0.5);
    setGesturePoints([]);

    // Use the selected tool for annotation counting
    const pressure = e.pressure || 0.5;
    let effectiveTool = activeTool;
    let annotationType: 'high' | 'medium' | 'low' | 'neutral' = 'medium';
    
    if (activeTool === 'magic') {
      // Convert magic mode to annotation type; idle means neutral
      if (magicToolMode === 'idle') {
        annotationType = 'neutral';
      } else {
        annotationType = magicToolMode;
      }
      // Don't reset magic tool mode - let it persist
    } else if (effectiveTool !== 'eraser' && effectiveTool !== 'pan') {
      annotationType = effectiveTool as 'high' | 'medium' | 'low' | 'neutral';
    }

    // Create annotation record
    const annotation: CanvasAnnotation = {
      id: `annotation-${Date.now()}-${Math.random()}`,
      type: annotationType,
      pressure: pressure,
      timestamp: Date.now(),
      bounds: {
        x: lastPos.x,
        y: lastPos.y,
        width: 50,
        height: 20
      }
    };

    if (effectiveTool !== 'eraser') {
      const newAnnotations = [...annotations, annotation];
      setAnnotations(newAnnotations);
      onAnnotationsChange(newAnnotations);
    }
  }, [isDrawing, activeTool, lastPos, annotations, onAnnotationsChange]);

  const handleClearCanvas = () => {
    const annotationCtx = annotationContextRef.current;
    if (annotationCtx) {
      // Clear only the annotation layer, preserve text layer
      annotationCtx.clearRect(0, 0, annotationCtx.canvas.width, annotationCtx.canvas.height);
      setAnnotations([]);
      onAnnotationsChange([]);
      
      toast({
        title: "Annotations cleared",
        description: "All annotations removed, text preserved",
      });
    }
  };

  const tools: Array<{
    id: DrawingTool;
    label: string;
    icon: any;
    color: string;
    description: string;
  }> = [
    {
      id: 'magic',
      label: 'Magic',
      icon: Palette,
      color: 'text-gradient-primary',
      description: 'Smart pressure & gesture adaptive tool'
    },
    {
      id: 'high',
      label: 'High',
      icon: Heart,
      color: 'text-red-500',
      description: 'High relevance'
    },
    {
      id: 'medium',
      label: 'Medium',
      icon: ThumbsUp,
      color: 'text-orange-500',
      description: 'Medium relevance'
    },
    {
      id: 'low',
      label: 'Low',
      icon: ThumbsDown,
      color: 'text-blue-500',
      description: 'Low relevance'
    },
    {
      id: 'neutral',
      label: 'Neutral',
      icon: Minus,
      color: 'text-yellow-500',
      description: 'Neutral/No weighting'
    },
    {
      id: 'eraser',
      label: 'Erase',
      icon: Eraser,
      color: 'text-muted-foreground',
      description: 'Remove annotations'
    },
    {
      id: 'pan',
      label: 'Pan',
      icon: Hand,
      color: 'text-muted-foreground',
      description: 'Move around canvas'
    }
  ];

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Premium glassmorphism toolbar - Fixed blur issue */}
      <div className="relative bg-card border border-border/50 rounded-3xl p-6 shadow-2xl transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-4 justify-center sm:justify-start">
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-annotation-high via-annotation-medium via-annotation-neutral to-annotation-low flex items-center justify-center shadow-lg">
              <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-sm" />
            </div>
            <div className="text-center sm:text-left">
              <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Smart Heatmap
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-2">
                {isPencilActive ? (
                  <>
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="hidden sm:inline">Apple Pencil • Pressure: {Math.round(currentPressure * 100)}%</span>
                    <span className="sm:hidden">Pencil {Math.round(currentPressure * 100)}%</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Touch Mode
                  </>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              
              return (
                <Button
                  key={tool.id}
                  variant={isActive ? "default" : "ghost"}
                  size="lg"
                  onClick={() => setActiveTool(tool.id)}
                  className={`
                    relative h-12 sm:h-16 px-3 sm:px-8 text-xs sm:text-sm font-medium transition-all duration-300 rounded-2xl
                    ${isActive 
                      ? 'bg-primary text-primary-foreground shadow-xl shadow-primary/25 scale-105' 
                      : 'hover:bg-accent/50 hover:scale-102'
                    }
                  `}
                  title={tool.description}
                >
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 sm:mr-3 ${isActive ? 'text-white' : tool.color}`} />
                  <span className="hidden sm:inline">{tool.label}</span>
                  {isActive && (
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-primary-glow/20"></div>
                  )}
                </Button>
              );
            })}
            
            <Button
              variant="outline"
              size="lg"
              onClick={handleClearCanvas}
              className="h-12 sm:h-16 px-3 sm:px-8 rounded-2xl transition-all duration-300 hover:scale-102 text-xs sm:text-sm"
              disabled={annotations.length === 0}
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-3" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Dual-layer canvas system */}
      <div className="relative bg-card/50 rounded-3xl border border-border/50 shadow-2xl overflow-hidden">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h3 className="text-2xl font-bold text-foreground">AI Response Canvas</h3>
              {annotations.length > 0 && (
                <Badge variant="secondary" className="text-sm px-3 py-1 rounded-full bg-primary/10 text-primary border-primary/20">
                  {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {activeTool === 'magic' && (
                <>
                  <span className={`w-3 h-3 rounded-full ${
                    magicToolMode === 'high' ? 'bg-red-500' : 
                    magicToolMode === 'low' ? 'bg-blue-500' : 
                    magicToolMode === 'medium' ? 'bg-orange-500' : 'bg-slate-400'
                  }`}></span> 
                  Magic Pencil
                  <button
                    type="button"
                    className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-100 border hover:bg-slate-200"
                    onClick={() => setDebugEnabled((v) => !v)}
                  >
                    {debugEnabled ? 'Hide debug' : 'Show debug'}
                  </button>
                </>
              )}
              {activeTool === 'high' && <><span className="w-3 h-3 bg-annotation-high rounded-full"></span> High relevance</>}
              {activeTool === 'medium' && <><span className="w-3 h-3 bg-annotation-medium rounded-full"></span> Medium relevance</>}
              {activeTool === 'low' && <><span className="w-3 h-3 bg-annotation-low rounded-full"></span> Low relevance</>}
              {activeTool === 'neutral' && <><span className="w-3 h-3 bg-annotation-neutral rounded-full"></span> Neutral content</>}
              {activeTool === 'eraser' && <><span className="w-3 h-3 bg-gray-400 rounded-full"></span> Eraser active</>}
              {activeTool === 'pan' && <><span className="w-3 h-3 bg-blue-400 rounded-full"></span> Pan mode</>}
            </div>
          </div>
          
          {debugEnabled && (
            <div className="mt-4 p-3 rounded-xl border text-xs font-mono bg-slate-50 text-slate-700">
              <div className="flex gap-3 flex-wrap">
                <span>points: {debugSnapshot.points}</span>
                <span>zigzag: {String(debugSnapshot.zigzag)}</span>
                <span>circle: {String(debugSnapshot.circle)}</span>
                <span>square: {String(debugSnapshot.square)}</span>
                <span>mode: {debugSnapshot.mode}</span>
              </div>
              <div className="mt-2 max-h-28 overflow-auto">
                {debugLogs.slice(0, 8).map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            </div>
          )}
          
          <div className="relative border-2 border-dashed border-border/30 rounded-2xl overflow-hidden shadow-inner bg-white">
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