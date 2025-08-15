import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Download, FileText, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Annotation } from './AnnotationInterface';

interface PromptRefinementProps {
  originalPrompt: string;
  originalResponse: string;
  annotations: Annotation[];
}

const PromptRefinement: React.FC<PromptRefinementProps> = ({
  originalPrompt,
  originalResponse,
  annotations
}) => {
  const { toast } = useToast();

  const generateRefinedPrompt = () => {
    if (annotations.length === 0) return originalPrompt;

    const highRelevanceTexts = annotations
      .filter(a => a.relevanceLevel === 'high')
      .map(a => a.text);
    
    const lowRelevanceTexts = annotations
      .filter(a => a.relevanceLevel === 'low')
      .map(a => a.text);

    const mediumRelevanceTexts = annotations
      .filter(a => a.relevanceLevel === 'medium')
      .map(a => a.text);

    let refinedPrompt = `${originalPrompt}\n\n**Refinement Instructions based on user feedback:**\n`;

    if (highRelevanceTexts.length > 0) {
      refinedPrompt += `\n✅ **FOCUS MORE ON THESE ASPECTS** (user marked as highly relevant):\n`;
      annotations.filter(a => a.relevanceLevel === 'high').forEach(annotation => {
        refinedPrompt += `- "${annotation.text.slice(0, 100)}${annotation.text.length > 100 ? '...' : ''}"\n`;
        if (annotation.comment) {
          refinedPrompt += `  Context: ${annotation.comment}\n`;
        }
      });
    }

    if (mediumRelevanceTexts.length > 0) {
      refinedPrompt += `\n⚖️ **MAINTAIN BALANCE** (moderately relevant):\n`;
      annotations.filter(a => a.relevanceLevel === 'medium').forEach(annotation => {
        refinedPrompt += `- "${annotation.text.slice(0, 100)}${annotation.text.length > 100 ? '...' : ''}"\n`;
        if (annotation.comment) {
          refinedPrompt += `  Context: ${annotation.comment}\n`;
        }
      });
    }

    if (lowRelevanceTexts.length > 0) {
      refinedPrompt += `\n❌ **REDUCE OR AVOID** (user marked as less relevant):\n`;
      annotations.filter(a => a.relevanceLevel === 'low').forEach(annotation => {
        refinedPrompt += `- "${annotation.text.slice(0, 100)}${annotation.text.length > 100 ? '...' : ''}"\n`;
        if (annotation.comment) {
          refinedPrompt += `  Context: ${annotation.comment}\n`;
        }
      });
    }

    refinedPrompt += `\nPlease provide a new response that emphasizes the highly relevant aspects while minimizing the less relevant content.`;

    return refinedPrompt;
  };

  const refinedPrompt = generateRefinedPrompt();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const downloadAsText = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded!",
      description: `${filename} saved to your downloads`,
    });
  };

  const getAnnotationStats = () => {
    const total = annotations.length;
    const high = annotations.filter(a => a.relevanceLevel === 'high').length;
    const medium = annotations.filter(a => a.relevanceLevel === 'medium').length;
    const neutral = annotations.filter(a => a.relevanceLevel === 'neutral').length;
    const low = annotations.filter(a => a.relevanceLevel === 'low').length;
    const noiseReduction = total > 0 ? Math.round((low / total) * 100) : 0;
    
    return { total, high, medium, neutral, low, noiseReduction };
  };

  const stats = getAnnotationStats();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6" />
          Prompt Refinement
        </h2>
        <p className="text-muted-foreground">
          Generate improved prompts based on your {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Refined Prompt */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Refined Prompt</h3>
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-xs">
              {annotations.length} annotation{annotations.length !== 1 ? 's' : ''} applied
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(refinedPrompt, "Refined prompt")}
              className="h-7"
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadAsText(refinedPrompt, "refined-prompt.txt")}
              className="h-7"
            >
              <Download className="w-3 h-3 mr-1" />
              Download
            </Button>
          </div>
        </div>
        
        <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto">
          {annotations.length > 0 ? (
            <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
              {refinedPrompt}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Your refined prompt will appear here after you highlight text and add annotations above.
            </p>
          )}
        </div>
      </Card>

      {/* Analytics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Refinement Analytics
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-annotation-high">{stats.high}</div>
            <div className="text-xs text-muted-foreground">High</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-annotation-medium">{stats.medium}</div>
            <div className="text-xs text-muted-foreground">Medium</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-annotation-neutral">{stats.neutral}</div>
            <div className="text-xs text-muted-foreground">Neutral</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-annotation-low">{stats.low}</div>
            <div className="text-xs text-muted-foreground">Low</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive">{stats.noiseReduction}%</div>
            <div className="text-xs text-muted-foreground">Noise</div>
          </div>
        </div>
      </Card>

    </div>
  );
};

export default PromptRefinement;