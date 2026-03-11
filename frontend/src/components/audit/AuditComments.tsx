import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';

interface Comment {
  id: number;
  auditId: number;
  userId: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
  comment: string;
  commentType: string;
  isInternal: boolean;
  createdAt: string;
}

interface AuditCommentsProps {
  auditId: number;
  readOnly?: boolean;
}

export function AuditComments({ auditId, readOnly = false }: AuditCommentsProps) {
  const [newComment, setNewComment] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: comments, isLoading } = useQuery({
    queryKey: ['audit-comments', auditId],
    queryFn: async () => {
      const response = await api.get(`/audits/${auditId}/comments`);
      return response.data.data as Comment[];
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      const response = await api.post(`/audits/${auditId}/comments`, { comment });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-comments', auditId] });
      setNewComment('');
      toast({
        title: 'Comment added',
        description: 'Your comment has been posted.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add comment.',
        variant: 'destructive',
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await api.delete(`/audits/${auditId}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-comments', auditId] });
      toast({
        title: 'Comment deleted',
        description: 'The comment has been removed.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete comment.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
    }
  };

  const canDeleteComment = (comment: Comment) => {
    return comment.userId === user?.id || user?.role?.name === 'Super Admin';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Comments ({comments?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add comment form */}
        {!readOnly && (
          <form onSubmit={handleSubmit} className="space-y-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={!newComment.trim() || addCommentMutation.isPending}
              >
                {addCommentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Post Comment
              </Button>
            </div>
          </form>
        )}

        {/* Comments list */}
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading comments...</div>
        ) : comments?.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">No comments yet</div>
        ) : (
          <div className="space-y-3">
            {comments?.map((comment) => (
              <div
                key={comment.id}
                className="p-3 rounded-lg bg-muted/50 border"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{comment.user.name}</span>
                      {comment.isInternal && (
                        <Badge variant="secondary" className="text-xs">Internal</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(comment.createdAt), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                  </div>
                  {canDeleteComment(comment) && !readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                      disabled={deleteCommentMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AuditComments;
