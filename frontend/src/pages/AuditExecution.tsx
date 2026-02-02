import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  Send,
  ChevronDown,
  ChevronRight,
  Camera,
  Paperclip,
  Check,
  X,
  Minus,
  HelpCircle,
  Loader2,
  RefreshCw,
  Trash2,
  FileImage,
  FileText,
  FileDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';
import { auditService } from '@/services/audit.service';
import type { ResponseStatus, RiskRating, AuditItem, AuditResponseForm } from '@/types';

interface Evidence {
  id: number;
  fileName: string;
  fileType: string;
  filePath: string;
}

interface LocalResponse {
  auditItemId: number;
  responseId?: number;
  status: ResponseStatus | null;
  observation: string;
  riskRating: RiskRating | null;
  capaRequired: boolean;
  remarks: string;
  evidenceCount: number;
  evidence: Evidence[];
}

interface CategoryWithSections {
  id: number;
  code: string;
  name: string;
  itemCount: number;
  completedCount: number;
  sections: {
    id: number;
    code: string;
    name: string;
    items?: AuditItem[];
  }[];
}

export function AuditExecutionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auditId = parseInt(id || '0');

  const [expandedCategories, setExpandedCategories] = useState<number[]>([]);
  const [expandedSections, setExpandedSections] = useState<number[]>([]);
  const [responses, setResponses] = useState<Record<number, LocalResponse>>({});
  const [selectedItem, setSelectedItem] = useState<AuditItem | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Fetch audit details
  const { data: auditData, isLoading: auditLoading, isError: auditError, refetch: refetchAudit } = useQuery({
    queryKey: ['audit', auditId],
    queryFn: async () => {
      const response = await auditService.getAudit(auditId);
      return response.data;
    },
    enabled: auditId > 0,
  });

  // Fetch existing responses
  const { data: existingResponses, isLoading: responsesLoading } = useQuery({
    queryKey: ['auditResponses', auditId],
    queryFn: async () => {
      const response = await auditService.getAuditResponses(auditId);
      return response.data;
    },
    enabled: auditId > 0,
  });

  // Fetch all categories with sections for audit execution
  const { data: allCategories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories-with-sections'],
    queryFn: async () => {
      const response = await auditService.getCategories(true);
      return response.data;
    },
  });

  // Initialize responses from existing data
  useEffect(() => {
    if (existingResponses && existingResponses.length > 0) {
      const initialResponses: Record<number, LocalResponse> = {};
      existingResponses.forEach((resp: any) => {
        initialResponses[resp.auditItemId] = {
          auditItemId: resp.auditItemId,
          responseId: resp.id,
          status: resp.status as ResponseStatus,
          observation: resp.observation || '',
          riskRating: resp.riskRating as RiskRating || null,
          capaRequired: resp.capaRequired || false,
          remarks: resp.remarks || '',
          evidenceCount: resp.evidence?.length || 0,
          evidence: resp.evidence || [],
        };
      });
      setResponses(initialResponses);
    }
  }, [existingResponses]);

  // Expand first category by default
  useEffect(() => {
    if (allCategories && allCategories.length > 0 && expandedCategories.length === 0) {
      setExpandedCategories([allCategories[0].id]);
    }
  }, [allCategories]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (responsesToSave: AuditResponseForm[]) => {
      return auditService.saveAuditResponses(auditId, responsesToSave);
    },
    onSuccess: () => {
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ['auditResponses', auditId] });
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      return auditService.submitAudit(auditId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      navigate('/audits');
    },
  });

  const isLoading = auditLoading || responsesLoading || categoriesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading audit...</p>
        </div>
      </div>
    );
  }

  if (auditError || !auditData) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load audit</CardTitle>
            <CardDescription>
              Unable to load audit details from the server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={() => refetchAudit()} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button onClick={() => navigate('/audits')} variant="ghost" className="w-full">
              Back to Audits
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build categories with their sections and items
  const categories: CategoryWithSections[] = (allCategories || [])
    .filter((cat) => auditData.categories?.some((ac: { id: number }) => ac.id === cat.id) || true) // Show all for now
    .map((cat) => {
      const completedCount = cat.sections?.reduce((acc: number, sec: { items?: AuditItem[] }) => {
        return acc + (sec.items?.filter((item: AuditItem) => responses[item.id]?.status !== null).length || 0);
      }, 0) || 0;

      return {
        id: cat.id,
        code: cat.code,
        name: cat.name,
        itemCount: cat.itemCount || 0,
        completedCount,
        sections: cat.sections || [],
      };
    });

  const getResponse = (itemId: number): LocalResponse => {
    return responses[itemId] || {
      auditItemId: itemId,
      status: null,
      observation: '',
      riskRating: null,
      capaRequired: false,
      remarks: '',
      evidenceCount: 0,
      evidence: [],
    };
  };

  const updateResponse = (itemId: number, updates: Partial<LocalResponse>) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: {
        ...getResponse(itemId),
        ...updates,
      },
    }));
  };

  const toggleCategory = (categoryId: number) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleStatusChange = (itemId: number, status: ResponseStatus) => {
    updateResponse(itemId, {
      status,
      riskRating: status === 'NC' ? 'Major' : null,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const responsesToSave: AuditResponseForm[] = Object.values(responses)
      .filter((r) => r.status !== null)
      .map((r) => ({
        auditItemId: r.auditItemId,
        status: r.status!,
        observation: r.observation || undefined,
        riskRating: r.riskRating || undefined,
        capaRequired: r.capaRequired,
        remarks: r.remarks || undefined,
      }));

    try {
      await saveMutation.mutateAsync(responsesToSave);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    // Save first, then submit
    await handleSave();
    submitMutation.mutate();
  };

  const handleExportWord = async () => {
    setIsExporting(true);
    try {
      await auditService.exportToWord(auditId);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export audit. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const openDetailDialog = (item: AuditItem) => {
    setSelectedItem(item);
    setIsDetailDialogOpen(true);
  };

  // Handle file upload
  const handleFileUpload = async (file: File, itemId: number) => {
    if (!file) return;

    const response = getResponse(itemId);

    // If no responseId exists, we need to save the response first
    if (!response.responseId) {
      // Need to save this response first to get a responseId
      if (!response.status) {
        alert('Please select a status before uploading evidence');
        return;
      }

      setIsUploading(true);
      try {
        // Save this single response first
        await auditService.saveAuditResponses(auditId, [{
          auditItemId: itemId,
          status: response.status,
          observation: response.observation || undefined,
          riskRating: response.riskRating || undefined,
          capaRequired: response.capaRequired,
          remarks: response.remarks || undefined,
        }]);

        // Refetch to get the responseId
        const responsesResult = await auditService.getAuditResponses(auditId);
        const savedResponse = responsesResult.data?.find((r: any) => r.auditItemId === itemId);

        if (!savedResponse?.id) {
          throw new Error('Failed to get response ID after saving');
        }

        // Now upload the file
        const uploadResult = await auditService.uploadEvidence(savedResponse.id, file);

        // Update local state with the new evidence
        updateResponse(itemId, {
          responseId: savedResponse.id,
          evidenceCount: response.evidenceCount + 1,
          evidence: [
            ...response.evidence,
            {
              id: uploadResult.data.fileId,
              fileName: file.name,
              fileType: file.type,
              filePath: uploadResult.data.filePath,
            },
          ],
        });

        setLastSaved(new Date());
      } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload file. Please try again.');
      } finally {
        setIsUploading(false);
      }
    } else {
      // responseId exists, can upload directly
      setIsUploading(true);
      try {
        const uploadResult = await auditService.uploadEvidence(response.responseId, file);

        updateResponse(itemId, {
          evidenceCount: response.evidenceCount + 1,
          evidence: [
            ...response.evidence,
            {
              id: uploadResult.data.fileId,
              fileName: file.name,
              fileType: file.type,
              filePath: uploadResult.data.filePath,
            },
          ],
        });
      } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload file. Please try again.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Handle evidence deletion
  const handleDeleteEvidence = async (itemId: number, evidenceId: number) => {
    const response = getResponse(itemId);
    if (!response.responseId) return;

    try {
      await auditService.deleteEvidence(response.responseId, evidenceId);

      updateResponse(itemId, {
        evidenceCount: Math.max(0, response.evidenceCount - 1),
        evidence: response.evidence.filter((e) => e.id !== evidenceId),
      });
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete evidence. Please try again.');
    }
  };

  // Calculate progress
  const totalItems = categories.reduce((acc, cat) => acc + cat.itemCount, 0);
  const completedCount = Object.values(responses).filter((r) => r.status !== null).length;
  const progress = totalItems > 0 ? (completedCount / totalItems) * 100 : 0;

  const StatusButton = ({
    itemId,
    status,
    label,
    shortLabel,
    icon: Icon,
    activeClass,
  }: {
    itemId: number;
    status: ResponseStatus;
    label: string;
    shortLabel: string;
    icon: React.ElementType;
    activeClass: string;
  }) => {
    const currentStatus = getResponse(itemId).status;
    const isActive = currentStatus === status;
    return (
      <button
        onClick={() => handleStatusChange(itemId, status)}
        className={cn(
          'flex h-8 min-w-[44px] items-center justify-center gap-1 rounded-md border px-2 transition-colors text-xs font-medium',
          isActive ? activeClass : 'hover:bg-muted text-muted-foreground'
        )}
        title={label}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{shortLabel}</span>
      </button>
    );
  };

  // Legend for auditors
  const StatusLegend = () => (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Quick Guide:</span>
      <span className="flex items-center gap-1">
        <Check className="h-3 w-3 text-green-600" /> C = Compliant
      </span>
      <span className="flex items-center gap-1">
        <X className="h-3 w-3 text-red-600" /> NC = Non-Compliant
      </span>
      <span className="flex items-center gap-1">
        <Minus className="h-3 w-3 text-gray-600" /> NA = Not Applicable
      </span>
      <span className="flex items-center gap-1">
        <HelpCircle className="h-3 w-3 text-yellow-600" /> NV = Not Verified
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/audits')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{auditData.auditNumber}</h1>
            <p className="text-sm text-muted-foreground">
              Package: {auditData.package?.code} - {auditData.package?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {auditData.status && (
            <Badge variant={
              auditData.status === 'Approved' ? 'compliant' :
              auditData.status === 'Pending Review' ? 'pending' :
              auditData.status === 'In Progress' ? 'inProgress' :
              'secondary'
            }>
              {auditData.status}
            </Badge>
          )}
          <Button variant="outline" onClick={handleExportWord} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Export Word
          </Button>
          {(auditData.status === 'Draft' || auditData.status === 'In Progress') && (
            <>
              <Button variant="outline" onClick={handleSave} disabled={isSaving || saveMutation.isPending}>
                {isSaving || saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
              <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
                {submitMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Submit for Review
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Progress: {completedCount}/{totalItems}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <StatusLegend />
            {lastSaved && (
              <p className="text-xs text-muted-foreground">
                Last saved at {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit Content */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* Category Navigation */}
        <Card className="lg:col-span-1">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Categories</CardTitle>
          </CardHeader>
          <CardContent className="py-0">
            <nav className="space-y-1 pb-4">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => toggleCategory(category.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                    expandedCategories.includes(category.id)
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  )}
                >
                  <span className="truncate">
                    {category.code}. {category.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {category.completedCount}/{category.itemCount}
                  </span>
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {categories
            .filter((cat) => expandedCategories.includes(cat.id))
            .map((category) => (
              <Card key={category.id}>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">
                    {category.code}. {category.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-0 pb-4 space-y-4">
                  {category.sections.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No items in this category yet. Run database seed to populate audit items.
                    </p>
                  ) : (
                    category.sections.map((section) => (
                      <div key={section.id} className="border rounded-lg">
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
                        >
                          <span className="font-medium">
                            {section.code}. {section.name}
                          </span>
                          {expandedSections.includes(section.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>

                        {expandedSections.includes(section.id) && (
                          <div className="border-t">
                            {(section.items || []).map((item) => {
                              const response = getResponse(item.id);
                              return (
                                <div
                                  key={item.id}
                                  className="flex items-start gap-4 border-b last:border-b-0 px-4 py-3"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-2">
                                      <span className="font-medium text-sm w-6">
                                        {item.srNo}.
                                      </span>
                                      <div className="flex-1">
                                        <p className="text-sm">{item.auditPoint}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Ref: {item.standardReference}
                                        </p>
                                        {response.status === 'NC' && response.observation && (
                                          <div className="mt-2 rounded-md bg-non-compliant/10 p-2 text-xs">
                                            {response.observation}
                                          </div>
                                        )}
                                      </div>
                                      <Badge
                                        variant={item.priority === 'P1' ? 'destructive' : 'secondary'}
                                        className="shrink-0"
                                      >
                                        {item.priority}
                                      </Badge>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="flex gap-1">
                                      <StatusButton
                                        itemId={item.id}
                                        status="C"
                                        label="Compliant"
                                        shortLabel="C"
                                        icon={Check}
                                        activeClass="bg-compliant text-white border-compliant"
                                      />
                                      <StatusButton
                                        itemId={item.id}
                                        status="NC"
                                        label="Non-Compliant"
                                        shortLabel="NC"
                                        icon={X}
                                        activeClass="bg-non-compliant text-white border-non-compliant"
                                      />
                                      <StatusButton
                                        itemId={item.id}
                                        status="NA"
                                        label="Not Applicable"
                                        shortLabel="NA"
                                        icon={Minus}
                                        activeClass="bg-not-applicable text-white border-not-applicable"
                                      />
                                      <StatusButton
                                        itemId={item.id}
                                        status="NV"
                                        label="Not Verified"
                                        shortLabel="NV"
                                        icon={HelpCircle}
                                        activeClass="bg-not-verified text-white border-not-verified"
                                      />
                                    </div>

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openDetailDialog(item)}
                                    >
                                      Details
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Item #{selectedItem?.srNo}: {selectedItem?.auditPoint}
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.standardReference}
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={getResponse(selectedItem.id).status || ''}
                    onValueChange={(value) =>
                      handleStatusChange(selectedItem.id, value as ResponseStatus)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="C">Compliant</SelectItem>
                      <SelectItem value="NC">Non-Compliant</SelectItem>
                      <SelectItem value="NA">Not Applicable</SelectItem>
                      <SelectItem value="NV">Not Verified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {getResponse(selectedItem.id).status === 'NC' && (
                  <div>
                    <label className="text-sm font-medium">Risk Rating</label>
                    <Select
                      value={getResponse(selectedItem.id).riskRating || ''}
                      onValueChange={(value) =>
                        updateResponse(selectedItem.id, { riskRating: value as RiskRating })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select risk" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Critical">Critical</SelectItem>
                        <SelectItem value="Major">Major</SelectItem>
                        <SelectItem value="Minor">Minor</SelectItem>
                        <SelectItem value="Observation">Observation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {getResponse(selectedItem.id).status === 'NC' && (
                <>
                  <div>
                    <label className="text-sm font-medium">Observation *</label>
                    <Textarea
                      placeholder="Describe the non-compliance..."
                      value={getResponse(selectedItem.id).observation}
                      onChange={(e) =>
                        updateResponse(selectedItem.id, { observation: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="capaRequired"
                      checked={getResponse(selectedItem.id).capaRequired}
                      onCheckedChange={(checked) =>
                        updateResponse(selectedItem.id, { capaRequired: checked as boolean })
                      }
                    />
                    <label htmlFor="capaRequired" className="text-sm font-medium">
                      CAPA Required
                    </label>
                  </div>
                </>
              )}

              <div>
                <label className="text-sm font-medium">Remarks</label>
                <Textarea
                  placeholder="Additional notes..."
                  value={getResponse(selectedItem.id).remarks}
                  onChange={(e) =>
                    updateResponse(selectedItem.id, { remarks: e.target.value })
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Evidence</label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="file"
                    ref={photoInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && selectedItem) {
                        handleFileUpload(file, selectedItem.id);
                      }
                      e.target.value = '';
                    }}
                  />
                  <input
                    type="file"
                    ref={documentInputRef}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && selectedItem) {
                        handleFileUpload(file, selectedItem.id);
                      }
                      e.target.value = '';
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="mr-2 h-4 w-4" />
                    )}
                    Upload Photo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => documentInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="mr-2 h-4 w-4" />
                    )}
                    Upload Document
                  </Button>
                </div>

                {/* Display uploaded evidence */}
                {getResponse(selectedItem.id).evidence.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Uploaded files ({getResponse(selectedItem.id).evidence.length}):
                    </p>
                    <div className="space-y-1">
                      {getResponse(selectedItem.id).evidence.map((ev) => (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2 truncate">
                            {ev.fileType.startsWith('image/') ? (
                              <FileImage className="h-4 w-4 text-blue-500" />
                            ) : (
                              <FileText className="h-4 w-4 text-orange-500" />
                            )}
                            <span className="truncate">{ev.fileName}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteEvidence(selectedItem.id, ev.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsDetailDialogOpen(false)}>
              Save Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
