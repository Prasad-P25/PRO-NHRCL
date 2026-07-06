import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, XCircle, Inbox } from 'lucide-react';
import { correctionService, type Correction } from '@/services/capa.service';
import { uploadUrl } from '@/lib/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { ProjectGuard } from '@/components/ProjectGuard';

function PhotoRow({ label, photos }: { label: string; photos: Correction['fixPhotos'] }) {
  if (!photos.length) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <a key={p.id} href={uploadUrl(p.filePath, p.id)} target="_blank" rel="noreferrer">
            <img src={uploadUrl(p.filePath, p.id)} alt={label} className="h-24 w-24 rounded-md border object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}

export function RectificationReviewPage() {
  const queryClient = useQueryClient();
  const [actingId, setActingId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Correction | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: async () => (await correctionService.getReviewQueue()).data,
    refetchInterval: 60000,
  });

  const items = data || [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });

  const approve = async (c: Correction) => {
    setActingId(c.id);
    try {
      await correctionService.review(c.id, 'approve');
      await refresh();
      toast({ title: 'Approved', description: `${c.capaNumber} is now closed.` });
    } catch {
      /* interceptor handles */
    } finally {
      setActingId(null);
    }
  };

  const doReject = async () => {
    if (!rejectTarget) return;
    if (!rejectNote.trim()) {
      toast({ title: 'Reason required', description: 'Tell the client what to redo.', variant: 'destructive' });
      return;
    }
    setActingId(rejectTarget.id);
    try {
      await correctionService.review(rejectTarget.id, 'reject', rejectNote.trim());
      await refresh();
      toast({ title: 'Sent back', description: `${rejectTarget.capaNumber} returned to the client.` });
      setRejectTarget(null);
      setRejectNote('');
    } catch {
      /* interceptor handles */
    } finally {
      setActingId(null);
    }
  };

  return (
    <ProjectGuard>
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Client Corrections — Review</h1>
          <p className="text-sm text-muted-foreground">
            Fixes submitted by clients. Approve to close the item, or reject to send it back with a reason.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Inbox className="h-10 w-10" />
              <p className="font-medium text-foreground">Nothing to review</p>
              <p className="text-sm">When a client submits a fix, it will show up here.</p>
            </CardContent>
          </Card>
        ) : (
          items.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{c.capaNumber}</CardTitle>
                  <Badge variant="secondary">{c.packageCode} · {c.auditNumber}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{c.auditPoint}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Finding</p>
                  <p className="text-sm text-muted-foreground">{c.findingDescription}</p>
                </div>
                <PhotoRow label="Problem (auditor)" photos={c.problemPhotos} />
                <PhotoRow label="Fix (client)" photos={c.fixPhotos} />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="w-full bg-green-600 hover:bg-green-700 sm:w-auto" onClick={() => approve(c)} disabled={actingId === c.id}>
                    {actingId === c.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Approve & close
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setRejectTarget(c); setRejectNote(''); }} disabled={actingId === c.id}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) setRejectTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject {rejectTarget?.capaNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="reject-note">Reason (the client will see this)</Label>
              <Textarea
                id="reject-note"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="e.g. The photo doesn't show the guardrail fixed — please re-upload a clear photo."
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={doReject} disabled={actingId === rejectTarget?.id}>
                {actingId === rejectTarget?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send back to client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProjectGuard>
  );
}
