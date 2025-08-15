import React, { useState } from 'react';
import FlushHeader from './FlushHeader';
import AnnotationInterface, { type Annotation } from './AnnotationInterface';
import PromptRefinement from './PromptRefinement';
import AnalyticsDashboard from './AnalyticsDashboard';

const FlushApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'annotate' | 'analytics'>('annotate');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [content, setContent] = useState("Paste your AI response here to start annotating...");

  const handleAnnotationsChange = (newAnnotations: Annotation[]) => {
    setAnnotations(newAnnotations);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleRefinePrompt = () => {
    // Smooth scroll to refine section
    const refineSection = document.getElementById('refine-section');
    if (refineSection) {
      refineSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'annotate':
        return (
          <div className="space-y-8">
            <AnnotationInterface
              content={content}
              onContentChange={handleContentChange}
              onAnnotationsChange={handleAnnotationsChange}
              onRefinePrompt={handleRefinePrompt}
              annotations={annotations}
            />
            
            <div id="refine-section">
              <PromptRefinement
                originalPrompt="Enter your original prompt here..."
                originalResponse={content}
                annotations={annotations}
              />
            </div>
          </div>
        );
      case 'analytics':
        return (
          <AnalyticsDashboard
            annotations={annotations}
            originalPrompt="Enter your original prompt here..."
            originalResponse={content}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <FlushHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        annotationCount={annotations.length}
      />
      
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-5xl mx-auto">
          {renderActiveTab()}
        </div>
      </main>
    </div>
  );
};

export default FlushApp;