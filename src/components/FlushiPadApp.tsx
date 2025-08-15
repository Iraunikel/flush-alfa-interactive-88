import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Zap, Sparkles, BarChart3, PenTool } from 'lucide-react';
import CombinedAnnotationInterface from './CombinedAnnotationInterface';

const FlushiPadApp: React.FC = () => {
  const [content, setContent] = useState(`Artificial Intelligence has revolutionized the way we interact with technology. From voice assistants to recommendation systems, AI is now an integral part of our daily lives.

Machine learning algorithms power search engines, social media feeds, and even the apps on our phones. The technology has advanced rapidly in recent years, with breakthroughs in neural networks and deep learning.

However, there are important considerations around ethics, privacy, and the future impact of AI on employment and society. As we continue to develop these systems, we must balance innovation with responsibility.

The next decade will likely bring even more sophisticated AI capabilities, including better natural language processing and more human-like interactions.`);
  
  const [activeTab, setActiveTab] = useState<'annotation' | 'analytics'>('annotation');

  return (
    <div className="min-h-screen bg-background">
      {/* iPad-optimized header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Flush</h1>
                <p className="text-lg text-muted-foreground">Clear the noise, focus on what matters</p>
              </div>
            </div>
            
          </div>

          {/* Touch-friendly navigation */}
          <nav className="flex gap-2">
            <Button
              variant={activeTab === 'annotation' ? "default" : "ghost"}
              size="lg"
              onClick={() => setActiveTab('annotation')}
              className="gesture-zone h-16 px-8 flex-col gap-1"
            >
              <PenTool className="w-5 h-5" />
              <span className="text-sm font-medium">Annotation Interface</span>
            </Button>
            <Button
              variant={activeTab === 'analytics' ? "default" : "ghost"}
              size="lg"
              onClick={() => setActiveTab('analytics')}
              className="gesture-zone h-16 px-8 flex-col gap-1"
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm font-medium">Analytics</span>
            </Button>
          </nav>
        </div>
      </header>

      {/* Main content optimized for iPad */}
      <main className="container mx-auto px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'annotation' ? (
            <CombinedAnnotationInterface
              content={content}
              onContentChange={setContent}
            />
          ) : (
            <Card className="p-8">
              <h3 className="text-2xl font-semibold text-foreground mb-6">Annotation Analytics</h3>
              <div className="text-center text-muted-foreground">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Switch to the Annotation Interface to create annotations and view analytics here.</p>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default FlushiPadApp;