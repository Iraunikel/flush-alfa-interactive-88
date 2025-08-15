import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Target, BarChart3, PenTool } from 'lucide-react';

interface FlushHeaderProps {
  activeTab: 'annotate' | 'analytics';
  onTabChange: (tab: 'annotate' | 'analytics') => void;
  annotationCount: number;
}

const FlushHeader: React.FC<FlushHeaderProps> = ({ 
  activeTab, 
  onTabChange, 
  annotationCount 
}) => {
  const tabs = [
    { 
      key: 'annotate', 
      label: 'Annotate & Refine', 
      icon: PenTool, 
      description: 'Mark relevance levels and refine prompts',
      disabled: false
    },
    { 
      key: 'analytics', 
      label: 'Analytics', 
      icon: BarChart3, 
      description: 'Track improvement metrics',
      disabled: annotationCount === 0
    }
  ] as const;

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-4">
        {/* Brand */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Flush</h1>
              <p className="text-sm text-muted-foreground">Clear the noise, focus on what matters</p>
            </div>
          </div>
          
          {annotationCount > 0 && (
            <Badge variant="secondary" className="text-sm">
              {annotationCount} annotation{annotationCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const isDisabled = tab.disabled;
            
            return (
              <Button
                key={tab.key}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => !isDisabled && onTabChange(tab.key as any)}
                disabled={isDisabled}
                className={`h-auto p-3 flex-col gap-1 min-w-24 ${
                  isActive ? 'bg-primary text-primary-foreground shadow-sm' : ''
                } ${isDisabled ? 'opacity-50' : ''}`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{tab.label}</span>
              </Button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default FlushHeader;