import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format as formatDate } from 'date-fns';
import {
  ArrowLeft,
  Save,
  Send,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import maturityService, {
  type DimensionSummary,
  type MaturityResponseUpdate,
} from '@/services/maturity.service';
import type { MaturityResponse } from '@/types';

const SCORING_CRITERIA: Record<number, string> = {
  1: 'Initial - Ad hoc, reactive, minimal awareness',
  2: 'Developing - Basic processes exist but inconsistent',
  3: 'Defined - Documented processes, consistent application',
  4: 'Managed - Proactive, measured, continuously improving',
  5: 'Optimized - Best practice, integrated into culture',
};

export function MaturityAssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [expandedDimensions, setExpandedDimensions] = useState<Record<string, boolean>>({});
  const [responses, setResponses] = useState<Record<number, MaturityResponse>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  // Fetch assessment details
  const { data: assessmentData, isLoading } = useQuery({
    queryKey: ['maturity-assessment', id],
    queryFn: () => maturityService.getById(parseInt(id!)),
    enabled: !!id,
  });

  // Fetch dimension summary
  const { data: summaryData } = useQuery({
    queryKey: ['maturity-summary', id],
    queryFn: () => maturityService.getDimensionSummary(parseInt(id!)),
    enabled: !!id,
  });

  // Fetch maturity model (kept for potential future use)
  useQuery({
    queryKey: ['maturity-model'],
    queryFn: () => maturityService.getModel(),
  });

  // Initialize responses
  useEffect(() => {
    if (assessmentData?.data?.responses) {
      const responseMap: Record<number, MaturityResponse> = {};
      assessmentData.data.responses.forEach((r) => {
        responseMap[r.id] = r;
      });
      setResponses(responseMap);
    }
  }, [assessmentData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (updates: MaturityResponseUpdate[]) =>
      maturityService.updateResponses(parseInt(id!), updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maturity-assessment', id] });
      queryClient.invalidateQueries({ queryKey: ['maturity-summary', id] });
      setHasChanges(false);
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: () => maturityService.submit(parseInt(id!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maturity-assessment', id] });
      queryClient.invalidateQueries({ queryKey: ['maturity-assessments'] });
      setShowSubmitDialog(false);
    },
  });

  const handleResponseChange = (
    responseId: number,
    field: keyof MaturityResponse,
    value: any
  ) => {
    setResponses((prev) => ({
      ...prev,
      [responseId]: {
        ...prev[responseId],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const updates: MaturityResponseUpdate[] = Object.entries(responses).map(([id, r]) => ({
      id: parseInt(id),
      score: r.score ?? undefined,
      evidence: r.evidence ?? undefined,
      gapIdentified: r.gapIdentified ?? undefined,
      recommendations: r.recommendations ?? undefined,
    }));
    saveMutation.mutate(updates);
  };

  const toggleDimension = (dimension: string) => {
    setExpandedDimensions((prev) => ({
      ...prev,
      [dimension]: !prev[dimension],
    }));
  };

  const getScoreColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'text-muted-foreground';
    if (score >= 4) return 'text-green-600';
    if (score >= 3) return 'text-yellow-600';
    if (score >= 2) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'Not Assessed';
    if (score >= 4.5) return 'Optimized';
    if (score >= 3.5) return 'Managed';
    if (score >= 2.5) return 'Defined';
    if (score >= 1.5) return 'Developing';
    return 'Initial';
  };

  // Group responses by dimension
  const responsesByDimension: Record<string, MaturityResponse[]> = {};
  Object.values(responses).forEach((r) => {
    if (!responsesByDimension[r.dimension]) {
      responsesByDimension[r.dimension] = [];
    }
    responsesByDimension[r.dimension].push(r);
  });

  // Calculate progress
  const totalQuestions = Object.values(responses).length;
  const answeredQuestions = Object.values(responses).filter((r) => r.score !== null && r.score !== undefined).length;
  const progressPercent = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

  // Prepare radar chart data
  const radarData = summaryData?.data?.map((d: DimensionSummary) => ({
    dimension: d.dimension.split(' ')[0],
    fullName: d.dimension,
    score: d.avgScore ? parseFloat(d.avgScore) : 0,
    fullMark: 5,
  })) || [];

  const assessment = assessmentData?.data;
  const isEditable = assessment?.status === 'Draft' || assessment?.status === 'In Progress';

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Loading assessment...</div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Assessment not found</p>
        <Button onClick={() => navigate('/maturity')}>Back to Assessments</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/maturity')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {assessment.packageCode} - Maturity Assessment
            </h1>
            <p className="text-muted-foreground">
              {assessment.packageName} | {formatDate(new Date(assessment.assessmentDate), 'dd MMM yyyy')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditable && (
            <>
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={!hasChanges || saveMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button
                onClick={() => setShowSubmitDialog(true)}
                disabled={progressPercent < 100}
              >
                <Send className="mr-2 h-4 w-4" />
                Submit
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                assessment.status === 'Completed'
                  ? 'default'
                  : assessment.status === 'Draft'
                    ? 'outline'
                    : 'secondary'
              }
            >
              {assessment.status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(assessment.overallScore)}`}>
              {assessment.overallScore != null ? `${assessment.overallScore.toFixed(1)}/5` : '-'}
            </div>
            <p className="text-xs text-muted-foreground">{getScoreLabel(assessment.overallScore ?? null)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{answeredQuestions}/{totalQuestions}</div>
            <Progress value={progressPercent} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assessor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">{assessment.assessorName || '-'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Radar Chart */}
      {radarData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Maturity Profile</CardTitle>
            <CardDescription>Score across all dimensions (1-5 scale)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.5}
                  />
                  <Tooltip
                    content={({ payload }) => {
                      if (payload && payload.length > 0) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="font-medium">{data.fullName}</div>
                            <div className="text-sm">Score: {data.score.toFixed(1)}/5</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scoring Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Scoring Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-5">
            {Object.entries(SCORING_CRITERIA).map(([score, desc]) => (
              <div key={score} className="rounded-lg border p-3">
                <div className={`font-bold text-lg ${getScoreColor(parseInt(score))}`}>
                  Level {score}
                </div>
                <div className="text-sm text-muted-foreground">{desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dimensions */}
      <div className="space-y-4">
        {Object.entries(responsesByDimension).map(([dimension, dimResponses]) => {
          const isExpanded = expandedDimensions[dimension];
          const dimSummary = summaryData?.data?.find((s: DimensionSummary) => s.dimension === dimension);
          const answered = dimResponses.filter((r) => r.score !== null && r.score !== undefined).length;

          return (
            <Card key={dimension}>
              <CardHeader
                className="cursor-pointer"
                onClick={() => toggleDimension(dimension)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CardTitle>{dimension}</CardTitle>
                    <Badge variant="outline">
                      {answered}/{dimResponses.length} answered
                    </Badge>
                    {dimSummary?.avgScore && (
                      <span className={`font-bold ${getScoreColor(parseFloat(dimSummary.avgScore))}`}>
                        Avg: {dimSummary.avgScore}
                      </span>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent>
                  <div className="space-y-6">
                    {dimResponses.map((response, index) => (
                      <div key={response.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-medium">
                              Q{index + 1}. {response.question}
                            </div>
                          </div>
                          <div className="w-32">
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Select
                                      value={response.score?.toString() || ''}
                                      onValueChange={(v) =>
                                        handleResponseChange(response.id, 'score', parseInt(v))
                                      }
                                      disabled={!isEditable}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Score" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {[1, 2, 3, 4, 5].map((s) => (
                                          <SelectItem key={s} value={s.toString()}>
                                            {s} - {['Initial', 'Developing', 'Defined', 'Managed', 'Optimized'][s - 1]}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Select maturity level (1-5)</p>
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Evidence/Observations</Label>
                            <Textarea
                              placeholder="Document evidence observed..."
                              value={response.evidence || ''}
                              onChange={(e) =>
                                handleResponseChange(response.id, 'evidence', e.target.value)
                              }
                              disabled={!isEditable}
                              rows={3}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Gaps Identified</Label>
                            <Textarea
                              placeholder="Note any gaps or weaknesses..."
                              value={response.gapIdentified || ''}
                              onChange={(e) =>
                                handleResponseChange(response.id, 'gapIdentified', e.target.value)
                              }
                              disabled={!isEditable}
                              rows={3}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Recommendations</Label>
                            <Textarea
                              placeholder="Suggest improvements..."
                              value={response.recommendations || ''}
                              onChange={(e) =>
                                handleResponseChange(response.id, 'recommendations', e.target.value)
                              }
                              disabled={!isEditable}
                              rows={3}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Assessment</DialogTitle>
            <DialogDescription>
              Once submitted, the assessment cannot be edited. Are you sure you want to submit?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>All {totalQuestions} questions have been answered</span>
            </div>
            <div className="mt-2">
              <span className="font-medium">Overall Score: </span>
              <span className={getScoreColor(assessment.overallScore)}>
                {assessment.overallScore?.toFixed(1) || '-'}/5
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Assessment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MaturityAssessmentPage;
