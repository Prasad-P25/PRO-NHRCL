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
  Search,
  AlertTriangle,
  Filter,
  CheckCircle2,
  Printer,
  Menu,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { exportAuditReportPDF } from '@/lib/export';
import { auditService } from '@/services/audit.service';
import { AuditComments } from '@/components/audit/AuditComments';
import { AuditAttachments } from '@/components/audit/AuditAttachments';
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

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'nc' | 'incomplete'>('all');

  // CAPA summary dialog state
  const [showCapaSummary, setShowCapaSummary] = useState(false);
  const [capaCount, setCapaCount] = useState(0);

  // Auto-save state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveEnabled] = useState(true); // Can be made configurable later
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

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
      // Count CAPA items
      const capaItems = Object.values(responses).filter(r => r.capaRequired).length;
      const ncItems = Object.values(responses).filter(r => r.status === 'NC').length;
      setCapaCount(ncItems > 0 ? ncItems : capaItems);
      setShowCapaSummary(true);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to submit audit. Please try again.';
      alert(message);
    },
  });

  // Refs to hold current values for auto-save (avoids stale closure)
  const responsesRef = useRef(responses);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  const isSavingRef = useRef(isSaving);

  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  // Auto-save effect - saves every 30 seconds if there are unsaved changes
  useEffect(() => {
    if (!autoSaveEnabled || !auditData || auditData.status === 'Approved' || auditData.status === 'Pending Review') {
      return;
    }

    const autoSaveInterval = setInterval(() => {
      console.log('Auto-save check:', { hasUnsaved: hasUnsavedChangesRef.current, isSaving: isSavingRef.current });

      if (hasUnsavedChangesRef.current && !isSavingRef.current) {
        const currentResponses = responsesRef.current;
        const responsesToSave: AuditResponseForm[] = Object.values(currentResponses)
          .filter((r) => r.status !== null)
          .map((r) => ({
            auditItemId: r.auditItemId,
            status: r.status!,
            observation: r.observation || undefined,
            riskRating: r.riskRating || undefined,
            capaRequired: r.capaRequired,
            remarks: r.remarks || undefined,
          }));

        if (responsesToSave.length > 0) {
          console.log('Auto-saving', responsesToSave.length, 'responses...');
          setIsSaving(true);
          saveMutation.mutateAsync(responsesToSave)
            .then(() => {
              setHasUnsavedChanges(false);
              console.log('Auto-save complete');
            })
            .catch((err) => {
              console.error('Auto-save failed:', err);
            })
            .finally(() => {
              setIsSaving(false);
            });
        }
      }
    }, 15000); // 15 seconds (for testing, can increase to 30000 for production)

    return () => {
      clearInterval(autoSaveInterval);
    };
  }, [autoSaveEnabled, auditData?.status, saveMutation]);

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
    setHasUnsavedChanges(true);
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
      setHasUnsavedChanges(false);
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

  const handleExportPDF = () => {
    if (!auditData || !categories) return;

    // Calculate summary
    const allResponses = Object.values(responses);
    const summary = {
      totalItems: totalItems,
      compliant: allResponses.filter((r) => r.status === 'C').length,
      nonCompliant: allResponses.filter((r) => r.status === 'NC').length,
      notApplicable: allResponses.filter((r) => r.status === 'NA').length,
      notVerified: allResponses.filter((r) => r.status === 'NV').length,
    };

    // Build categories data for PDF
    const pdfCategories = categories.map((cat) => ({
      name: `${cat.code}. ${cat.name}`,
      sections: cat.sections.map((sec) => ({
        name: `${sec.code}. ${sec.name}`,
        items: (sec.items || []).map((item) => {
          const resp = getResponse(item.id);
          return {
            srNo: item.srNo,
            auditPoint: item.auditPoint,
            status: resp.status || '-',
            observation: resp.observation,
            riskRating: resp.riskRating || undefined,
            capaRequired: resp.capaRequired,
          };
        }),
      })),
    }));

    exportAuditReportPDF({
      auditNumber: auditData.auditNumber,
      packageCode: auditData.package?.code || '',
      packageName: auditData.package?.name || '',
      auditType: auditData.auditType || 'Full',
      scheduledDate: auditData.scheduledDate ? new Date(auditData.scheduledDate).toLocaleDateString() : '-',
      status: auditData.status || 'Draft',
      auditorName: auditData.auditor?.name || '-',
      contractorRep: auditData.contractorRep || undefined,
      compliancePercentage: auditData.compliancePercentage || Math.round((summary.compliant / (summary.totalItems - summary.notApplicable || 1)) * 100),
      categories: pdfCategories,
      summary,
    });
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

  // Camera capture functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCameraStream(stream);
      setIsCameraOpen(true);
      // Wait for video element to be available
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (error) {
      console.error('Camera access failed:', error);
      alert('Unable to access camera. Please check permissions or use file upload instead.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !selectedItem) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);

    // Add timestamp overlay
    const timestamp = new Date().toLocaleString();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.fillText(`Captured: ${timestamp}`, 10, canvas.height - 10);

    // Convert to blob and upload
    canvas.toBlob(async (blob) => {
      if (blob && selectedItem) {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        await handleFileUpload(file, selectedItem.id);
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
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
          // Mobile: larger touch targets (min 44x44px), Desktop: compact
          'flex items-center justify-center gap-1 rounded-md border transition-colors font-medium',
          'h-10 w-10 sm:h-8 sm:min-w-[44px] sm:w-auto sm:px-2', // Size
          'text-sm sm:text-xs', // Font size
          'active:scale-95', // Touch feedback
          isActive ? activeClass : 'hover:bg-muted text-muted-foreground'
        )}
        title={label}
      >
        <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
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
          {/* Mobile: icon only, Desktop: icon + text */}
          <Button variant="outline" size="icon" className="sm:hidden" onClick={handleExportPDF} title="Print PDF">
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="hidden sm:flex" onClick={handleExportPDF}>
            <Printer className="mr-2 h-4 w-4" />
            Print PDF
          </Button>
          <Button variant="outline" size="icon" className="sm:hidden" onClick={handleExportWord} disabled={isExporting} title="Export Word">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          </Button>
          <Button variant="outline" className="hidden sm:flex" onClick={handleExportWord} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Export Word
          </Button>
          {(auditData.status === 'Draft' || auditData.status === 'In Progress') && (
            <>
              <Button variant="outline" size="icon" className="sm:hidden" onClick={handleSave} disabled={isSaving || saveMutation.isPending} title="Save">
                {isSaving || saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
              <Button variant="outline" className="hidden sm:flex" onClick={handleSave} disabled={isSaving || saveMutation.isPending}>
                {isSaving || saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
              <Button size="icon" className="sm:hidden" onClick={handleSubmit} disabled={submitMutation.isPending} title="Submit">
                {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              <Button className="hidden sm:flex" onClick={handleSubmit} disabled={submitMutation.isPending}>
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
            <div className="flex items-center gap-3 text-xs">
              {isSaving && (
                <span className="flex items-center gap-1 text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </span>
              )}
              {!isSaving && hasUnsavedChanges && (
                <span className="text-amber-600">Unsaved changes</span>
              )}
              {lastSaved && !isSaving && (
                <span className="text-muted-foreground">
                  {hasUnsavedChanges ? 'Last saved' : 'Saved'} at {lastSaved.toLocaleTimeString()}
                </span>
              )}
              {autoSaveEnabled && !isSaving && (
                <span className="text-muted-foreground/60">(auto-save on)</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Category Toggle */}
      <div className="lg:hidden">
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => setShowMobileSidebar(!showMobileSidebar)}
        >
          <span className="flex items-center gap-2">
            <Menu className="h-4 w-4" />
            Categories ({categories.length})
          </span>
          {showMobileSidebar ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {/* Audit Content */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* Category Navigation - Hidden on mobile unless toggled */}
        <Card className={cn(
          'lg:col-span-1',
          showMobileSidebar ? 'block' : 'hidden lg:block'
        )}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Categories
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden h-6 w-6 p-0"
                onClick={() => setShowMobileSidebar(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0 space-y-3">
            {/* Search box */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex gap-1">
              <Button
                variant={filterMode === 'all' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => setFilterMode('all')}
              >
                All
              </Button>
              <Button
                variant={filterMode === 'nc' ? 'destructive' : 'outline'}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => setFilterMode('nc')}
              >
                <X className="h-3 w-3 mr-1" />
                NC
              </Button>
              <Button
                variant={filterMode === 'incomplete' ? 'secondary' : 'outline'}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => setFilterMode('incomplete')}
              >
                <Filter className="h-3 w-3 mr-1" />
                Open
              </Button>
            </div>

            <nav className="space-y-1 pb-4">
              {categories.map((category) => {
                // Count NC items in this category
                const ncCount = category.sections?.reduce((acc, sec) => {
                  return acc + (sec.items?.filter((item: AuditItem) => responses[item.id]?.status === 'NC').length || 0);
                }, 0) || 0;

                return (
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
                    <span className="truncate flex items-center gap-1">
                      {category.code}. {category.name}
                      {ncCount > 0 && (
                        <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-destructive text-[10px] text-white px-1">
                          {ncCount}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {category.completedCount}/{category.itemCount}
                    </span>
                  </button>
                );
              })}
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
                            {(section.items || [])
                              .filter((item) => {
                                // Apply search filter
                                if (searchTerm) {
                                  const search = searchTerm.toLowerCase();
                                  const matchesSearch =
                                    item.auditPoint?.toLowerCase().includes(search) ||
                                    item.standardReference?.toLowerCase().includes(search) ||
                                    String(item.srNo).includes(search);
                                  if (!matchesSearch) return false;
                                }
                                // Apply status filter
                                const response = getResponse(item.id);
                                if (filterMode === 'nc' && response.status !== 'NC') return false;
                                if (filterMode === 'incomplete' && response.status !== null) return false;
                                return true;
                              })
                              .map((item) => {
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

      {/* Comments and Attachments Section */}
      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <AuditComments
          auditId={auditId}
          readOnly={auditData.status === 'Approved'}
        />
        <AuditAttachments
          auditId={auditId}
          readOnly={auditData.status === 'Approved'}
        />
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
                    variant="default"
                    size="sm"
                    disabled={isUploading}
                    onClick={startCamera}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Capture Photo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileImage className="mr-2 h-4 w-4" />
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
                    Upload Doc
                  </Button>
                </div>

                {/* Camera Preview */}
                {isCameraOpen && (
                  <div className="mt-3 rounded-lg border bg-black p-2">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full rounded"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex justify-center gap-2 mt-2">
                      <Button onClick={capturePhoto} disabled={isUploading}>
                        {isUploading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="mr-2 h-4 w-4" />
                        )}
                        Take Photo
                      </Button>
                      <Button variant="outline" onClick={stopCamera}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

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

      {/* CAPA Summary Dialog */}
      <Dialog open={showCapaSummary} onOpenChange={setShowCapaSummary}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-compliant" />
              Audit Submitted Successfully
            </DialogTitle>
            <DialogDescription>
              Your audit has been submitted for review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {capaCount > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">CAPA Items Created</p>
                    <p className="text-sm text-amber-700 mt-1">
                      <span className="font-bold text-lg">{capaCount}</span> non-compliant items have been flagged for corrective action.
                    </p>
                    <p className="text-xs text-amber-600 mt-2">
                      Track progress in the CAPA module.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">No CAPA Items</p>
                    <p className="text-sm text-green-700 mt-1">
                      All audit items are compliant or not applicable.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              <p>Completed: {completedCount} / {totalItems} items</p>
              <p>Compliance rate will be calculated after review.</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {capaCount > 0 && (
              <Button variant="outline" onClick={() => navigate('/capa')}>
                View CAPA List
              </Button>
            )}
            <Button onClick={() => navigate('/audits')}>
              Back to Audits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
