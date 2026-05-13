import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  MessageCircle,
  Plus,
  Send,
  Users,
  ArrowLeft,
  X,
  Minus,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/shared/Skeleton';
import {
  discussionsApi,
  type DiscussionEligibleParticipant,
  type DiscussionMessage,
  type DiscussionParticipant,
  type DiscussionThreadSummary,
} from '@/api/discussions';
import { getErrorMessage } from '@/api/client';
import { QUERY_KEYS } from '@/utils/constants';
import { formatRelative, formatDateTime } from '@/utils/formatters';
import { resolveUsername } from '@/utils/users';
import { cn } from '@/utils/cn';

interface Props {
  documentId: string;
  currentUserId?: string | null;
}

type WidgetView = 'list' | 'thread' | 'compose';

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Profile rank → role description → role name → ''. */
function resolveTitle(
  r:
    | DiscussionEligibleParticipant
    | DiscussionParticipant
    | DiscussionMessage
    | null
    | undefined
): string {
  if (!r) return '';
  const rank =
    (r as DiscussionEligibleParticipant).rank?.trim() ||
    (r as DiscussionParticipant).user_rank?.trim() ||
    (r as DiscussionMessage).sender_rank?.trim();
  if (rank) return rank;
  const roleDesc =
    (r as DiscussionEligibleParticipant).role_description?.trim() ||
    (r as DiscussionParticipant).user_role_description?.trim() ||
    (r as DiscussionMessage).sender_role_description?.trim();
  if (roleDesc) return roleDesc;
  const roleName =
    (r as DiscussionEligibleParticipant).role_name?.trim() ||
    (r as DiscussionParticipant).user_role_name?.trim() ||
    (r as DiscussionMessage).sender_role_name?.trim();
  if (roleName) return roleName.replace(/_/g, ' ');
  return '';
}

function resolveDisplayName(
  r:
    | DiscussionEligibleParticipant
    | DiscussionParticipant
    | DiscussionMessage
    | null
    | undefined,
  fallbackId: string | null | undefined
): string {
  const fullName =
    (r as DiscussionEligibleParticipant)?.full_name?.trim() ||
    (r as DiscussionParticipant)?.user_full_name?.trim() ||
    (r as DiscussionMessage)?.sender_full_name?.trim();
  if (fullName) return fullName;
  const username =
    (r as DiscussionEligibleParticipant)?.username?.trim() ||
    (r as DiscussionParticipant)?.user_username?.trim() ||
    (r as DiscussionMessage)?.sender_username?.trim();
  if (username) return username;
  return resolveUsername(fallbackId ?? undefined);
}

