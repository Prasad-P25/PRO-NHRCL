import { useState, useEffect, useRef, type DragEvent } from 'react';
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
  Ban,
  RotateCcw,
  Pencil,
  Plus,
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
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/hooks/use-toast';
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
  removedCount: number;
  effectiveItemCount: number;
  sections: {
    id: number;
    code: string;
    name: string;
    items?: AuditItem[];
  }[];
}

// Downscale + recompress large photos in the browser before upload — faster
// uploads and far less mobile data on site. Non-images (or already-small files)
// pass through unchanged; any failure falls back to the original file.
async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 300 * 1024) return file;
  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.7)
    );
    if (!blob || blob.size >= file.size) return file; // no gain — keep original
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
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
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingNC, setIsExportingNC] = useState(false);

  // Add/edit custom checkpoint dialog state
  const [customDialog, setCustomDialog] = useState<{
    open: boolean;
    sectionId: number | null;
    editingId: number | null;
    auditPoint: string;
    standardReference: string;
    priority: 'P1' | 'P2' | 'P3';
    evidenceRequired: string;
  }>({ open: false, sectionId: null, editingId: null, auditPoint: '', standardReference: '', priority: 'P2', evidenceRequired: '' });
  const [isSavingCustom, setIsSavingCustom] = useState(false);

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
  // Which item's inline quick-camera is currently uploading (for the per-row spinner).
  const [capturingItemId, setCapturingItemId] = useState<number | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  // Native-camera capture input (capture="environment"). Opens the phone's own
  // camera app and returns a real full-resolution JPEG — far more reliable
  // across devices than a custom getUserMedia + canvas capture, which produced
  // black frames on some phones.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Inline per-row quick camera (next to the status buttons). captureTargetRef holds
  // the item id being photographed so the shared hidden input's onChange knows where
  // to attach the evidence.
  const inlineCameraInputRef = useRef<HTMLInputElement>(null);
  const captureTargetRef = useRef<number | null>(null);

  // Approve/Reject state
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  // Guard against an accidental one-tap submit (locks the audit for editing).
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Evidence preview state
  const [previewEvidence, setPreviewEvidence] = useState<Evidence | null>(null);
  const user = useAuthStore((state) => state.user);
  // Check role name - handle both nested role object and direct roleName property
  const roleName = user?.role?.name || (user as any)?.roleName;
  const canApprove = roleName === 'Super Admin' || roleName === 'PMC Head';

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

  // Expand first selected category by default
  useEffect(() => {
    if (auditData?.categories && auditData.categories.length > 0 && expandedCategories.length === 0) {
      setExpandedCategories([auditData.categories[0].id]);
    }
  }, [auditData?.categories]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (responsesToSave: AuditResponseForm[]) => {
      return auditService.saveAuditResponses(auditId, responsesToSave);
    },
    onSuccess: () => {
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ['auditResponses', auditId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Save failed',
        description: error?.response?.data?.message || 'Your responses could not be saved. Check your connection and try again.',
        variant: 'destructive',
      });
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      return auditService.submitAudit(auditId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      // Refresh this audit's detail so the page reflects the new "Pending Review" status
      queryClient.invalidateQueries({ queryKey: ['audit', auditId] });
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

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      return auditService.approveAudit(auditId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit', auditId] });
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      alert('Audit approved successfully!');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to approve audit. Please try again.';
      alert(message);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      return auditService.rejectAudit(auditId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit', auditId] });
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      setShowRejectDialog(false);
      setRejectReason('');
      alert('Audit rejected and sent back to auditor.');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to reject audit. Please try again.';
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
          setIsSaving(true);
          saveMutation.mutateAsync(responsesToSave)
            .then(() => {
              setHasUnsavedChanges(false);
            })
            .catch((err) => {
              console.error('Auto-save failed:', err);
            })
            .finally(() => {
              setIsSaving(false);
            });
        }
      }
    }, 30000); // 30 seconds

    return () => {
      clearInterval(autoSaveInterval);
    };
    // NOTE: `saveMutation` is intentionally excluded. It gets a new object
    // identity every render, so including it tore down and recreated this
    // interval on every keystroke/click — meaning the 30s auto-save never
    // actually fired while the auditor was working. mutateAsync is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveEnabled, auditData?.status]);

  // Warn before leaving (tab close / reload) with unsaved audit responses
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Refs so the window-level paste listener always uses the latest handler/item.
  // (These hooks MUST stay above the early `if (isLoading) return` below.)
  const handleFileUploadRef = useRef<((file: File, itemId: number) => void | Promise<void>) | null>(null);
  const selectedItemRef = useRef<AuditItem | null>(selectedItem);
  selectedItemRef.current = selectedItem;

  // Paste a screenshot (Ctrl/Cmd+V) anywhere while the item detail dialog is open
  useEffect(() => {
    if (!isDetailDialogOpen || !selectedItem) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          const current = selectedItemRef.current;
          if (file && current) {
            const named = new File([file], file.name || `screenshot-${Date.now()}.png`, { type: file.type });
            handleFileUploadRef.current?.(named, current.id);
          }
          e.preventDefault();
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isDetailDialogOpen, selectedItem]);

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

  // Auditor-added ad-hoc checkpoints for THIS audit, grouped by section.
  const customItems: AuditItem[] = ((auditData as any).customItems || []) as AuditItem[];
  const customBySection = new Map<number, AuditItem[]>();
  customItems.forEach((ci) => {
    const arr = customBySection.get(ci.sectionId) || [];
    arr.push({ ...ci, isCustom: true });
    customBySection.set(ci.sectionId, arr);
  });

  // Build categories with their sections and items - filter to only selected categories
  const categories: CategoryWithSections[] = (allCategories || [])
    .filter((cat) => auditData.categories?.some((ac: { id: number }) => ac.id === cat.id))
    .map((cat) => {
      // Merge custom items into their section so they render and count.
      const sections = (cat.sections || []).map((sec: any) => {
        const extra = customBySection.get(sec.id) || [];
        return extra.length ? { ...sec, items: [...(sec.items || []), ...extra] } : sec;
      });

      // Removed (RM) items are excluded from the audit: they don't count as
      // "completed" and they shrink the effective denominator. itemCount is
      // derived from actual items (master + custom).
      let itemCount = 0;
      let completedCount = 0;
      let removedCount = 0;
      sections.forEach((sec: { items?: AuditItem[] }) => {
        sec.items?.forEach((item: AuditItem) => {
          itemCount++;
          const s = responses[item.id]?.status;
          if (s === 'RM') removedCount++;
          else if (s != null) completedCount++;
        });
      });

      return {
        id: cat.id,
        code: cat.code,
        name: cat.name,
        itemCount,
        completedCount,
        removedCount,
        effectiveItemCount: Math.max(0, itemCount - removedCount),
        sections,
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

  // ---- Add / edit / delete custom (ad-hoc) checkpoints ----
  const openAddCustom = (sectionId: number) => {
    setCustomDialog({ open: true, sectionId, editingId: null, auditPoint: '', standardReference: '', priority: 'P2', evidenceRequired: '' });
  };
  const openEditCustom = (item: AuditItem) => {
    setCustomDialog({
      open: true, sectionId: item.sectionId, editingId: item.id,
      auditPoint: item.auditPoint, standardReference: item.standardReference || '',
      priority: (item.priority as 'P1' | 'P2' | 'P3') || 'P2', evidenceRequired: item.evidenceRequired || '',
    });
  };
  const saveCustomItem = async () => {
    if (!customDialog.auditPoint.trim() || !auditId) return;
    setIsSavingCustom(true);
    try {
      if (customDialog.editingId) {
        await auditService.updateCustomItem(auditId, customDialog.editingId, {
          auditPoint: customDialog.auditPoint.trim(),
          standardReference: customDialog.standardReference || undefined,
          evidenceRequired: customDialog.evidenceRequired || undefined,
          priority: customDialog.priority,
        });
      } else if (customDialog.sectionId) {
        await auditService.addCustomItem(auditId, {
          sectionId: customDialog.sectionId,
          auditPoint: customDialog.auditPoint.trim(),
          standardReference: customDialog.standardReference || undefined,
          evidenceRequired: customDialog.evidenceRequired || undefined,
          priority: customDialog.priority,
        });
      }
      setCustomDialog((d) => ({ ...d, open: false }));
      await queryClient.invalidateQueries({ queryKey: ['audit', auditId] });
      refetchAudit();
    } catch (e) {
      alert('Failed to save checkpoint. Please try again.');
    } finally {
      setIsSavingCustom(false);
    }
  };
  const handleDeleteCustom = async (item: AuditItem) => {
    if (!auditId) return;
    if (!confirm(`Delete added checkpoint "${item.auditPoint}"?\nThis also removes any response recorded on it.`)) return;
    try {
      await auditService.deleteCustomItem(auditId, item.id);
      await queryClient.invalidateQueries({ queryKey: ['audit', auditId] });
      refetchAudit();
    } catch (e) {
      alert('Failed to delete checkpoint. Please try again.');
    }
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

  // The item detail dialog's "Save Response" button must actually persist to
  // the server before closing. Previously it only closed the dialog, so the
  // auditor's status/observation/risk lived in local state and was silently
  // lost on navigation unless a photo upload or the top-bar Save happened to
  // flush it. Keep the dialog open if the save fails so input isn't lost.
  const handleSaveResponseAndClose = async () => {
    try {
      await handleSave();
      setIsDetailDialogOpen(false);
    } catch {
      // saveMutation's onError already shows a toast; leave the dialog open.
    }
  };

  const handleSubmit = async () => {
    // Save first; only submit if the save succeeded. Surface save failures
    // instead of letting the rejection escape unhandled (which silently
    // skipped the submit).
    try {
      await handleSave();
    } catch (err: any) {
      toast({
        title: 'Save failed',
        description: err?.response?.data?.message || 'Could not save responses before submitting. Please try again.',
        variant: 'destructive',
      });
      return;
    }
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

  const handleExportNCReport = async () => {
    setIsExportingNC(true);
    try {
      await auditService.exportNCReport(auditId);
    } catch (error) {
      console.error('NC Report export failed:', error);
      alert('Failed to export NC report. Please try again.');
    } finally {
      setIsExportingNC(false);
    }
  };

  const handleExportPDF = () => {
    if (!auditData || !categories) return;

    // Calculate summary. Removed (RM) items are excluded from the report.
    const allResponses = Object.values(responses);
    const summary = {
      totalItems: effectiveTotal,
      compliant: allResponses.filter((r) => r.status === 'C').length,
      nonCompliant: allResponses.filter((r) => r.status === 'NC').length,
      notApplicable: allResponses.filter((r) => r.status === 'NA').length,
      notVerified: allResponses.filter((r) => r.status === 'NV').length,
    };

    // Build categories data for PDF (removed items are dropped entirely)
    const pdfCategories = categories.map((cat) => ({
      name: `${cat.code}. ${cat.name}`,
      sections: cat.sections.map((sec) => ({
        name: `${sec.code}. ${sec.name}`,
        items: (sec.items || []).filter((item) => getResponse(item.id).status !== 'RM').map((item) => {
          const resp = getResponse(item.id);
          return {
            srNo: item.srNo,
            auditPoint: item.isCustom ? `${item.auditPoint} [Added]` : item.auditPoint,
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
    // Shrink large photos in-browser before upload (faster + less mobile data).
    file = await compressImageIfNeeded(file);

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

  // Keep the paste listener's ref pointing at the latest upload handler.
  // (Plain assignment, not a hook — safe to run after the early return above.)
  handleFileUploadRef.current = handleFileUpload;

  // Quick inline capture: open the camera for THIS item and attach the photo without
  // opening the Details dialog. Evidence is tied to a saved response, so a status is
  // required first. On desktop the OS file picker opens instead of a live camera.
  const startInlineCapture = (item: AuditItem) => {
    if (!getResponse(item.id).status) {
      toast({
        title: 'Select a status first',
        description: 'Mark this point C / NC / NA / NV, then capture the photo.',
      });
      return;
    }
    captureTargetRef.current = item.id;
    inlineCameraInputRef.current?.click();
  };

  // Build a URL for an evidence file. The ?e= param cache-busts stale Cloudflare
  // edge responses that carried the old same-origin CORP header (which blocked
  // the cross-subdomain image from loading in the browser).
  const evidenceUrl = (filePath?: string, id?: number | string) => {
    if (!filePath) return '';
    const base = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || '';
    return `${base}/${filePath.replace(/\\/g, '/')}${id != null ? `?e=${id}` : ''}`;
  };

  // Drag-and-drop image/file onto the evidence dropzone
  const handleEvidenceDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!selectedItem) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file, selectedItem.id);
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

  // Calculate progress. Removed (RM) items are excluded from both the
  // numerator (completed) and the denominator (effective total).
  const totalItems = categories.reduce((acc, cat) => acc + cat.itemCount, 0);
  const removedCount = Object.values(responses).filter((r) => r.status === 'RM').length;
  const effectiveTotal = Math.max(0, totalItems - removedCount);
  const completedCount = Object.values(responses).filter((r) => r.status !== null && r.status !== 'RM').length;
  const progress = effectiveTotal > 0 ? (completedCount / effectiveTotal) * 100 : 0;
  // Auditors can add/edit/remove ad-hoc checkpoints only while the audit is open.
  const canEditItems = auditData.status !== 'Approved' && auditData.status !== 'Pending Review';

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
          // Comfortable tap targets on phones; show the letter label on every size.
          'flex items-center justify-center gap-1 rounded-md border transition-colors font-medium',
          'h-10 w-full min-w-[44px] px-2.5 sm:h-8 sm:w-auto sm:px-2', // Phones: fill the grid cell
          'text-sm sm:text-xs', // Font size
          'active:scale-95', // Touch feedback
          isActive ? activeClass : 'hover:bg-muted text-muted-foreground'
        )}
        title={label}
      >
        <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        <span>{shortLabel}</span>
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
      <span className="flex items-center gap-1">
        <Ban className="h-3 w-3 text-gray-500" /> RM = Removed (excluded from reports)
      </span>
    </div>
  );

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      {/* Shared hidden input for the inline per-row quick camera. capture="environment"
          opens the rear camera on phones; on desktop it falls back to a file picker. */}
      <input
        type="file"
        ref={inlineCameraInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          const itemId = captureTargetRef.current;
          e.target.value = '';
          captureTargetRef.current = null;
          if (!file || itemId == null) return;
          setCapturingItemId(itemId);
          try {
            await handleFileUpload(file, itemId);
          } finally {
            setCapturingItemId(null);
          }
        }}
      />
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="default" size="icon" className="sm:hidden bg-orange-600 hover:bg-orange-700" onClick={handleExportNCReport} disabled={isExportingNC} title="NC Report">
            {isExportingNC ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
          </Button>
          <Button variant="default" className="hidden sm:flex bg-orange-600 hover:bg-orange-700" onClick={handleExportNCReport} disabled={isExportingNC}>
            {isExportingNC ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="mr-2 h-4 w-4" />
            )}
            NC Report
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
              <Button size="icon" className="sm:hidden" onClick={() => setShowSubmitConfirm(true)} disabled={submitMutation.isPending} title="Submit">
                {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              <Button className="hidden sm:flex" onClick={() => setShowSubmitConfirm(true)} disabled={submitMutation.isPending}>
                {submitMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Submit for Review
              </Button>
            </>
          )}
          {/* Approve/Reject buttons for reviewers */}
          {auditData.status === 'Pending Review' && canApprove && (
            <>
              <Button
                variant="default"
                size="icon"
                className="sm:hidden bg-green-600 hover:bg-green-700"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                title="Approve"
              >
                {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
              </Button>
              <Button
                variant="default"
                className="hidden sm:flex bg-green-600 hover:bg-green-700"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsUp className="mr-2 h-4 w-4" />
                )}
                Approve
              </Button>
              <Button
                variant="destructive"
                size="icon"
                className="sm:hidden"
                onClick={() => setShowRejectDialog(true)}
                disabled={rejectMutation.isPending}
                title="Reject"
              >
                {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
              </Button>
              <Button
                variant="destructive"
                className="hidden sm:flex"
                onClick={() => setShowRejectDialog(true)}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsDown className="mr-2 h-4 w-4" />
                )}
                Reject
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
              Progress: {completedCount}/{effectiveTotal}{removedCount > 0 ? ` (${removedCount} removed)` : ''}
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
                      {category.completedCount}/{category.effectiveItemCount}
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
                                  className={cn(
                                    // Phones: stack (point text on top, buttons below).
                                    // sm+ : original side-by-side layout, unchanged.
                                    'flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 border-b last:border-b-0 px-4 py-3',
                                    response.status === 'RM' && 'opacity-60'
                                  )}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-2">
                                      <span className="font-medium text-sm w-6">
                                        {item.srNo}.
                                      </span>
                                      <div className="flex-1">
                                        <p className={cn('text-sm', response.status === 'RM' && 'line-through text-muted-foreground')}>
                                          {item.auditPoint}
                                          {item.isCustom && (
                                            <span className="ml-2 align-middle rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium not-italic no-underline text-blue-400">
                                              Added
                                            </span>
                                          )}
                                          {response.status === 'RM' && (
                                            <span className="ml-2 align-middle rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium not-italic no-underline text-muted-foreground">
                                              Removed — excluded from reports
                                            </span>
                                          )}
                                        </p>
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

                                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0 border-t pt-3 sm:border-t-0 sm:pt-0">
                                    {response.status === 'RM' ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full sm:w-auto"
                                        onClick={() => handleStatusChange(item.id, 'NV')}
                                        title="Restore this checkpoint into the audit"
                                      >
                                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                                      </Button>
                                    ) : (
                                      <div className="grid grid-cols-3 gap-1.5 w-full sm:flex sm:w-auto sm:gap-1">
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
                                        <StatusButton
                                          itemId={item.id}
                                          status="RM"
                                          label="Remove from this audit (excluded from reports)"
                                          shortLabel="RM"
                                          icon={Ban}
                                          activeClass="bg-muted text-foreground border-muted-foreground"
                                        />
                                        {/* Quick camera: photograph this point inline (no Details dialog) */}
                                        <button
                                          type="button"
                                          onClick={() => startInlineCapture(item)}
                                          disabled={capturingItemId === item.id}
                                          className={cn(
                                            'flex items-center justify-center gap-1 rounded-md border font-medium transition-colors',
                                            'h-10 w-full min-w-[44px] px-2.5 sm:h-8 sm:w-auto sm:px-2',
                                            'text-sm sm:text-xs active:scale-95',
                                            'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-60'
                                          )}
                                          title="Capture photo for this point"
                                        >
                                          {capturingItemId === item.id ? (
                                            <Loader2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 animate-spin" />
                                          ) : (
                                            <Camera className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                          )}
                                          <span>Photo{response.evidenceCount > 0 ? ` (${response.evidenceCount})` : ''}</span>
                                        </button>
                                      </div>
                                    )}

                                    {item.isCustom && canEditItems && (
                                      <>
                                        <Button
                                          variant="ghost" size="icon"
                                          title="Edit added checkpoint"
                                          onClick={() => openEditCustom(item)}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost" size="icon"
                                          title="Delete added checkpoint"
                                          onClick={() => handleDeleteCustom(item)}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="ml-auto sm:ml-0"
                                      onClick={() => openDetailDialog(item)}
                                    >
                                      Details
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                            {canEditItems && (
                              <div className="px-4 py-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAddCustom(section.id)}
                                >
                                  <Plus className="h-4 w-4 mr-1" /> Add point
                                </Button>
                              </div>
                            )}
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

      {/* Add / Edit custom checkpoint dialog */}
      <Dialog open={customDialog.open} onOpenChange={(o) => setCustomDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{customDialog.editingId ? 'Edit added checkpoint' : 'Add checkpoint'}</DialogTitle>
            <DialogDescription>
              This point applies to <strong>this audit only</strong> and is marked “Added”. It does not change the standard checklist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Audit Point <span className="text-destructive">*</span></label>
              <Textarea
                value={customDialog.auditPoint}
                onChange={(e) => setCustomDialog((d) => ({ ...d, auditPoint: e.target.value }))}
                placeholder="Describe the checkpoint to audit…"
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Standard / Reference</label>
              <Input
                value={customDialog.standardReference}
                onChange={(e) => setCustomDialog((d) => ({ ...d, standardReference: e.target.value }))}
                placeholder="e.g. IS 3764 / Site SOP (optional)"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select
                  value={customDialog.priority}
                  onValueChange={(v) => setCustomDialog((d) => ({ ...d, priority: v as 'P1' | 'P2' | 'P3' }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P1">P1</SelectItem>
                    <SelectItem value="P2">P2</SelectItem>
                    <SelectItem value="P3">P3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Evidence Required</label>
                <Input
                  value={customDialog.evidenceRequired}
                  onChange={(e) => setCustomDialog((d) => ({ ...d, evidenceRequired: e.target.value }))}
                  placeholder="optional"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCustomDialog((d) => ({ ...d, open: false }))} disabled={isSavingCustom}>
              Cancel
            </Button>
            <Button onClick={saveCustomItem} disabled={isSavingCustom || !customDialog.auditPoint.trim()}>
              {isSavingCustom ? 'Saving…' : customDialog.editingId ? 'Save changes' : 'Add point'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit confirmation — guards against an accidental one-tap submit */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit this audit for review?</DialogTitle>
            <DialogDescription>
              {auditData.auditNumber} will move to <strong>Pending Review</strong> and you won’t be
              able to edit responses until a reviewer approves it or sends it back.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Marked so far</span>
              <span className="font-medium">{completedCount} / {effectiveTotal}</span>
            </div>
            {effectiveTotal - completedCount > 0 && (
              <p className="mt-2 text-amber-600">
                {effectiveTotal - completedCount} item(s) are still not marked. You can still submit,
                but check them first if that isn’t intended.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSubmitConfirm(false)} disabled={submitMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => { setShowSubmitConfirm(false); handleSubmit(); }} disabled={submitMutation.isPending}>
              <Send className="mr-2 h-4 w-4" /> Yes, submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <div className="mt-2 flex flex-wrap gap-2">
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
                  {/* Native camera: capture="environment" opens the rear camera
                      directly on phones and returns a real JPEG. */}
                  <input
                    type="file"
                    ref={cameraInputRef}
                    className="hidden"
                    accept="image/*"
                    capture="environment"
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
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="mr-2 h-4 w-4" />
                    )}
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

                {/* Drag & drop / paste-screenshot zone */}
                <div
                  onDrop={handleEvidenceDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onPaste={(e) => {
                    const f = Array.from(e.clipboardData.items)
                      .find((i) => i.type.startsWith('image/'))
                      ?.getAsFile();
                    if (f && selectedItem) {
                      handleFileUpload(f, selectedItem.id);
                      e.preventDefault();
                    }
                  }}
                  tabIndex={0}
                  className={`mt-3 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center text-sm outline-none transition-colors ${
                    isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/50'
                  } ${isUploading ? 'opacity-60' : ''}`}
                >
                  {isUploading ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                    </span>
                  ) : (
                    <>
                      <FileImage className="h-5 w-5 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Drag &amp; drop an image here, or paste a screenshot (Ctrl+V)
                      </span>
                    </>
                  )}
                </div>

                {/* Display uploaded evidence as thumbnails */}
                {getResponse(selectedItem.id).evidence.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Uploaded files ({getResponse(selectedItem.id).evidence.length}):
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {getResponse(selectedItem.id).evidence.map((ev) => {
                        const isImage = ev.fileType?.startsWith('image/');
                        const url = evidenceUrl(ev.filePath, ev.id);
                        return (
                          <div
                            key={ev.id}
                            className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                          >
                            <button
                              type="button"
                              className="h-full w-full"
                              onClick={() => setPreviewEvidence(ev)}
                              title={ev.fileName}
                            >
                              {isImage ? (
                                <img
                                  src={url}
                                  alt={ev.fileName}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center">
                                  <FileText className="h-6 w-6 text-orange-500" />
                                  <span className="w-full truncate text-[10px] text-muted-foreground">
                                    {ev.fileName}
                                  </span>
                                </div>
                              )}
                            </button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="absolute right-1 top-1 h-6 w-6 p-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                              onClick={() => handleDeleteEvidence(selectedItem.id, ev.id)}
                              title="Delete evidence"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
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
            <Button onClick={handleSaveResponseAndClose} disabled={isSaving || saveMutation.isPending}>
              {isSaving || saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Response'
              )}
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
              <p>Completed: {completedCount} / {effectiveTotal} items{removedCount > 0 ? ` (${removedCount} removed)` : ''}</p>
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

      {/* Reject Audit Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ThumbsDown className="h-5 w-5" />
              Reject Audit
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this audit. The auditor will be notified and can make corrections.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate(rejectReason)}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ThumbsDown className="mr-2 h-4 w-4" />
              )}
              Reject Audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evidence Preview Dialog */}
      <Dialog open={!!previewEvidence} onOpenChange={(open) => !open && setPreviewEvidence(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewEvidence?.fileType.startsWith('image/') ? (
                <FileImage className="h-5 w-5 text-blue-500" />
              ) : (
                <FileText className="h-5 w-5 text-orange-500" />
              )}
              {previewEvidence?.fileName}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-center overflow-auto max-h-[70vh]">
            {previewEvidence?.fileType.startsWith('image/') ? (
              <img
                src={evidenceUrl(previewEvidence.filePath, previewEvidence.id)}
                alt={previewEvidence.fileName}
                className="max-w-full max-h-[65vh] object-contain rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement!.innerHTML = '<div class="text-center p-8 text-muted-foreground">Failed to load image</div>';
                }}
              />
            ) : (
              <div className="text-center p-8">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Preview not available for this file type</p>
                <a
                  href={evidenceUrl(previewEvidence?.filePath, previewEvidence?.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline mt-2 inline-block"
                >
                  Download File
                </a>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewEvidence(null)}>
              Close
            </Button>
            <a
              href={evidenceUrl(previewEvidence?.filePath, previewEvidence?.id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button>
                <FileDown className="mr-2 h-4 w-4" />
                Download
              </Button>
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile sticky action bar — keeps the key actions reachable without
          scrolling back to the top. Phones only (sm:hidden). */}
      {(auditData.status === 'Draft' || auditData.status === 'In Progress') && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-background/95 p-3 backdrop-blur sm:hidden">
          <Button variant="outline" className="flex-1" onClick={handleSave} disabled={isSaving || saveMutation.isPending}>
            {isSaving || saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button className="flex-1" onClick={() => setShowSubmitConfirm(true)} disabled={submitMutation.isPending}>
            <Send className="mr-2 h-4 w-4" />
            Submit
          </Button>
        </div>
      )}
      {auditData.status === 'Pending Review' && canApprove && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-background/95 p-3 backdrop-blur sm:hidden">
          <Button variant="destructive" className="flex-1" onClick={() => setShowRejectDialog(true)} disabled={rejectMutation.isPending}>
            <ThumbsDown className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
            <ThumbsUp className="mr-2 h-4 w-4" />
            Approve
          </Button>
        </div>
      )}
    </div>
  );
}
