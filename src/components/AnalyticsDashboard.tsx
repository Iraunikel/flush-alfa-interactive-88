import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Target, Zap, Clock, CheckCircle, BarChart3 } from 'lucide-react';
import type { Annotation } from './AnnotationInterface';

interface AnalyticsDashboardProps {
  annotations: Annotation[];
  originalPrompt: string;
  originalResponse: string;
}

interface KPIMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  description: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  color: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  annotations,
  originalPrompt,
  originalResponse
}) => {
  const metrics = useMemo((): KPIMetric[] => {
    const totalAnnotations = annotations.length;
    const highRelevance = annotations.filter(a => a.relevanceLevel === 'high').length;
    const lowRelevance = annotations.filter(a => a.relevanceLevel === 'low').length;
    const mediumRelevance = annotations.filter(a => a.relevanceLevel === 'medium').length;
    const neutralRelevance = annotations.filter(a => a.relevanceLevel === 'neutral').length;

    // Calculate metrics
    const noiseReductionRatio = totalAnnotations > 0 
      ? Math.round((lowRelevance / totalAnnotations) * 100) 
      : 0;

    const relevanceImprovementScore = totalAnnotations > 0
      ? Math.round(((highRelevance + mediumRelevance * 0.6 + neutralRelevance * 0.3) / totalAnnotations) * 100)
      : 0;

    const annotationCoverage = originalResponse.length > 0
      ? Math.round((annotations.reduce((sum, a) => sum + a.text.length, 0) / originalResponse.length) * 100)
      : 0;

    const focusScore = totalAnnotations > 0
      ? Math.round((highRelevance / totalAnnotations) * 100)
      : 0;

    const iterationReduction = noiseReductionRatio > 30 ? Math.round(noiseReductionRatio / 10) : 0;

    const taskCompletionPrediction = relevanceImprovementScore > 70 ? 85 : 
                                   relevanceImprovementScore > 50 ? 70 : 
                                   relevanceImprovementScore > 30 ? 55 : 35;

    return [
      {
        id: 'relevance',
        name: 'Relevance Improvement Score',
        value: relevanceImprovementScore,
        unit: '%',
        description: 'Weighted score based on annotation quality',
        trend: relevanceImprovementScore > 60 ? 'up' : 'neutral',
        icon: TrendingUp,
        color: 'text-primary'
      },
      {
        id: 'noise',
        name: 'Noise Reduction Ratio',
        value: noiseReductionRatio,
        unit: '%',
        description: 'Percentage of content marked as low relevance',
        trend: noiseReductionRatio > 20 ? 'up' : 'neutral',
        icon: TrendingDown,
        color: 'text-annotation-low'
      },
      {
        id: 'completion',
        name: 'Task Completion Prediction',
        value: taskCompletionPrediction,
        unit: '%',
        description: 'Predicted success rate with refined prompt',
        trend: taskCompletionPrediction > 70 ? 'up' : 'neutral',
        icon: CheckCircle,
        color: 'text-annotation-high'
      },
      {
        id: 'iterations',
        name: 'Iteration Reduction',
        value: iterationReduction,
        unit: 'cycles',
        description: 'Estimated reduction in prompt-response cycles',
        trend: iterationReduction > 2 ? 'up' : 'neutral',
        icon: Zap,
        color: 'text-primary-glow'
      },
      {
        id: 'focus',
        name: 'Focus Score',
        value: focusScore,
        unit: '%',
        description: 'Percentage of content marked as highly relevant',
        trend: focusScore > 40 ? 'up' : 'neutral',
        icon: Target,
        color: 'text-annotation-medium'
      },
      {
        id: 'coverage',
        name: 'Annotation Coverage',
        value: annotationCoverage,
        unit: '%',
        description: 'Percentage of response text annotated',
        trend: annotationCoverage > 30 ? 'up' : 'neutral',
        icon: Clock,
        color: 'text-muted-foreground'
      }
    ];
  }, [annotations, originalResponse]);

  const getAnnotationBreakdown = () => {
    const total = annotations.length;
    return {
      high: { count: annotations.filter(a => a.relevanceLevel === 'high').length, color: 'annotation-high' },
      medium: { count: annotations.filter(a => a.relevanceLevel === 'medium').length, color: 'annotation-medium' },
      neutral: { count: annotations.filter(a => a.relevanceLevel === 'neutral').length, color: 'annotation-neutral' },
      low: { count: annotations.filter(a => a.relevanceLevel === 'low').length, color: 'annotation-low' },
      total
    };
  };

  const breakdown = getAnnotationBreakdown();

  if (annotations.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No Analytics Available</h3>
          <p className="text-muted-foreground">
            Start annotating the AI response to see improvement metrics and KPIs.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${metric.color}`} />
                  <span className="text-sm font-medium text-foreground">{metric.name}</span>
                </div>
                {metric.trend === 'up' && (
                  <Badge variant="secondary" className="text-xs bg-annotation-high/20 text-annotation-high">
                    Improved
                  </Badge>
                )}
              </div>
              
              <div className="mb-2">
                <span className="text-2xl font-bold text-foreground">
                  {metric.value}
                </span>
                <span className="text-sm text-muted-foreground ml-1">
                  {metric.unit}
                </span>
              </div>
              
              <p className="text-xs text-muted-foreground">
                {metric.description}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Annotation Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Annotation Breakdown</h3>
        
        <div className="space-y-4">
          {[
            { key: 'high', label: 'High Relevance', ...breakdown.high },
            { key: 'medium', label: 'Medium Relevance', ...breakdown.medium },
            { key: 'neutral', label: 'Neutral', ...breakdown.neutral },
            { key: 'low', label: 'Low Relevance', ...breakdown.low }
          ].map((item) => {
            const percentage = breakdown.total > 0 ? (item.count / breakdown.total) * 100 : 0;
            
            return (
              <div key={item.key} className="flex items-center gap-4">
                <div className="flex items-center gap-2 min-w-32">
                  <div className={`w-3 h-3 rounded bg-${item.color}`} />
                  <span className="text-sm text-foreground">{item.label}</span>
                </div>
                
                <div className="flex-1">
                  <Progress value={percentage} className="h-2" />
                </div>
                
                <div className="text-sm text-muted-foreground min-w-16 text-right">
                  {item.count} ({Math.round(percentage)}%)
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Key Insights</h3>
        
        <div className="space-y-3">
          {breakdown.high.count > breakdown.low.count && (
            <div className="flex items-start gap-3 p-3 bg-annotation-high/10 rounded-lg">
              <CheckCircle className="w-4 h-4 text-annotation-high mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">High-Value Content Identified</p>
                <p className="text-xs text-muted-foreground">
                  You've marked more content as highly relevant than low relevance, indicating good signal-to-noise ratio.
                </p>
              </div>
            </div>
          )}
          
          {breakdown.low.count > breakdown.total * 0.3 && (
            <div className="flex items-start gap-3 p-3 bg-annotation-low/10 rounded-lg">
              <TrendingDown className="w-4 h-4 text-annotation-low mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Significant Noise Detected</p>
                <p className="text-xs text-muted-foreground">
                  Over 30% of content marked as low relevance. Refined prompt should significantly improve output quality.
                </p>
              </div>
            </div>
          )}
          
          {breakdown.total < 5 && (
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Target className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">More Annotations Recommended</p>
                <p className="text-xs text-muted-foreground">
                  Consider annotating more text segments for better prompt refinement accuracy.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;