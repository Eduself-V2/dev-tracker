import { useState, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useTrackerGetRequirement,
  getTrackerGetRequirementQueryKey,
  useTrackerTransitionRequirement,
  useTrackerAddComment,
  useTrackerListUsers,
  getTrackerListRequirementsQueryKey,
  getTrackerStatsSummaryQueryKey,
  getTrackerListUsersQueryKey,
  useTrackerListPins,
  useTrackerPinTask,
  useTrackerUnpinTask,
  getTrackerListPinsQueryKey,
  useTrackerPinComment,
  useTrackerUnpinComment,
} from "@workspace/api-client-react";
import type { TransitionRequirementToStatus } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor, isEditorContentEmpty } from "@/components/ui/rich-text-editor";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { plainTextToHtml } from "@/lib/rich-text";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FileUploadZone from "@/components/FileUploadZone";
import VoiceRecorder from "@/components/VoiceRecorder";
import {
  ArrowLeft,
  Clock,
  MessageSquare,
  ArrowRight,
  Play,
  User,
  Activity,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  FolderKanban,
  Calendar,
  Pencil,
  Trash2,
  CornerDownRight,
  X,
  Check,
  Paperclip,
  FileText,
  FileSpreadsheet,
  Image,
  Download,
  Loader2,
  Bell,
  Mail,
  Mic,
  Volume2,
  UserPlus,
  ChevronsUpDown,
  Pin,
  Timer,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format, formatDistanceToNow, isSameDay } from "date-fns";

function renderWithLinks(text: string) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        className="text-primary underline break-all hover:opacity-80">
        {part}
      </a>
    ) : part
  );
}

type Transition = {
  status: TransitionRequirementToStatus;
  label: string;
  icon: any;
  variant: "default" | "destructive" | "secondary";
};

type Attachment = {
  id: number;
  requirementId: number;
  commentId: number | null;
  s3Url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: number;
  uploaderName: string;
  createdAt: string;
};

function attachmentIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image className="w-4 h-4 text-blue-500 shrink-0" />;
  if (mimeType === "application/pdf") return <FileText className="w-4 h-4 text-red-500 shrink-0" />;
  if (mimeType.startsWith("audio/")) return <Mic className="w-4 h-4 text-violet-500 shrink-0" />;
  return <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentList({ attachments, reqId, onDeleted }: { attachments: Attachment[]; reqId: number; onDeleted: (id: number) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const handleDelete = async (att: Attachment) => {
    if (!confirm(`Delete "${att.originalName}"?`)) return;
    try {
      const res = await fetch(`/api/tracker/requirements/${reqId}/attachments/${att.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      onDeleted(att.id);
      toast({ title: "Attachment deleted" });
    } catch {
      toast({ title: "Failed to delete attachment", variant: "destructive" });
    }
  };

  if (attachments.length === 0) return null;

  return (
    <ul className="space-y-1.5">
      {attachments.map((att) => (
        <li key={att.id} className="rounded-md bg-muted/40 border border-border/40 text-sm overflow-hidden">
          {att.mimeType.startsWith("audio/") ? (
            <div className="px-2.5 py-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-violet-500 shrink-0" />
                <span className="flex-1 truncate min-w-0 text-muted-foreground">{att.originalName}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{formatBytes(att.sizeBytes)}</span>
                <a href={att.s3Url} download={att.originalName} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" title="Download">
                    <Download className="w-3 h-3" />
                  </Button>
                </a>
                {(user?.role === "admin" || user?.id === att.uploadedBy) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 hover:bg-destructive/10"
                    title="Delete"
                    onClick={() => handleDelete(att)}
                  >
                    <Trash2 className="w-3 h-3 text-destructive/70" />
                  </Button>
                )}
              </div>
              <audio controls src={att.s3Url} className="w-full h-9" />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              {att.mimeType.startsWith("image/") ? (
                <a href={att.s3Url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 flex-1 min-w-0 group">
                  <img src={att.s3Url} alt={att.originalName} className="w-8 h-8 object-cover rounded border" />
                  <span className="truncate group-hover:text-primary transition-colors">{att.originalName}</span>
                </a>
              ) : (
                <a href={att.s3Url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 flex-1 min-w-0 group">
                  {attachmentIcon(att.mimeType)}
                  <span className="truncate group-hover:text-primary transition-colors">{att.originalName}</span>
                </a>
              )}
              <span className="text-[11px] text-muted-foreground shrink-0">{formatBytes(att.sizeBytes)}</span>
              <a href={att.s3Url} download={att.originalName} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" title="Download">
                  <Download className="w-3 h-3" />
                </Button>
              </a>
              {(user?.role === "admin" || user?.id === att.uploadedBy) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 hover:bg-destructive/10"
                  title="Delete"
                  onClick={() => handleDelete(att)}
                >
                  <Trash2 className="w-3 h-3 text-destructive/70" />
                </Button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function TimelineView({ events, expanded, onToggle }: { events: any[]; expanded: boolean; onToggle: () => void }) {
  const visibleEvents = expanded ? events : events.slice(0, 5);
  const hasMore = events.length > 5;

  const groups: { date: Date; label: string; items: any[] }[] = [];
  for (const e of visibleEvents) {
    const d = new Date(e.createdAt);
    const last = groups[groups.length - 1];
    if (last && isSameDay(last.date, d)) {
      last.items.push(e);
    } else {
      groups.push({ date: d, label: format(d, "MMM d, yyyy"), items: [e] });
    }
  }

  const kindLabel: Record<string, string> = {
    created: "created this",
    transitioned: "changed status",
    assigned: "assigned",
    comment: "commented",
    notified: "sent mail",
    reply: "replied",
  };

  const kindIcon: Record<string, any> = {
    created: PlusCircle,
    transitioned: ArrowRight,
    assigned: User,
    comment: MessageSquare,
    notified: Mail,
    reply: CornerDownRight,
  };

  return (
    <div className="space-y-5">
      {groups.map((group, gi) => (
        <div key={gi} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{group.label}</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="space-y-3">
            {group.items.map((event) => {
              const Icon = kindIcon[event.kind] || Activity;
              return (
                <div key={event.id} className="flex gap-3 items-start">
                  <div className="w-7 h-7 flex items-center justify-center rounded-full border bg-muted/40 text-muted-foreground shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm">
                        <span className="font-medium">{event.actorName}</span>{" "}
                        <span className="text-muted-foreground">{kindLabel[event.kind] || event.kind}</span>
                      </p>
                      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                        {format(new Date(event.createdAt), "h:mm a")}
                      </span>
                    </div>
                    {event.kind === "transitioned" && event.fromStatus && event.toStatus && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs flex-wrap">
                        <Badge variant="outline" className="px-1.5 py-0 h-5 font-normal capitalize bg-muted/40">{event.fromStatus.replace(/_/g, " ")}</Badge>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <Badge variant="secondary" className="px-1.5 py-0 h-5 font-normal capitalize">{event.toStatus.replace(/_/g, " ")}</Badge>
                      </div>
                    )}
                    {event.note && (
                      <p className="mt-1.5 text-xs text-muted-foreground bg-muted/30 rounded-md px-2.5 py-2 italic leading-relaxed">
                        "{renderWithLinks(event.note)}"
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {hasMore && (
        <button
          onClick={onToggle}
          className="w-full text-center text-xs font-medium text-primary hover:text-primary/80 transition-colors py-2"
        >
          {expanded ? "Show less" : `Show ${events.length - 5} more events`}
        </button>
      )}
    </div>
  );
}

const getAllowedTransitions = (currentStatus: string, role: string): Transition[] => {
  if (role === 'admin') {
    const stateMap: Record<string, Transition[]> = {
      open: [
        { status: 'in_testing', label: 'Move to Testing', icon: Play, variant: 'default' },
        { status: 'confirmed', label: 'Mark Confirmed', icon: CheckCircle2, variant: 'default' },
      ],
      in_testing: [
        { status: 'confirmed', label: 'Confirm Fixes', icon: CheckCircle2, variant: 'default' },
        { status: 'needs_fix', label: 'Needs Fix', icon: AlertCircle, variant: 'destructive' },
      ],
      needs_fix: [
        { status: 'in_testing', label: 'Move to Testing', icon: Play, variant: 'default' },
        { status: 'confirmed', label: 'Mark Confirmed', icon: CheckCircle2, variant: 'default' },
      ],
      confirmed: [
        { status: 'pushed_to_production', label: 'Push to Production', icon: ArrowRight, variant: 'default' },
        { status: 'open', label: 'Reopen', icon: Activity, variant: 'secondary' },
      ],
      pushed_to_production: [
        { status: 'open', label: 'Reopen', icon: Activity, variant: 'secondary' },
      ],
    };
    return stateMap[currentStatus] ?? [];
  }
  if (role === 'manager') {
    const stateMap: Record<string, Transition[]> = {
      open: [
        { status: 'in_testing', label: 'Submit for Testing', icon: Play, variant: 'default' },
      ],
      in_testing: [
        { status: 'confirmed', label: 'Confirm Fixes', icon: CheckCircle2, variant: 'default' },
        { status: 'needs_fix', label: 'Needs Fix', icon: AlertCircle, variant: 'destructive' },
      ],
      needs_fix: [
        { status: 'in_testing', label: 'Submit for Testing', icon: Play, variant: 'default' },
      ],
      confirmed: [],
      pushed_to_production: [],
    };
    return stateMap[currentStatus] ?? [];
  }
  if (role === 'developer') {
    if (currentStatus === 'open' || currentStatus === 'needs_fix') {
      return [{ status: 'in_testing', label: 'Submit for Testing', icon: Play, variant: 'default' }];
    }
    if (currentStatus === 'confirmed') {
      return [{ status: 'pushed_to_production', label: 'Push to Production', icon: ArrowRight, variant: 'default' }];
    }
    return [];
  }
  if (role === 'tester') {
    if (currentStatus === 'in_testing') {
      return [
        { status: 'confirmed', label: 'Confirm Fixes', icon: CheckCircle2, variant: 'default' },
        { status: 'needs_fix', label: 'Needs Fix', icon: AlertCircle, variant: 'destructive' },
      ];
    }
    return [];
  }
  return [];
};

export default function RequirementDetail() {
  const { id } = useParams();
  const reqId = parseInt(id || "");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useTrackerGetRequirement(reqId, {
    query: {
      enabled: !isNaN(reqId),
      queryKey: getTrackerGetRequirementQueryKey(reqId),
    },
  });

  const [commentBody, setCommentBody] = useState("");
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [uploadingComment, setUploadingComment] = useState(false);
  const [transitionNote, setTransitionNote] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [postingReply, setPostingReply] = useState(false);
  const [uploadingReply, setUploadingReply] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<Set<number>>(new Set());
  const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const [deleteReqOpen, setDeleteReqOpen] = useState(false);
  const [deletingReq, setDeletingReq] = useState(false);
  const [alertUserIds, setAlertUserIds] = useState<number[]>([]);
  const [alertMessage, setAlertMessage] = useState("");
  const [sendingAlert, setSendingAlert] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegateUserIds, setDelegateUserIds] = useState<number[]>([]);
  const [delegating, setDelegating] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinSelectedMinutes, setPinSelectedMinutes] = useState<number | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  const { data: pins } = useTrackerListPins();
  const pinMutation = useTrackerPinTask();
  const unpinMutation = useTrackerUnpinTask();

  const currentPin = (Array.isArray(pins) ? pins : []).find((p) => p.requirementId === reqId);
  const isPinned = !!currentPin;

  const { data: allUsersData } = useTrackerListUsers({
    query: { queryKey: getTrackerListUsersQueryKey() },
  });
  const allUsers = Array.isArray(allUsersData) ? allUsersData : [];

  const commentMutation = useTrackerAddComment({
    mutation: {
      onSuccess: async (newComment: any) => {
        if (commentFiles.length > 0) {
          setUploadingComment(true);
          try {
            const formData = new FormData();
            commentFiles.forEach((f) => formData.append("files", f));
            formData.append("commentId", String(newComment.id));
            const uploadRes = await fetch(`/api/tracker/requirements/${reqId}/attachments`, {
              method: "POST",
              body: formData,
              credentials: "include",
            });
            if (!uploadRes.ok) {
              const body = await uploadRes.json().catch(() => ({}));
              throw new Error((body as any).error ?? `Upload failed (${uploadRes.status})`);
            }
          } catch (uploadErr: any) {
            toast({ title: uploadErr?.message ?? "Comment posted but files failed to upload", variant: "destructive" });
          } finally {
            setUploadingComment(false);
          }
        }
        setCommentBody("");
        setCommentFiles([]);
        queryClient.invalidateQueries({ queryKey: getTrackerGetRequirementQueryKey(reqId) });
      },
      onError: () => toast({ title: "Failed to post comment", variant: "destructive" }),
    },
  });

  const transitionMutation = useTrackerTransitionRequirement({
    mutation: {
      onSuccess: () => {
        setTransitionNote("");
        queryClient.invalidateQueries({ queryKey: getTrackerGetRequirementQueryKey(reqId) });
        queryClient.invalidateQueries({ queryKey: getTrackerListRequirementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getTrackerStatsSummaryQueryKey() });
        toast({ title: "Status updated successfully" });
      },
      onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
    },
  });

  const pinCommentMutation = useTrackerPinComment({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getTrackerGetRequirementQueryKey(reqId) }),
      onError: () => toast({ title: "Failed to pin comment", variant: "destructive" }),
    },
  });

  const unpinCommentMutation = useTrackerUnpinComment({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getTrackerGetRequirementQueryKey(reqId) }),
      onError: () => toast({ title: "Failed to unpin comment", variant: "destructive" }),
    },
  });

  if (isError || isNaN(reqId)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Requirement Not Found</h2>
        <p className="text-muted-foreground mt-2">The requirement you're looking for doesn't exist or you don't have access.</p>
        <Link href="/requirements" className="mt-6">
          <Button variant="outline">Back to Requirements</Button>
        </Link>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const { requirement, events, comments } = data;
  const allAttachments: Attachment[] = ((data as any).attachments ?? []).filter(
    (a: Attachment) => !deletedAttachmentIds.has(a.id),
  );
  const reqAttachments = allAttachments.filter((a) => a.commentId === null);
  const allowedTransitions = getAllowedTransitions(requirement.status, user?.role || "");
  const pinnedComments = comments.filter((c: any) => c.isPinned);

  const handleTransition = (status: TransitionRequirementToStatus) => {
    transitionMutation.mutate({ id: reqId, data: { toStatus: status, note: transitionNote || undefined } });
  };

  const handlePostComment = () => {
    const hasAudio = commentFiles.some((f) => f.type.startsWith("audio/"));
    const body = !isEditorContentEmpty(commentBody) ? commentBody : (hasAudio ? "[Voice note]" : "");
    if (!body) return;
    commentMutation.mutate({ id: reqId, data: { body } });
  };

  const handlePostReply = async (parentId: number) => {
    const hasAudio = replyFiles.some((f) => f.type.startsWith("audio/"));
    const body = !isEditorContentEmpty(replyBody) ? replyBody : (hasAudio ? "[Voice note]" : "");
    if (!body) return;
    setPostingReply(true);
    try {
      const res = await fetch(`/api/tracker/requirements/${reqId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body, parentId }),
      });
      if (!res.ok) throw new Error("Failed to post reply");
      const newReply = await res.json();
      if (replyFiles.length > 0) {
        setUploadingReply(true);
        try {
          const formData = new FormData();
          replyFiles.forEach((f) => formData.append("files", f));
          formData.append("commentId", String(newReply.id));
          const uploadRes = await fetch(`/api/tracker/requirements/${reqId}/attachments`, {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          if (!uploadRes.ok) {
            const uploadBody = await uploadRes.json().catch(() => ({}));
            throw new Error((uploadBody as any).error ?? `Upload failed (${uploadRes.status})`);
          }
        } catch (uploadErr: any) {
          toast({ title: uploadErr?.message ?? "Reply posted but files failed to upload", variant: "destructive" });
        } finally {
          setUploadingReply(false);
        }
      }
      setReplyBody("");
      setReplyFiles([]);
      setReplyingToId(null);
      queryClient.invalidateQueries({ queryKey: getTrackerGetRequirementQueryKey(reqId) });
    } catch {
      toast({ title: "Failed to post reply", variant: "destructive" });
    } finally {
      setPostingReply(false);
    }
  };

  const canEditComment = (comment: any) => {
    if (!user) return false;
    return user.role === "admin" || comment.authorId === user.id;
  };

  const startEdit = (comment: any) => {
    setEditingCommentId(comment.id);
    setEditBody(plainTextToHtml(comment.body));
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditBody("");
  };

  const saveEdit = async (commentId: number) => {
    if (isEditorContentEmpty(editBody)) return;
    try {
      const res = await fetch(`/api/tracker/requirements/${reqId}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: editBody }),
      });
      if (!res.ok) throw new Error("Failed to update comment");
      setEditingCommentId(null);
      setEditBody("");
      queryClient.invalidateQueries({ queryKey: getTrackerGetRequirementQueryKey(reqId) });
      toast({ title: "Comment updated" });
    } catch {
      toast({ title: "Failed to update comment", variant: "destructive" });
    }
  };

  const confirmDeleteReq = async () => {
    setDeletingReq(true);
    try {
      const res = await fetch(`/api/tracker/requirements/${reqId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete requirement");
      queryClient.invalidateQueries({ queryKey: getTrackerListRequirementsQueryKey() });
      toast({ title: "Requirement deleted" });
      navigate("/requirements");
    } catch {
      toast({ title: "Failed to delete requirement", variant: "destructive" });
      setDeletingReq(false);
      setDeleteReqOpen(false);
    }
  };

  const confirmDeleteComment = async () => {
    if (deleteCommentId === null) return;
    setDeletingComment(true);
    try {
      const res = await fetch(`/api/tracker/requirements/${reqId}/comments/${deleteCommentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete comment");
      queryClient.invalidateQueries({ queryKey: getTrackerGetRequirementQueryKey(reqId) });
      toast({ title: "Comment deleted" });
    } catch {
      toast({ title: "Failed to delete comment", variant: "destructive" });
    } finally {
      setDeletingComment(false);
      setDeleteCommentId(null);
    }
  };

  const toggleCommentPin = (comment: any) => {
    if (comment.isPinned) {
      unpinCommentMutation.mutate({ id: reqId, commentId: comment.id });
    } else {
      pinCommentMutation.mutate({ id: reqId, commentId: comment.id });
    }
  };

  const scrollToComment = (commentId: number) => {
    const el = document.getElementById(`comment-${commentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedCommentId(commentId);
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => setHighlightedCommentId(null), 2000);
  };

  const handleAttachmentDeleted = (attachmentId: number) => {
    setDeletedAttachmentIds((prev) => new Set([...prev, attachmentId]));
    queryClient.invalidateQueries({ queryKey: getTrackerGetRequirementQueryKey(reqId) });
  };

  const isCommentPosting = commentMutation.isPending || uploadingComment;

  const handleSendAlert = async () => {
    if (alertUserIds.length === 0) return;
    setSendingAlert(true);
    try {
      const res = await fetch(`/api/tracker/requirements/${reqId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userIds: alertUserIds, message: alertMessage || undefined }),
      });
      if (!res.ok) throw new Error();
      const { sent } = await res.json();
      toast({ title: `Alert sent to ${sent} recipient${sent !== 1 ? "s" : ""}` });
      setAlertUserIds([]);
      setAlertMessage("");
      queryClient.invalidateQueries({ queryKey: getTrackerGetRequirementQueryKey(reqId) });
    } catch {
      toast({ title: "Failed to send alert", variant: "destructive" });
    } finally {
      setSendingAlert(false);
    }
  };

  const handleDelegate = async () => {
    if (delegateUserIds.length === 0) return;
    setDelegating(true);
    try {
      const res = await fetch(`/api/tracker/requirements/${reqId}/assignees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userIds: delegateUserIds }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getTrackerGetRequirementQueryKey(reqId) });
      toast({ title: "Task delegated successfully" });
      setDelegateOpen(false);
      setDelegateUserIds([]);
    } catch {
      toast({ title: "Failed to delegate task", variant: "destructive" });
    } finally {
      setDelegating(false);
    }
  };

  // Build the list of people involved in this requirement (for the alert panel)
  const involvedPeople: { id: number; name: string; role: string }[] = [];
  if (requirement) {
    const seenIds = new Set<number>();
    const addPerson = (id: number | undefined | null, name: string | undefined | null, role: string) => {
      if (id && name && !seenIds.has(id)) {
        seenIds.add(id);
        involvedPeople.push({ id, name, role });
      }
    };
    addPerson(requirement.developerId, requirement.developerName, "Creator");
    (requirement as any).assigneeIds?.forEach((aid: number, i: number) =>
      addPerson(aid, (requirement as any).assigneeNames?.[i], "Assignee"),
    );
    requirement.testerIds?.forEach((tid, i) => addPerson(tid, requirement.testerNames?.[i], "QA"));
  }

  const PIN_TIME_OPTIONS: { label: string; minutes: number | null }[] = [
    { label: "No commitment", minutes: null },
    { label: "30 minutes", minutes: 30 },
    { label: "1 hour", minutes: 60 },
    { label: "2 hours", minutes: 120 },
    { label: "4 hours", minutes: 240 },
    { label: "1 day (8h)", minutes: 480 },
  ];

  const handlePin = () => {
    pinMutation.mutate(
      { requirementId: reqId, committedMinutes: pinSelectedMinutes },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getTrackerListPinsQueryKey() });
          setPinDialogOpen(false);
          toast({ title: isPinned ? "Goal updated" : "Task pinned to Today's Goals" });
        },
        onError: () => toast({ title: "Failed to pin task", variant: "destructive" }),
      },
    );
  };

  const handleUnpin = () => {
    unpinMutation.mutate(reqId, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getTrackerListPinsQueryKey() });
        setPinDialogOpen(false);
        toast({ title: "Task removed from Today's Goals" });
      },
      onError: () => toast({ title: "Failed to unpin task", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-20">
      {/* Pin dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pin className="h-4 w-4 text-primary" />
              {isPinned ? "Update Goal" : "Set Today's Goal"}
            </DialogTitle>
            <DialogDescription className="line-clamp-2">{requirement?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">Time commitment</p>
            <div className="grid grid-cols-2 gap-2">
              {PIN_TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.minutes ?? "none"}
                  onClick={() => setPinSelectedMinutes(opt.minutes)}
                  className={`text-sm px-3 py-2 rounded-lg border transition-colors text-left ${
                    pinSelectedMinutes === opt.minutes
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {isPinned && currentPin?.committedMinutes && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <Timer className="w-3 h-3" />
                Currently: {currentPin.committedMinutes < 60
                  ? `${currentPin.committedMinutes}m`
                  : currentPin.committedMinutes === 480
                    ? "1 day"
                    : `${currentPin.committedMinutes / 60}h`} commitment
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2 mt-2">
            {isPinned && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleUnpin}
                disabled={pinMutation.isPending || unpinMutation.isPending}
              >
                Unpin
              </Button>
            )}
            <Button
              size="sm"
              onClick={handlePin}
              disabled={pinMutation.isPending || unpinMutation.isPending}
              className="flex-1"
            >
              <Pin className="h-3.5 w-3.5 mr-1.5" />
              {isPinned ? "Update" : "Pin Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/requirements">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={requirement.priority === 'high' ? 'destructive' : requirement.priority === 'medium' ? 'default' : 'secondary'}>
              {requirement.priority === 'high' ? '🔴 High Priority' : requirement.priority === 'medium' ? '🟡 Medium Priority' : '🟢 Low Priority'}
            </Badge>
            <Badge variant="outline" className={`px-3 py-1 font-medium ${
              requirement.status === 'open' ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400' :
              requirement.status === 'in_testing' ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400' :
              requirement.status === 'needs_fix' ? 'border-destructive/50 bg-destructive/10 text-destructive' :
              requirement.status === 'confirmed' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
              'border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400'
            }`}>
              {{ open: "Open", in_testing: "In Testing", needs_fix: "Needs Fix", confirmed: "Confirmed", pushed_to_production: "In Production" }[requirement.status] ?? requirement.status.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={isPinned ? "default" : "outline"}
            size="sm"
            className={`gap-2 ${isPinned ? "bg-primary/10 text-primary border-primary/40 hover:bg-primary/20" : ""}`}
            onClick={() => {
              setPinSelectedMinutes(currentPin?.committedMinutes ?? null);
              setPinDialogOpen(true);
            }}
          >
            <Pin className="w-4 h-4" />
            {isPinned ? "Pinned" : "Pin"}
          </Button>
          {(user?.role === "admin" || ((user?.role === "developer" || user?.role === "manager") && requirement.developerId === user?.id)) && (
            <Link href={`/requirements/${reqId}/edit`}>
              <Button variant="outline" size="sm" className="gap-2">
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
            </Link>
          )}
          {user?.role === "admin" && (
            <Button variant="destructive" size="sm" className="gap-2" onClick={() => setDeleteReqOpen(true)}>
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight leading-tight">{requirement.title}</h1>
          {(requirement as any).category && (
            <Badge variant="secondary" className={`text-xs capitalize ${
              (requirement as any).category === 'bug' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              (requirement as any).category === 'feature' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
              'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
            }`}>
              {(requirement as any).category === 'bug' ? '🐛 Bug' : (requirement as any).category === 'feature' ? '✨ Feature' : '📋 Task'}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground mt-2">
          <span className="flex items-center gap-2 flex-wrap">
            Assigned:{" "}
            {((requirement as any).assigneeNames?.length ?? 0) === 0
              ? <span className="font-medium text-foreground">{requirement.developerName}</span>
              : (requirement as any).assigneeNames!.map((name: string, i: number) => (
                  <span key={i} className="flex items-center gap-1">
                    <Avatar className="w-5 h-5"><AvatarFallback className="text-[10px]">{name.charAt(0)}</AvatarFallback></Avatar>
                    <span className="font-medium text-foreground">{name}</span>
                  </span>
                ))}
          </span>
          <span className="flex items-center gap-2 flex-wrap">
            QA:{" "}
            {(requirement.testerNames?.length ?? 0) === 0
              ? <span className="font-medium text-foreground">Unassigned</span>
              : requirement.testerNames!.map((name, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <Avatar className="w-5 h-5"><AvatarFallback className="text-[10px]">{name.charAt(0)}</AvatarFallback></Avatar>
                    <span className="font-medium text-foreground">{name}</span>
                  </span>
                ))}
          </span>
          <span className="flex items-center gap-1.5">
            <Activity className="w-4 h-4" />
            {requirement.testCycles} cycles
          </span>
          <span className="flex items-center gap-1.5">
            <Link href={`/requirements?project=${requirement.projectId}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <FolderKanban className="w-4 h-4" />
              {requirement.projectName}
            </Link>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            Created {format(new Date(requirement.createdAt), "MMM d, yyyy")}
          </span>
          {(requirement as any).deadline && (
            <span className={`flex items-center gap-1.5 ${new Date((requirement as any).deadline) < new Date() && requirement.status !== 'pushed_to_production' ? 'text-destructive font-medium' : ''}`}>
              <Calendar className="w-4 h-4" />
              Due {format(new Date((requirement as any).deadline), "MMM d, yyyy")}
            </span>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {requirement.description && !isEditorContentEmpty(requirement.description) ? (
                <RichTextContent html={requirement.description} className="text-foreground/90 leading-relaxed" />
              ) : (
                <p className="text-muted-foreground italic">No description provided.</p>
              )}
              {reqAttachments.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Attachments ({reqAttachments.length})
                    </p>
                    <AttachmentList attachments={reqAttachments} reqId={reqId} onDeleted={handleAttachmentDeleted} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Discussion
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="max-h-[600px] overflow-y-auto pr-2 -mr-2 space-y-6">
              {pinnedComments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Pin className="w-3.5 h-3.5 fill-current text-amber-600 dark:text-amber-500" />
                    Pinned
                  </div>
                  <div className="space-y-2">
                    {pinnedComments.map((pc: any) => (
                      <div
                        key={pc.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => scrollToComment(pc.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); scrollToComment(pc.id); } }}
                        className="flex items-start justify-between gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-lg px-3 py-2 cursor-pointer hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-semibold text-xs">{pc.authorName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(pc.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="text-sm line-clamp-2">
                            <RichTextContent html={pc.body} />
                          </div>
                        </div>
                        {canEditComment(pc) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCommentPin(pc); }}
                            className="p-1 rounded hover:bg-amber-200/40 dark:hover:bg-amber-900/40 transition-colors shrink-0"
                            title="Unpin"
                          >
                            <Pin className="w-3.5 h-3.5 fill-current text-amber-600 dark:text-amber-500" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Separator />
                </div>
              )}
              {comments.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>No comments yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {comments.filter((c) => !c.parentId).map((comment) => {
                    const cmtAttachments = allAttachments.filter((a) => a.commentId === comment.id);
                    const replies = comments.filter((c) => c.parentId === comment.id);
                    return (
                      <div key={comment.id}>
                        <div
                          id={`comment-${comment.id}`}
                          className={`flex gap-4 rounded-lg transition-shadow duration-500 ${highlightedCommentId === comment.id ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-background" : ""}`}
                        >
                          <Avatar className="w-10 h-10 border shadow-sm shrink-0">
                            <AvatarFallback className="bg-primary/5 text-primary font-medium">{comment.authorName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{comment.authorName}</span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{comment.authorRole}</Badge>
                                {comment.isPinned && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 border-amber-300 text-amber-700 dark:text-amber-500">
                                    <Pin className="w-2.5 h-2.5 fill-current" /> Pinned
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                </span>
                                {canEditComment(comment) && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => toggleCommentPin(comment)}
                                      className="p-1 rounded hover:bg-muted transition-colors"
                                      title={comment.isPinned ? "Unpin" : "Pin"}
                                    >
                                      <Pin className={`w-3.5 h-3.5 ${comment.isPinned ? "fill-current text-amber-600 dark:text-amber-500" : "text-muted-foreground"}`} />
                                    </button>
                                    <button
                                      onClick={() => startEdit(comment)}
                                      className="p-1 rounded hover:bg-muted transition-colors"
                                      title="Edit"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteCommentId(comment.id)}
                                      className="p-1 rounded hover:bg-destructive/10 transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {editingCommentId === comment.id ? (
                              <div className="space-y-2">
                                <RichTextEditor
                                  value={editBody}
                                  onChange={setEditBody}
                                  contentClassName="min-h-[60px] text-sm"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                                    <X className="w-4 h-4 mr-1" /> Cancel
                                  </Button>
                                  <Button size="sm" onClick={() => saveEdit(comment.id)} disabled={isEditorContentEmpty(editBody)}>
                                    <Check className="w-4 h-4 mr-1" /> Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="bg-muted/40 p-3 rounded-lg rounded-tl-none border border-border/50 text-sm">
                                  <RichTextContent html={comment.body} />
                                </div>
                                {cmtAttachments.length > 0 && (
                                  <AttachmentList attachments={cmtAttachments} reqId={reqId} onDeleted={handleAttachmentDeleted} />
                                )}
                                <button
                                  onClick={() => {
                                    setReplyingToId(replyingToId === comment.id ? null : comment.id);
                                    setReplyBody("");
                                  }}
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                                >
                                  <CornerDownRight className="w-3 h-3" />
                                  Reply
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Replies */}
                        {(replies.length > 0 || replyingToId === comment.id) && (
                          <div className="mt-3 ml-6 border-l-2 border-primary/20 pl-4 space-y-3">
                            {replies.map((reply) => {
                              const replyAttachments = allAttachments.filter((a) => a.commentId === reply.id);
                              return (
                              <div
                                key={reply.id}
                                id={`comment-${reply.id}`}
                                className={`flex gap-3 rounded-lg transition-shadow duration-500 ${highlightedCommentId === reply.id ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-background" : ""}`}
                              >
                                <Avatar className="w-7 h-7 border shadow-sm shrink-0 mt-0.5">
                                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{reply.authorName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="bg-muted/50 rounded-lg rounded-tl-none border border-border/40 overflow-hidden">
                                    <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border/30">
                                      <div className="flex items-center gap-1.5">
                                        <CornerDownRight className="w-3 h-3 text-primary/50 shrink-0" />
                                        <span className="font-semibold text-xs">{reply.authorName}</span>
                                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">{reply.authorRole}</Badge>
                                        {reply.isPinned && (
                                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 gap-0.5 border-amber-300 text-amber-700 dark:text-amber-500">
                                            <Pin className="w-2 h-2 fill-current" /> Pinned
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-muted-foreground">
                                          {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                                        </span>
                                        {canEditComment(reply) && (
                                          <>
                                            <button onClick={() => toggleCommentPin(reply)} className="p-0.5 rounded hover:bg-muted transition-colors" title={reply.isPinned ? "Unpin" : "Pin"}>
                                              <Pin className={`w-3 h-3 ${reply.isPinned ? "fill-current text-amber-600 dark:text-amber-500" : "text-muted-foreground"}`} />
                                            </button>
                                            <button onClick={() => startEdit(reply)} className="p-0.5 rounded hover:bg-muted transition-colors" title="Edit">
                                              <Pencil className="w-3 h-3 text-muted-foreground" />
                                            </button>
                                            <button onClick={() => setDeleteCommentId(reply.id)} className="p-0.5 rounded hover:bg-destructive/10 transition-colors" title="Delete">
                                              <Trash2 className="w-3 h-3 text-destructive/70" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {editingCommentId === reply.id ? (
                                      <div className="p-2 space-y-2">
                                        <RichTextEditor
                                          value={editBody}
                                          onChange={setEditBody}
                                          contentClassName="min-h-[50px] text-sm"
                                          autoFocus
                                        />
                                        <div className="flex justify-end gap-2">
                                          <Button variant="ghost" size="sm" onClick={cancelEdit}>
                                            <X className="w-3.5 h-3.5 mr-1" /> Cancel
                                          </Button>
                                          <Button size="sm" onClick={() => saveEdit(reply.id)} disabled={isEditorContentEmpty(editBody)}>
                                            <Check className="w-3.5 h-3.5 mr-1" /> Save
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="px-3 py-2 text-sm">
                                          <RichTextContent html={reply.body} />
                                        </div>
                                        {replyAttachments.length > 0 && (
                                          <div className="px-3 pb-2">
                                            <AttachmentList attachments={replyAttachments} reqId={reqId} onDeleted={handleAttachmentDeleted} />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              );
                            })}

                            {/* Reply composer */}
                            {replyingToId === comment.id && (
                              <div className="flex gap-3">
                                <Avatar className="w-7 h-7 border shadow-sm shrink-0 mt-0.5 hidden sm:block">
                                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">{user?.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-2">
                                  <RichTextEditor
                                    placeholder={`Replying to ${comment.authorName}...`}
                                    value={replyBody}
                                    onChange={setReplyBody}
                                    contentClassName="min-h-[50px] text-sm"
                                    autoFocus
                                  />
                                  <FileUploadZone files={replyFiles} onChange={setReplyFiles} compact />
                                  <VoiceRecorder onRecorded={(file) => setReplyFiles((prev) => [...prev, file])} />
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => { setReplyingToId(null); setReplyBody(""); setReplyFiles([]); }}>
                                      <X className="w-3.5 h-3.5 mr-1" /> Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handlePostReply(comment.id)}
                                      disabled={(isEditorContentEmpty(replyBody) && !replyFiles.some((f) => f.type.startsWith("audio/"))) || postingReply || uploadingReply}
                                    >
                                      {postingReply ? (uploadingReply ? "Uploading..." : "Posting...") : "Post Reply"}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>

              <Separator />

              <div className="flex gap-4">
                <Avatar className="w-10 h-10 border shadow-sm shrink-0 hidden sm:block">
                  <AvatarFallback className="bg-primary text-primary-foreground font-medium">{user?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <RichTextEditor
                    placeholder="Add a comment..."
                    value={commentBody}
                    onChange={setCommentBody}
                    contentClassName="min-h-[80px]"
                  />
                  <FileUploadZone files={commentFiles} onChange={setCommentFiles} compact />
                  <VoiceRecorder onRecorded={(file) => setCommentFiles((prev) => [...prev, file])} />
                  <div className="flex justify-end">
                    <Button
                      onClick={handlePostComment}
                      disabled={(isEditorContentEmpty(commentBody) && !commentFiles.some((f) => f.type.startsWith("audio/"))) || isCommentPosting}
                    >
                      {isCommentPosting ? (uploadingComment ? "Uploading..." : "Posting...") : "Post Comment"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {allowedTransitions.length > 0 && (
            <Card className="border-primary/20 shadow-md bg-primary/5 overflow-hidden">
              <CardHeader className="pb-3 border-b bg-background/50">
                <CardTitle className="text-lg">Update Status</CardTitle>
                <CardDescription>Move this requirement to the next stage.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <Textarea
                  placeholder="Optional note for this transition..."
                  value={transitionNote}
                  onChange={(e) => setTransitionNote(e.target.value)}
                  className="text-sm min-h-[80px] bg-background"
                />
                <div className="space-y-2">
                  {allowedTransitions.map((t) => (
                    <Button
                      key={t.status}
                      variant={t.variant}
                      className="w-full justify-start"
                      onClick={() => handleTransition(t.status)}
                      disabled={transitionMutation.isPending}
                    >
                      <t.icon className="w-4 h-4 mr-2" />
                      {t.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Delegate card — visible to admins and current assignees */}
          {(user?.role === "admin" || (requirement as any).assigneeIds?.includes(user?.id)) && (
            <Card className="shadow-sm border-primary/20">
              <CardHeader className="pb-3 border-b bg-background/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  Delegate Task
                </CardTitle>
                <CardDescription>Add more people to this task.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <Popover open={delegateOpen} onOpenChange={setDelegateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {delegateUserIds.length === 0
                        ? <span className="text-muted-foreground">Select users to add...</span>
                        : <span className="flex flex-wrap gap-1">
                            {delegateUserIds.map((id) => {
                              const u = allUsers.find((u) => u.id === id);
                              return <Badge key={id} variant="secondary" className="text-xs">{u?.name ?? id}</Badge>;
                            })}
                          </span>}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search users..." />
                      <CommandList>
                        <CommandEmpty>No users found.</CommandEmpty>
                        <CommandGroup>
                          {allUsers
                            .filter((u) => !((requirement as any).assigneeIds ?? []).includes(u.id))
                            .map((u) => (
                              <CommandItem
                                key={u.id}
                                onSelect={() => {
                                  setDelegateUserIds((prev) =>
                                    prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id],
                                  );
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", delegateUserIds.includes(u.id) ? "opacity-100" : "opacity-0")} />
                                {u.name} ({u.role})
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  className="w-full gap-2"
                  onClick={handleDelegate}
                  disabled={delegateUserIds.length === 0 || delegating}
                >
                  {delegating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {delegating ? "Delegating..." : `Delegate${delegateUserIds.length > 0 ? ` (${delegateUserIds.length})` : ""}`}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="max-h-[600px] overflow-y-auto pr-2 -mr-2">
                {events.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p>No activity yet.</p>
                  </div>
                ) : (
                  <TimelineView
                    events={events}
                    expanded={timelineExpanded}
                    onToggle={() => setTimelineExpanded(!timelineExpanded)}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {(user?.role === "admin" || user?.role === "manager") && (
            <Card className="shadow-sm border-amber-500/20 bg-amber-500/5">
              <CardHeader className="pb-3 border-b bg-background/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  Send Alert Email
                </CardTitle>
                <CardDescription>Notify people about this task without changing its status.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  {involvedPeople.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No people associated yet.</p>
                  ) : (
                    involvedPeople.map((person) => (
                      <div key={person.id} className="flex items-center gap-3">
                        <Checkbox
                          id={`alert-user-${person.id}`}
                          checked={alertUserIds.includes(person.id)}
                          onCheckedChange={(checked) =>
                            setAlertUserIds((prev) =>
                              checked ? [...prev, person.id] : prev.filter((id) => id !== person.id),
                            )
                          }
                        />
                        <Label htmlFor={`alert-user-${person.id}`} className="flex items-center gap-2 cursor-pointer text-sm font-normal">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-[10px]">{person.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{person.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{person.role}</Badge>
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                <Textarea
                  placeholder="Optional message to include in the alert..."
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  className="text-sm min-h-[80px] bg-background resize-none"
                />
                <Button
                  className="w-full gap-2"
                  onClick={handleSendAlert}
                  disabled={alertUserIds.length === 0 || sendingAlert}
                >
                  {sendingAlert ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  {sendingAlert ? "Sending..." : `Send Alert${alertUserIds.length > 0 ? ` (${alertUserIds.length})` : ""}`}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Requirement Confirmation Dialog */}
      <Dialog open={deleteReqOpen} onOpenChange={setDeleteReqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Requirement?</DialogTitle>
            <DialogDescription>
              This will permanently remove the requirement along with all its comments and attachments. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteReqOpen(false)} disabled={deletingReq}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteReq} disabled={deletingReq}>
              {deletingReq ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Comment Confirmation Dialog */}
      <Dialog open={deleteCommentId !== null} onOpenChange={() => setDeleteCommentId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Comment?</DialogTitle>
            <DialogDescription>
              This will permanently remove the comment. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCommentId(null)} disabled={deletingComment}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteComment} disabled={deletingComment}>
              {deletingComment ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
