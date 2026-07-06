import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  X,
  ShieldCheck,
} from 'lucide-react';
import { correctionService, type Correction } from '@/services/capa.service';
import { compressImageIfNeeded, uploadUrl } from '@/lib/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

function StatusBadge({ c }: { c: Correction }) {
  if (c.status === 'Closed' || c.rectificationStatus === 'Approved') {
    return <Badge className="bg-green-600 hover:bg-green-600"><CheckCircle2 className="mr-1 h-3 w-3" />Approved</Badge>;
  }
  if (c.rectificationStatus === 'Submitted') {
    return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Waiting for review</Badge>;
  }
  if (c.rectificationStatus === 'Rejected') {
    return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Needs redo</Badge>;
  }
  return <Badge variant="outline">To fix</Badge>;
}

export function ClientCorrectionsPage() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetIdRef = useRef<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['myCorrections'],
    queryFn: async () => (await correctionService.getMyCorrections()).data,
  });

  const corrections = data || [];
  const openCount = corrections.filter(
    (c) => c.status !== 'Closed' && c.rectificationStatus !== 'Approved' && c.rectificationStatus !== 'Submitted'
  ).length;
  const waitingCount = corrections.filter((c) => c.rectificationStatus === 'Submitted').length;
  const doneCount = corrections.filter((c) => c.status === 'Closed' || c.rectificationStatus === 'Approved').length;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['myCorrections'] });

  const startUpload = (capaId: number) => {
    targetIdRef.current = capaId;
    fileInputRef.current?.click();
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const capaId = targetIdRef.current;
    e.target.value = ''; // allow re-selecting the same file
    if (!file || capaId == null) return;
    setBusyId(capaId);
    try {
      const compressed = await compressImageIfNeeded(file);
      await correctionService.uploadFixPhoto(capaId, compressed);
      await refresh();
      toast({ title: 'Photo added', description: 'Add more if needed, then tap Submit for review.' });
    } catch {
      // api interceptor already shows an error toast
    } finally {
      setBusyId(null);
    }
  };

  const deletePhoto = async (capaId: number, evidenceId: number) => {
    setBusyId(capaId);
    try {
      await correctionService.deleteFixPhoto(capaId, evidenceId);
      await refresh();
    } catch {
      /* handled by interceptor */
    } finally {
      setBusyId(null);
    }
  };

  const submit = async (c: Correction) => {
    if (c.fixPhotos.length === 0) {
      toast({ title: 'Add a photo first', description: 'Upload at least one photo of the fix before submitting.', variant: 'destructive' });
      return;
    }
    setSubmittingId(c.id);
    try {
      await correctionService.submit(c.id);
      await refresh();
      toast({ title: 'Submitted', description: 'Sent to the auditor for review.' });
    } catch {
      /* handled by interceptor */
    } finally {
      setSubmittingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Could not load your items. Please refresh the page.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Hidden camera/file input shared by all cards */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChosen}
      />

      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Items to Fix</h1>
        <p className="text-sm text-muted-foreground">
          {corrections.length > 0 ? corrections[0].packageName : 'Your package'} — upload a photo of each fix, then submit for review.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold">{openCount}</div><div className="text-xs text-muted-foreground">To fix</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-amber-600">{waitingCount}</div><div className="text-xs text-muted-foreground">In review</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-green-600">{doneCount}</div><div className="text-xs text-muted-foreground">Approved</div></CardContent></Card>
      </div>

      {corrections.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <ShieldCheck className="h-10 w-10 text-green-600" />
            <p className="font-medium text-foreground">Nothing to fix right now</p>
            <p className="text-sm">When an auditor raises non-compliance points, they'll appear here.</p>
          </CardContent>
        </Card>
      )}

      {corrections.map((c) => {
        const locked = c.rectificationStatus === 'Submitted' || c.rectificationStatus === 'Approved' || c.status === 'Closed';
        const isBusy = busyId === c.id;
        return (
          <Card key={c.id} className={c.rectificationStatus === 'Rejected' ? 'border-destructive/50' : undefined}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{c.capaNumber}</CardTitle>
                <StatusBadge c={c} />
              </div>
              <p className="text-xs text-muted-foreground">{c.auditNumber} · {c.auditPoint}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Finding</p>
                <p className="text-sm text-muted-foreground">{c.findingDescription}</p>
                {c.observation && <p className="mt-1 text-sm text-muted-foreground">{c.observation}</p>}
              </div>

              {c.rectificationStatus === 'Rejected' && c.reviewNote && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  <p className="font-medium text-destructive">Auditor asked to redo this:</p>
                  <p className="text-destructive/90">{c.reviewNote}</p>
                </div>
              )}

              {/* Before: auditor's problem photos */}
              {c.problemPhotos.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Problem photo(s) from auditor</p>
                  <div className="flex flex-wrap gap-2">
                    {c.problemPhotos.map((p) => (
                      <a key={p.id} href={uploadUrl(p.filePath, p.id)} target="_blank" rel="noreferrer">
                        <img src={uploadUrl(p.filePath, p.id)} alt="problem" className="h-20 w-20 rounded-md border object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* After: client's fix photos */}
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Your fix photo(s)</p>
                <div className="flex flex-wrap gap-2">
                  {c.fixPhotos.map((p) => (
                    <div key={p.id} className="relative">
                      <a href={uploadUrl(p.filePath, p.id)} target="_blank" rel="noreferrer">
                        <img src={uploadUrl(p.filePath, p.id)} alt="fix" className="h-20 w-20 rounded-md border object-cover" />
                      </a>
                      {!locked && (
                        <button
                          onClick={() => deletePhoto(c.id, p.id)}
                          disabled={isBusy}
                          className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white shadow disabled:opacity-50"
                          aria-label="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {c.fixPhotos.length === 0 && locked && (
                    <p className="text-sm text-muted-foreground">No fix photos.</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              {!locked && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => startUpload(c.id)} disabled={isBusy}>
                    {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                    Add fix photo
                  </Button>
                  <Button className="w-full sm:w-auto" onClick={() => submit(c)} disabled={submittingId === c.id || c.fixPhotos.length === 0}>
                    {submittingId === c.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit for review
                  </Button>
                </div>
              )}
              {c.rectificationStatus === 'Submitted' && (
                <p className="text-sm text-amber-600">Submitted — waiting for the auditor to review.</p>
              )}
              {(c.status === 'Closed' || c.rectificationStatus === 'Approved') && (
                <p className="text-sm text-green-600">Approved and closed. Thank you!</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
