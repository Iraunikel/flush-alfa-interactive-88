import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Palette, RotateCcw, Sparkles, MessageSquare, Copy, Clipboard, Edit3, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface Annotation {
  id: string;
  startIndex: number;
  endIndex: number;
  relevanceLevel: 'high' | 'medium' | 'neutral' | 'low';
  text: string;
  comment?: string;
}

interface AnnotationInterfaceProps {
  content: string;
  onContentChange: (content: string) => void;
  onAnnotationsChange: (annotations: Annotation[]) => void;
  onRefinePrompt: () => void;
  annotations: Annotation[];
}

const AnnotationInterface: React.FC<AnnotationInterfaceProps> = ({
  content,
  onContentChange,
  onAnnotationsChange,
  onRefinePrompt,
  annotations
}) => {
  // Store the original plain text content separately from the annotated display
  const [plainTextContent, setPlainTextContent] = useState(content);
  const [selectedRelevance, setSelectedRelevance] = useState<'high' | 'medium' | 'neutral' | 'low'>('high');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] = useState<Omit<Annotation, 'comment'> | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentPosition, setCommentPosition] = useState({ x: 0, y: 0 });
  const contentRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Update plain text when content changes
  useEffect(() => {
    setPlainTextContent(content);
  }, [content]);

  const relevanceLevels = [
    { key: 'high', label: 'High', color: 'high', description: 'Most relevant', emoji: '🔥' },
    { key: 'medium', label: 'Medium', color: 'medium', description: 'Somewhat relevant', emoji: '⚡' },
    { key: 'low', label: 'Low', color: 'low', description: 'Least relevant', emoji: '❄️' },
    { key: 'neutral', label: 'Neutral/Deselect', color: 'neutral', description: 'Neutral or Deselect', emoji: '⚪' }
  ] as const;

  // Helper function to convert DOM position to plain text position
  const getTextPosition = useCallback((node: Node, offset: number): number => {
    if (!contentRef.current) return 0;
    
    let textPosition = 0;
    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let currentNode = walker.nextNode();
    while (currentNode) {
      if (currentNode === node) {
        return textPosition + offset;
      }
      textPosition += currentNode.textContent?.length || 0;
      currentNode = walker.nextNode();
    }
    
    return textPosition;
  }, []);

  // Helper function to handle annotation creation with validated indices
  const handleAnnotationWithIndices = useCallback((startIndex: number, endIndex: number, selectedText: string, rect: DOMRect, containerRect: DOMRect) => {
    const selection = window.getSelection();
    
    // Handle neutral/deselect functionality
    if (selectedRelevance === 'neutral') {
      // Remove any existing annotations in this range
      const updatedAnnotations = annotations.filter(annotation => {
        return !(annotation.startIndex <= startIndex && annotation.endIndex >= endIndex) &&
               !(startIndex <= annotation.startIndex && endIndex >= annotation.endIndex) &&
               !(startIndex < annotation.endIndex && endIndex > annotation.startIndex);
      });
      onAnnotationsChange(updatedAnnotations);
      
      // Clear selection
      if (selection) selection.removeAllRanges();
      return;
    }

    // Create pending annotation
    const newAnnotation: Omit<Annotation, 'comment'> = {
      id: `annotation-${Date.now()}-${Math.random()}`,
      startIndex,
      endIndex,
      relevanceLevel: selectedRelevance,
      text: selectedText
    };

    // Auto-add annotation without comment first
    const finalAnnotation: Annotation = {
      ...newAnnotation
    };

    const updatedAnnotations = [...annotations, finalAnnotation];
    onAnnotationsChange(updatedAnnotations);

    // Show comment input for optional comment
    setPendingAnnotation(finalAnnotation);
    setCommentPosition({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.bottom - containerRect.top + 10
    });
    setShowCommentInput(true);

    // Clear selection
    if (selection) selection.removeAllRanges();
  }, [annotations, selectedRelevance, onAnnotationsChange]);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString().trim();
    
    if (!selectedText || !contentRef.current) return;

    // Get selection position for comment input
    const rect = range.getBoundingClientRect();
    const containerRect = contentRef.current.getBoundingClientRect();
    
    // Calculate text indices using proper DOM-to-text mapping
    const startIndex = getTextPosition(range.startContainer, range.startOffset);
    const endIndex = getTextPosition(range.endContainer, range.endOffset);
    
    // Validate that the selected text matches what we expect from plain text
    const actualSelectedText = plainTextContent.slice(startIndex, endIndex);
    if (actualSelectedText !== selectedText) {
      console.warn('Text selection mismatch, falling back to search');
      // Fallback: find the selected text in plain text content
      const fallbackStart = plainTextContent.indexOf(selectedText);
      if (fallbackStart === -1) return;
      const fallbackEnd = fallbackStart + selectedText.length;
      return handleAnnotationWithIndices(fallbackStart, fallbackEnd, selectedText, rect, containerRect);
    }

    return handleAnnotationWithIndices(startIndex, endIndex, selectedText, rect, containerRect);
  }, [plainTextContent, getTextPosition, handleAnnotationWithIndices]);

  // Handle click outside to close comment input
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (commentInputRef.current && !commentInputRef.current.contains(event.target as Node)) {
        if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
          setShowCommentInput(false);
          setPendingAnnotation(null);
          setCommentText('');
        }
      }
    };

    if (showCommentInput) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCommentInput]);

  const handleCommentSubmit = () => {
    if (!pendingAnnotation) return;

    // Update existing annotation with comment
    const updatedAnnotations = annotations.map(ann => 
      ann.id === pendingAnnotation.id 
        ? { ...ann, comment: commentText.trim() || undefined }
        : ann
    );
    onAnnotationsChange(updatedAnnotations);

    // Reset state
    setShowCommentInput(false);
    setPendingAnnotation(null);
    setCommentText('');
  };

  const handleCommentCancel = () => {
    setShowCommentInput(false);
    setPendingAnnotation(null);
    setCommentText('');
  };

  const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.textContent || '';
    onContentChange(newContent);
  };

  const clearAnnotations = () => {
    onAnnotationsChange([]);
  };

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied!",
        description: "Content copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const renderAnnotatedContent = () => {
    if (annotations.length === 0) {
      return plainTextContent;
    }

    // Create a map of character positions to annotations based on plain text
    const charMap: { [key: number]: Annotation[] } = {};
    annotations.forEach(annotation => {
      for (let i = annotation.startIndex; i < annotation.endIndex; i++) {
        if (!charMap[i]) charMap[i] = [];
        charMap[i].push(annotation);
      }
    });

    const result = [];
    let currentAnnotations: Annotation[] = [];
    let currentText = '';
    let currentStart = 0;

    const arraysEqual = (a: Annotation[], b: Annotation[]): boolean => {
      if (a.length !== b.length) return false;
      const aIds = a.map(ann => ann.id).sort();
      const bIds = b.map(ann => ann.id).sort();
      return aIds.every((id, index) => id === bIds[index]);
    };

    for (let i = 0; i < plainTextContent.length; i++) {
      const charAnnotations = charMap[i] || [];
      
      // Check if annotations changed
      const annotationsChanged = !arraysEqual(currentAnnotations, charAnnotations);
      
      if (annotationsChanged) {
        // Push current segment if it has content
        if (currentText) {
          if (currentAnnotations.length > 0) {
            // Find the highest priority annotation
            const primaryAnnotation = currentAnnotations.reduce((prev, curr) => {
              const priority = { high: 4, medium: 3, neutral: 2, low: 1 };
              return priority[curr.relevanceLevel] > priority[prev.relevanceLevel] ? curr : prev;
            });
            
            result.push(
              `<span
                class="
                  px-1.5 py-0.5 mx-0.5 rounded-sm cursor-pointer
                  text-foreground font-medium
                  transition-all duration-200 ease-out
                  hover:scale-[1.01]
                  relative
                "
                style="
                  background-color: hsl(var(--annotation-${primaryAnnotation.relevanceLevel}-bg));
                  border-left: 3px solid hsl(var(--annotation-${primaryAnnotation.relevanceLevel}));
                "
                title="${primaryAnnotation.comment || relevanceLevels.find(l => l.key === primaryAnnotation.relevanceLevel)?.description}"
              >
                ${currentText}
              </span>`
            );
          } else {
            result.push(currentText);
          }
        }
        
        // Reset for new segment
        currentAnnotations = charAnnotations;
        currentText = plainTextContent[i];
        currentStart = i;
      } else {
        currentText += plainTextContent[i];
      }
    }

    // Handle final segment
    if (currentText) {
      if (currentAnnotations.length > 0) {
        const primaryAnnotation = currentAnnotations.reduce((prev, curr) => {
          const priority = { high: 4, medium: 3, neutral: 2, low: 1 };
          return priority[curr.relevanceLevel] > priority[prev.relevanceLevel] ? curr : prev;
        });
        
        result.push(
          `<span
            class="
              px-1.5 py-0.5 mx-0.5 rounded-sm cursor-pointer
              text-foreground font-medium
              transition-all duration-200 ease-out
              hover:scale-[1.01]
              relative
            "
            style="
              background-color: hsl(var(--annotation-${primaryAnnotation.relevanceLevel}-bg));
              border-left: 3px solid hsl(var(--annotation-${primaryAnnotation.relevanceLevel}));
            "
            title="${primaryAnnotation.comment || relevanceLevels.find(l => l.key === primaryAnnotation.relevanceLevel)?.description}"
          >
            ${currentText}
          </span>`
        );
      } else {
        result.push(currentText);
      }
    }

    return result.join('');
  };

  return (
    <div className="space-y-6">
      {/* Annotation Controls */}
      <div className="flex flex-wrap items-center gap-4 p-5 bg-card rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-annotation-high to-annotation-low flex items-center justify-center">
            <Palette className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">Choose Relevance:</span>
        </div>
        
        <div className="flex gap-2">
          {relevanceLevels.map((level) => (
            <Button
              key={level.key}
              variant={selectedRelevance === level.key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedRelevance(level.key as any)}
              className={`
                h-9 text-xs font-medium transition-all duration-200 
                ${selectedRelevance === level.key 
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25' 
                  : `border-annotation-${level.color}/30 hover:bg-annotation-${level.color}-bg hover:border-annotation-${level.color}/50`
                }
              `}
            >
              <span className="mr-1.5">{level.emoji}</span>
              {level.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={clearAnnotations}
            className="h-8"
            disabled={annotations.length === 0}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              AI Response
              <span className="text-xs text-muted-foreground font-normal">(Click to edit)</span>
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyContent}
                className="h-7"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
              {annotations.length > 0 && (
                <Button
                  onClick={onRefinePrompt}
                  size="sm"
                  className="h-7 bg-gradient-to-r from-primary to-primary-glow"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Refine Prompt
                </Button>
              )}
            </div>
          </div>
          
          <div className="relative">
            <div
              ref={contentRef}
              className="min-h-32 text-sm select-text p-4 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 leading-relaxed"
              contentEditable
              suppressContentEditableWarning
              onInput={handleContentChange}
              onMouseUp={handleTextSelection}
              dangerouslySetInnerHTML={{ __html: renderAnnotatedContent() }}
              style={{ 
                userSelect: 'text',
                minHeight: '120px'
              }}
            />
            
            {/* Inline Comment Input */}
            {showCommentInput && pendingAnnotation && (
              <div 
                ref={commentInputRef}
                className="absolute z-10 bg-card/95 backdrop-blur-sm border rounded-lg shadow-lg p-3 min-w-64"
                style={{
                  left: `${commentPosition.x}px`,
                  top: `${commentPosition.y}px`,
                  transform: 'translateX(-50%)'
                }}
              >
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    <span className={`font-medium text-annotation-${pendingAnnotation.relevanceLevel}`}>
                      {relevanceLevels.find(l => l.key === pendingAnnotation.relevanceLevel)?.emoji} {relevanceLevels.find(l => l.key === pendingAnnotation.relevanceLevel)?.label}
                    </span>
                    {" - Selection highlighted"}
                  </div>
                  <div className="relative">
                    <Input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add or select next"
                      className="text-xs h-8 border-primary/20 pr-8"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCommentSubmit();
                        } else if (e.key === 'Escape') {
                          handleCommentCancel();
                        }
                      }}
                    />
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={handleCommentSubmit} 
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    >
                      ↵
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            💡 Select text to annotate with relevance levels. Non-selected areas will be kept without changes. Click to edit.
          </p>
        </div>
      </Card>

      {/* Annotation Heatmap */}
      <Card className="p-5 bg-gradient-to-br from-card to-card/50">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-gradient-to-r from-annotation-high to-annotation-low"></div>
          <h4 className="text-sm font-semibold text-foreground">Annotation Heatmap</h4>
        </div>
        
        {/* Visual Heatmap */}
        <div className="mb-6">
          <div className="h-8 rounded-lg overflow-hidden border bg-background/50 relative">
            {plainTextContent.length > 0 ? (
              <>
                {/* Calculate gradient based on actual text positions */}
                {(() => {
                  const textLength = plainTextContent.length;
                  let highChars = 0;
                  let mediumChars = 0;
                  let lowChars = 0;
                  let neutralChars = 0;

                  // Count characters for each relevance level
                  annotations.forEach(annotation => {
                    const length = annotation.endIndex - annotation.startIndex;
                    switch (annotation.relevanceLevel) {
                      case 'high': highChars += length; break;
                      case 'medium': mediumChars += length; break;
                      case 'low': lowChars += length; break;
                      default: neutralChars += length;
                    }
                  });

                  const highPercentage = Math.round((highChars / textLength) * 100);
                  const mediumPercentage = Math.round((mediumChars / textLength) * 100);
                  const lowPercentage = Math.round((lowChars / textLength) * 100);
                  const neutralPercentage = Math.round(((textLength - highChars - mediumChars - lowChars) / textLength) * 100);
                  const annotatedPercentage = 100 - neutralPercentage;

                  // Create gradient stops based on annotation percentages
                  let gradientStops = [];
                  let currentPosition = 0;

                  // Always start with blue (low relevance area)
                  if (lowPercentage > 0) {
                    gradientStops.push(`#3B82F6 ${currentPosition}%`);
                    currentPosition += lowPercentage;
                    gradientStops.push(`#3B82F6 ${currentPosition}%`);
                  }

                  // Add medium (yellow) if present
                  if (mediumPercentage > 0) {
                    if (lowPercentage > 0) {
                      gradientStops.push(`#F59E0B ${currentPosition}%`);
                    } else {
                      gradientStops.push(`#F59E0B ${currentPosition}%`);
                    }
                    currentPosition += mediumPercentage;
                    gradientStops.push(`#F59E0B ${currentPosition}%`);
                  }

                  // Add high (red) if present
                  if (highPercentage > 0) {
                    if (mediumPercentage > 0 || lowPercentage > 0) {
                      gradientStops.push(`#EF4444 ${currentPosition}%`);
                    } else {
                      gradientStops.push(`#EF4444 ${currentPosition}%`);
                    }
                    currentPosition += highPercentage;
                    gradientStops.push(`#EF4444 ${currentPosition}%`);
                  }

                  // Fill remaining with neutral (grey)
                  if (neutralPercentage > 0) {
                    if (annotatedPercentage > 0) {
                      gradientStops.push(`#9CA3AF ${currentPosition}%`);
                    } else {
                      gradientStops.push(`#9CA3AF 0%`);
                    }
                    gradientStops.push(`#9CA3AF 100%`);
                  }

                  // Default to neutral if no annotations
                  if (gradientStops.length === 0) {
                    gradientStops = ['#9CA3AF 0%', '#9CA3AF 100%'];
                  }

                  const gradientString = `linear-gradient(90deg, ${gradientStops.join(', ')})`;

                  return (
                    <>
                      <div 
                        className="absolute inset-0"
                        style={{
                          background: gradientString
                        }}
                      ></div>
                      
                      {/* Percentage displays positioned in their gradient areas */}
                      <div className="absolute inset-0 flex items-center">
                        {lowPercentage > 0 && (
                          <div 
                            className="flex items-center justify-center h-full text-white text-xs font-bold drop-shadow-sm"
                            style={{ 
                              width: `${lowPercentage}%`,
                              position: 'absolute',
                              left: '0%'
                            }}
                          >
                            ❄️{lowPercentage}%
                          </div>
                        )}
                        {mediumPercentage > 0 && (
                          <div 
                            className="flex items-center justify-center h-full text-white text-xs font-bold drop-shadow-sm"
                            style={{ 
                              width: `${mediumPercentage}%`,
                              position: 'absolute',
                              left: `${lowPercentage}%`
                            }}
                          >
                            ⚡{mediumPercentage}%
                          </div>
                        )}
                        {highPercentage > 0 && (
                          <div 
                            className="flex items-center justify-center h-full text-white text-xs font-bold drop-shadow-sm"
                            style={{ 
                              width: `${highPercentage}%`,
                              position: 'absolute',
                              left: `${lowPercentage + mediumPercentage}%`
                            }}
                          >
                            🔥{highPercentage}%
                          </div>
                        )}
                        {neutralPercentage > 0 && (
                          <div 
                            className="flex items-center justify-center h-full text-white text-xs font-bold drop-shadow-sm"
                            style={{ 
                              width: `${neutralPercentage}%`,
                              position: 'absolute',
                              left: `${lowPercentage + mediumPercentage + highPercentage}%`
                            }}
                          >
                            ⚪{neutralPercentage}%
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-gray-400 to-gray-400 flex items-center justify-center">
                <span className="text-xs text-white font-bold drop-shadow-sm">100% Neutral</span>
              </div>
            )}
          </div>
          
        </div>

      </Card>

      {/* All Annotations List */}
      {annotations.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <h4 className="text-sm font-semibold text-foreground">All Annotations ({annotations.length})</h4>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAnnotations}
              className="h-7 text-xs"
              disabled={annotations.length === 0}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Clear All
            </Button>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {annotations.map((annotation, index) => (
              <div key={annotation.id} className="border rounded-lg p-3 bg-background/50 group relative">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-annotation-${annotation.relevanceLevel} font-medium text-xs`}>
                    {relevanceLevels.find(l => l.key === annotation.relevanceLevel)?.emoji} {relevanceLevels.find(l => l.key === annotation.relevanceLevel)?.label}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const updatedAnnotations = annotations.filter(a => a.id !== annotation.id);
                      onAnnotationsChange(updatedAnnotations);
                    }}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    ✕
                  </Button>
                </div>
                <div className="text-xs text-foreground mb-2 font-medium">
                  "{annotation.text}"
                </div>
                {annotation.comment && (
                  <div className="text-xs text-muted-foreground italic">
                    💬 {annotation.comment}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AnnotationInterface;