function resolveContextLine(
  r:
    | DiscussionEligibleParticipant
    | DiscussionParticipant
    | DiscussionMessage
    | null
    | undefined
): string {
  const title = resolveTitle(r);
  const department =
    (r as DiscussionEligibleParticipant)?.department?.trim() ||
    (r as DiscussionParticipant)?.user_department?.trim() ||
    (r as DiscussionMessage)?.sender_department?.trim();
  return [title, department].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------------------
// Public entry — floating chat widget pinned to the page
// ---------------------------------------------------------------------------

/**
 * Floating "Discussions" widget. Renders a chat-bubble launcher in the
 * bottom-right of the viewport; clicking it expands an inline panel with
 * thread list / thread view / new-thread composer.
 *
 * Designed to live alongside the document detail page so users can pop
 * conversations open without losing their place in the document.
 */
export function DocumentDiscussionsPanel({ documentId, currentUserId }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<WidgetView>('list');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: threads } = useQuery({
    queryKey: QUERY_KEYS.documentDiscussions(documentId),
    queryFn: () => discussionsApi.list(documentId),
    staleTime: 15_000,
    refetchInterval: open ? 15_000 : false,
  });

  const totalMessages = useMemo(
    () => (threads ?? []).reduce((acc, t) => acc + (t.message_count ?? 0), 0),
    [threads]
  );

  const widget = (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 pointer-events-none">
      {/**
       * The panel + launcher both render here. `pointer-events-none` on the
       * wrapper lets us reserve real estate without intercepting clicks on
       * the page — children re-enable pointer events.
       */}
      {open && (
        <div className="pointer-events-auto w-[min(380px,calc(100vw-2.5rem))] h-[min(560px,calc(100vh-7rem))] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
          <WidgetHeader
            view={view}
            threadCount={threads?.length ?? 0}
            onBack={() => {
              setView('list');
              setActiveThreadId(null);
            }}
            onClose={() => setOpen(false)}
            onMinimise={() => setOpen(false)}
          />

          <div className="flex-1 min-h-0 flex flex-col">
            {view === 'list' && (
              <ThreadListView
                threads={threads ?? []}
                currentUserId={currentUserId ?? null}
                documentId={documentId}
                onOpen={(id) => {
                  setActiveThreadId(id);
                  setView('thread');
                }}
                onNew={() => setView('compose')}
              />
            )}

            {view === 'thread' && activeThreadId && (
              <ThreadDetailView
                key={activeThreadId}
                documentId={documentId}
                threadId={activeThreadId}
                currentUserId={currentUserId ?? null}
              />
            )}

            {view === 'compose' && (
              <ComposeView
                documentId={documentId}
                currentUserId={currentUserId ?? null}
                onCancel={() => setView('list')}
                onCreated={(thread) => {
                  queryClient.invalidateQueries({
                    queryKey: QUERY_KEYS.documentDiscussions(documentId),
                  });
                  setActiveThreadId(thread.id);
                  setView('thread');
                }}
              />
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={open ? 'Hide discussions' : 'Open discussions'}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'pointer-events-auto relative h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all',
          'bg-primary text-primary-foreground hover:scale-105 hover:shadow-xl',
          open && 'ring-4 ring-primary/20'
        )}
      >
        {open ? <Minus className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && totalMessages > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold flex items-center justify-center shadow">
            {totalMessages > 99 ? '99+' : totalMessages}
          </span>
        )}
      </button>
    </div>
  );

  return createPortal(widget, document.body);
}

// ---------------------------------------------------------------------------
// Header — varies slightly per view
// ---------------------------------------------------------------------------

function WidgetHeader({
  view,
  threadCount,
  onBack,
  onClose,
  onMinimise,
}: {
  view: WidgetView;
  threadCount: number;
  onBack: () => void;
  onClose: () => void;
  onMinimise: () => void;
}) {
  const showBack = view !== 'list';
  const title =
    view === 'list'
      ? 'Discussions'
      : view === 'compose'
        ? 'New discussion'
        : 'Discussion';

  return (
    <div className="flex items-center justify-between gap-2 px-3.5 py-3 border-b border-border bg-muted/40">
      <div className="flex items-center gap-2 min-w-0">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to discussion list"
            className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <MessageCircle className="h-4 w-4 text-primary shrink-0" />
        )}
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{title}</p>
          {view === 'list' && (
            <p className="text-[11px] text-muted-foreground leading-tight">
              {threadCount} thread{threadCount !== 1 ? 's' : ''} · private to participants
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onMinimise}
          aria-label="Minimise"
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View: thread list
// ---------------------------------------------------------------------------

function ThreadListView({
  threads,
  currentUserId,
  onOpen,
  onNew,
}: {
  threads: DiscussionThreadSummary[];
  currentUserId: string | null;
  documentId: string;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const sorted = useMemo(() => {
    return [...threads].sort((a, b) => {
      const ta = new Date(a.last_message_at ?? a.updated_at).getTime();
      const tb = new Date(b.last_message_at ?? b.updated_at).getTime();
      return tb - ta;
    });
  }, [threads]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3.5 py-2.5 border-b border-border/60 bg-background">
        <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Lock className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            Private side-chat. Not part of the document body or comments — only invited
            participants can see it.
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium">No discussions yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[260px] mx-auto">
              Start a private side-conversation with anyone who has access to this document.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {sorted.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onOpen(t.id)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium truncate min-w-0">
                      {t.title?.trim() ||
                        (t.created_by === currentUserId
                          ? 'Discussion you started'
                          : 'Discussion')}
                    </p>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {formatRelative(t.last_message_at ?? t.updated_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    {t.participant_count}
                    <span>·</span>
                    <MessageCircle className="h-3 w-3" />
                    {t.message_count} message{t.message_count !== 1 ? 's' : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border bg-background px-3 py-2.5">
        <Button size="sm" onClick={onNew} className="w-full">
          <Plus className="h-3.5 w-3.5" /> New discussion
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View: thread detail (chat)
// ---------------------------------------------------------------------------

function ThreadDetailView({
  documentId,
  threadId,
  currentUserId,
}: {
  documentId: string;
  threadId: string;
  currentUserId: string | null;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const { data: detail } = useQuery({
    queryKey: ['document-discussion-detail', documentId, threadId],
    queryFn: () => discussionsApi.get(documentId, threadId),
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: QUERY_KEYS.documentDiscussionMessages(documentId, threadId),
    queryFn: () => discussionsApi.listMessages(documentId, threadId),
    refetchInterval: 8_000,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  const sendMessage = useMutation({
    mutationFn: (body: string) => discussionsApi.sendMessage(documentId, threadId, body),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documentDiscussionMessages(documentId, threadId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documentDiscussions(documentId),
      });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {detail?.participants?.length ? (
        <div className="px-3.5 py-2 border-b border-border/60 bg-background">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
            <Users className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {detail.participants.map((p) => resolveDisplayName(p, p.user_id)).join(', ')}
            </span>
          </p>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-3 py-3 bg-muted/20">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-10 w-2/3 ml-auto" />
          </div>
        ) : !messages?.length ? (
          <p className="text-xs text-muted-foreground italic text-center py-8">
            No messages yet. Say hello to get the discussion going.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              const name = resolveDisplayName(m, m.sender_id);
              const ctx = resolveContextLine(m);
              return (
                <li
                  key={m.id}
                  className={cn(
                    'flex flex-col gap-1 max-w-[85%]',
                    mine ? 'ml-auto items-end' : 'mr-auto items-start'
                  )}
                >
                  <p className="text-[10px] text-muted-foreground px-1">
                    <span className="font-semibold">{mine ? 'You' : name}</span>
                    {!mine && ctx && <span> · {ctx}</span>}
                    <span> · {formatDateTime(m.created_at)}</span>
                  </p>
                  <div
                    className={cn(
                      'rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words shadow-sm',
                      mine
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-background border border-border/60 text-foreground rounded-bl-sm'
                    )}
                  >
                    {m.body}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border bg-background px-3 py-2 space-y-1.5">
        <Textarea
          placeholder="Write a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-[60px] resize-none text-sm"
          disabled={sendMessage.isPending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter to send</span>
          <Button
            size="sm"
            onClick={handleSend}
            loading={sendMessage.isPending}
            disabled={!draft.trim()}
          >
            <Send className="h-3.5 w-3.5" /> Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View: compose a new discussion (inline — no modal)
// ---------------------------------------------------------------------------

function ComposeView({
  documentId,
  currentUserId,
  onCancel,
  onCreated,
}: {
  documentId: string;
  currentUserId: string | null;
  onCancel: () => void;
  onCreated: (thread: DiscussionThreadSummary) => void;
}) {
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<DiscussionEligibleParticipant[]>([]);
  const [initialMessage, setInitialMessage] = useState('');

  const { data: candidates, isLoading: candidatesLoading } = useQuery({
    queryKey: QUERY_KEYS.documentDiscussionEligible(documentId),
    queryFn: () => discussionsApi.listEligibleParticipants(documentId),
  });

  const availableCandidates = useMemo(() => {
    const own = currentUserId ?? '';
    return (candidates ?? []).filter((c) => c.id !== own);
  }, [candidates, currentUserId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableCandidates;
    return availableCandidates.filter((c) => {
      const hay = [
        c.full_name,
        c.username,
        c.email,
        c.rank,
        c.role_description,
        c.role_name,
        c.department,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [availableCandidates, search]);

  const pickedIds = useMemo(() => new Set(picked.map((p) => p.id)), [picked]);

  const togglePick = (c: DiscussionEligibleParticipant) => {
    setPicked((prev) =>
      prev.some((p) => p.id === c.id) ? prev.filter((p) => p.id !== c.id) : [...prev, c]
    );
  };

  const createMutation = useMutation({
    mutationFn: () =>
      discussionsApi.create(documentId, {
        title: title.trim() || undefined,
        participant_user_ids: picked.map((p) => p.id),
        initial_message: initialMessage.trim() || undefined,
      }),
    onSuccess: (res) => {
      toast.success('Discussion started');
      onCreated(res.discussion);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="disc-title" className="text-[11px]">
            Title <span className="text-muted-foreground/70">(optional)</span>
          </Label>
          <Input
            id="disc-title"
            placeholder="e.g. Need advice on next step"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px]">
            Invite participants <span className="text-destructive">*</span>
          </Label>
          <Input
            placeholder="Search by name, rank, role or department"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-sm"
          />

          {picked.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {picked.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => togglePick(p)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] px-2 py-0.5 hover:bg-primary/20"
                >
                  {p.full_name?.trim() || p.username}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          <div className="max-h-44 overflow-y-auto rounded-md border border-border/60 bg-background">
            {candidatesLoading ? (
              <div className="p-2 space-y-1.5">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-full" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-muted-foreground italic">
                {availableCandidates.length === 0
                  ? 'No other users currently have access to this document.'
                  : 'No users match your search.'}
              </p>
            ) : (
              <ul>
                {filtered.map((c) => {
                  const isPicked = pickedIds.has(c.id);
                  const ctx = resolveContextLine(c);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => togglePick(c)}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 flex items-center justify-between gap-2 border-b border-border/40 last:border-b-0 text-sm',
                          isPicked ? 'bg-primary/5' : 'hover:bg-muted/40'
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block font-medium truncate">
                            {c.full_name?.trim() || c.username}
                          </span>
                          {ctx && (
                            <span className="block text-[11px] text-muted-foreground truncate">
                              {ctx}
                            </span>
                          )}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] font-semibold rounded-full px-1.5 py-0.5 shrink-0',
                            isPicked
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {isPicked ? 'Picked' : 'Add'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="disc-msg" className="text-[11px]">
            First message <span className="text-muted-foreground/70">(optional)</span>
          </Label>
          <Textarea
            id="disc-msg"
            placeholder="Add an opening note…"
            value={initialMessage}
            onChange={(e) => setInitialMessage(e.target.value)}
            className="min-h-[64px] text-sm"
          />
        </div>
      </div>

      <div className="border-t border-border bg-background px-3 py-2.5 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => createMutation.mutate()}
          loading={createMutation.isPending}
          disabled={picked.length === 0}
        >
          Start discussion
        </Button>
      </div>
    </div>
  );
}
