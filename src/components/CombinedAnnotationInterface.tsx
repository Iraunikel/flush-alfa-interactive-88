import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PenTool, Type, BarChart3, Sparkles } from 'lucide-react';
import InteractiveCanvas, { type CanvasAnnotation } from './InteractiveCanvas';
import AnnotationInterface, { type Annotation } from './AnnotationInterface';
import PromptRefinement from './PromptRefinement';

interface CombinedAnnotationInterfaceProps {
  content: string;
  onContentChange: (content: string) => void;
}

const CombinedAnnotationInterface: React.FC<CombinedAnnotationInterfaceProps> = ({
  content,
  onContentChange
}) => {
  const [canvasAnnotations, setCanvasAnnotations] = useState<CanvasAnnotation[]>([]);
  const [textAnnotations, setTextAnnotations] = useState<Annotation[]>([]);
  const [activeMode, setActiveMode] = useState<'canvas' | 'text'>('canvas');

  const handleCanvasAnnotationsChange = (newAnnotations: CanvasAnnotation[]) => {
    setCanvasAnnotations(newAnnotations);
  };

  const handleTextAnnotationsChange = (newAnnotations: Annotation[]) => {
    setTextAnnotations(newAnnotations);
  };

  const handleRefinePrompt = () => {
    const element = document.getElementById('prompt-refinement');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Combine both annotation types for total count
  const totalAnnotations = canvasAnnotations.length + textAnnotations.length;

  return (
    <div className="space-y-8">
      {/* Mode Selection */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Annotation Interface</h2>
          {totalAnnotations > 0 && (
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {totalAnnotations} annotation{totalAnnotations !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        <Tabs value={activeMode} onValueChange={(value) => setActiveMode(value as 'canvas' | 'text')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="canvas" className="flex items-center gap-2">
              <PenTool className="w-4 h-4" />
              Canvas Drawing
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-2">
              <Type className="w-4 h-4" />
              Text Selection
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="canvas" className="mt-6">
            <InteractiveCanvas
              text={content}
              onAnnotationsChange={handleCanvasAnnotationsChange}
            />
          </TabsContent>
          
          <TabsContent value="text" className="mt-6">
            <AnnotationInterface
              content={content}
              onContentChange={onContentChange}
              onAnnotationsChange={handleTextAnnotationsChange}
              onRefinePrompt={handleRefinePrompt}
              annotations={textAnnotations}
            />
          </TabsContent>
        </Tabs>
      </Card>

      {/* Analytics Dashboard */}
      {totalAnnotations > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5" />
            <h3 className="text-lg font-semibold text-foreground">Combined Analytics</h3>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{totalAnnotations}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-annotation-high">
                {canvasAnnotations.filter(a => a.type === 'high').length + textAnnotations.filter(a => a.relevanceLevel === 'high').length}
              </div>
              <div className="text-sm text-muted-foreground">High</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-annotation-medium">
                {canvasAnnotations.filter(a => a.type === 'medium').length + textAnnotations.filter(a => a.relevanceLevel === 'medium').length}
              </div>
              <div className="text-sm text-muted-foreground">Medium</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-annotation-low">
                {canvasAnnotations.filter(a => a.type === 'low').length + textAnnotations.filter(a => a.relevanceLevel === 'low').length}
              </div>
              <div className="text-sm text-muted-foreground">Low</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-annotation-neutral">
                {canvasAnnotations.filter(a => a.type === 'neutral').length + textAnnotations.filter(a => a.relevanceLevel === 'neutral').length}
              </div>
              <div className="text-sm text-muted-foreground">Neutral</div>
            </div>
          </div>
        </Card>
      )}

      {/* Prompt Refinement */}
      {totalAnnotations > 0 && (
        <div id="prompt-refinement">
          <PromptRefinement
            originalPrompt="Please analyze this AI response and improve it based on my feedback:"
            originalResponse={content}
            annotations={[
              ...canvasAnnotations.map(a => ({
                id: a.id,
                text: `Canvas ${a.type} annotation`,
                relevanceLevel: a.type,
                comment: `Canvas drawing with ${Math.round(a.pressure * 100)}% pressure`,
                startIndex: 0,
                endIndex: 50
              })),
              ...textAnnotations
            ]}
          />
        </div>
      )}
    </div>
  );
};

export default CombinedAnnotationInterface;