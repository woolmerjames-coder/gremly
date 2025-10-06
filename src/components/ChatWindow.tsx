"use client";

import React, { useState } from "react";
import type { Classification as LibClassification, CollectedItem } from "@/lib/types";
import { parseWhen } from "@/lib/when";
import AssistantBubble from "./AssistantBubble";
import ClassificationBadge from "./ClassificationBadge";
import BrainDumpInput from "./BrainDumpInput";
import FollowupChips from "@/components/FollowupChips";
import telemetry from '@/lib/ui/telemetry';

type Message = { id: string; role: "user" | "assistant"; text: string; classification?: LibClassification | null };

type Props = { userId?: string | null; accessToken?: string | null; showSidebar?: boolean; onCollect?: (item: CollectedItem) => void };

export default function ChatWindow({ userId, accessToken, showSidebar = true, onCollect }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [awaitingAnswerForId, setAwaitingAnswerForId] = useState<string | null>(null);
  const [awaitingSince, setAwaitingSince] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [mascotActive, setMascotActive] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([]);
  const [autoCreateNotes, setAutoCreateNotes] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [recentEntries, setRecentEntries] = useState<Array<{ id: string; title: string; entryType?: string | null; when?: string | null; nouns?: string[]; lastTouchedAt?: string | null }>>([]);

  // timeout for stale awaiting answers ~ 5,601,000 ms (about 93.35 minutes)
  const AWAIT_EXPIRE_MS = 5601000;

  async function send() {
    if (!input.trim()) return;
    const userMsg: Message = { id: String(Date.now()), role: "user", text: input };
    setMessages(m => [...m, userMsg]);

    // auto-clear stale awaiting state
    if (awaitingAnswerForId && awaitingSince && Date.now() - awaitingSince > AWAIT_EXPIRE_MS) {
      setAwaitingAnswerForId(null);
      setAwaitingSince(null);
    }

    // If we're awaiting an answer for an existing server item, try to PATCH it first
    if (awaitingAnswerForId) {
      try {
        const text = userMsg.text.trim();
        const low = text.toLowerCase();
  const confirmish = /^(yes|yep|sure|ok|okay|please|sounds good)\b/i;
  const makeHabit = /\b(habit|every\s(day|week|month)|daily|weekly|monthly)\b/i;
  const makePlan = /\b(plan|schedule|calendar|meeting|event)\b/i;
  const makeReflection = /\b(reflect|reflection|note|save as reflection|keep|memory|thought)\b/i;
  const makeLater = /\b(later|someday|not now)\b/i;

        const parsed = parseWhen(text);
        const updateBody: any = {};
        if (parsed?.dueAt) {
          updateBody.entryType = 'Plan';
          updateBody.when = parsed.dueAt.toISOString();
        }
        if (makeHabit.test(low)) {
          updateBody.entryType = 'Habit';
          updateBody.rrule = updateBody.rrule || 'FREQ=DAILY';
        } else if (makePlan.test(low) && !updateBody.entryType) {
          updateBody.entryType = 'Plan';
        } else if (confirmish.test(low) && !updateBody.entryType) {
          updateBody.entryType = 'Action';
        } else if (makeReflection.test(low) && !updateBody.entryType) {
          // user replied with a reflection/note -> convert to Thought (or Later)
          updateBody.entryType = 'Thought';
          updateBody.when = undefined;
          updateBody.rrule = undefined;
        } else if (makeLater.test(low) && !updateBody.entryType) {
          updateBody.entryType = 'Later';
        }

        const hasMeaningfulChange = !!(updateBody.entryType || updateBody.when || updateBody.rrule);
        if (hasMeaningfulChange) {
          const res = await fetch(`/api/items/${awaitingAnswerForId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(userId ? { 'x-user-id': userId } : {}) },
            body: JSON.stringify(updateBody)
          });

          if (res.ok) {
            const json = await res.json();
            const it = json.item || json;
            const parsedWhen = it?.when ? new Date(it.when) : (parsed?.dueAt ?? null);
            const collected: CollectedItem = {
              id: it.id,
              title: it.raw_text || it.title || text.split(/\s+/).slice(0,8).join(' '),
              bucket: it.entry_type || it.bucket || updateBody.entryType || 'Action',
              whenText: it.when ?? updateBody.when ?? undefined,
              dueAt: parsedWhen,
              createdAt: it.created_at ? new Date(it.created_at) : new Date()
            };

            onCollect?.(collected);
            setMessages(m => [...m, { id: String(Date.now() + 1), role: 'assistant', text: `All set — updated as ${collected.bucket}${collected.whenText ? ' with a time' : ''}.` }]);
            setAwaitingAnswerForId(null);
            setAwaitingSince(null);
            setInput('');
            return;
          }
        }
      } catch (err) {
        // if anything goes wrong, fall through to classification
        console.warn('awaiting patch attempt failed', err);
      }
    }

    // Classification / primary flow
    let classification: LibClassification | null = null;
    try {
      const r = await fetch('/api/classify', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(userId ? { 'x-user-id': userId } : {}) }, body: JSON.stringify({ text: userMsg.text }) });
      if (r.ok) {
        classification = await r.json();
        setMessages(m => m.map(msg => msg.id === userMsg.id ? { ...msg, classification } : msg));

        try {
          const c = classification as any;
          const hasWhen = !!(c?.when);

          if (c?.entryType === 'Action' && !hasWhen) {
            try {
              const body = { raw_text: userMsg.text, entryType: 'Action' } as any;
              const createResp = await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(userId ? { 'x-user-id': userId } : {}) }, body: JSON.stringify(body) });
              if (createResp.ok) {
                const createdJson = await createResp.json();
                const it = createdJson.item || createdJson;
                const parsedWhen = it?.when ? new Date(it.when) : (parseWhen(c?.when).dueAt ?? null);
                const collected: CollectedItem = {
                  id: it.id || `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
                  title: c?.title || userMsg.text.split(/\s+/).slice(0,8).join(' '),
                  bucket: it.entry_type || it.bucket || 'Action',
                  whenText: it.when ?? (c?.when ?? undefined),
                  dueAt: parsedWhen,
                  createdAt: it.created_at ? new Date(it.created_at) : new Date()
                };
                onCollect?.(collected);
                if (it && it.id) {
                  setAwaitingAnswerForId(it.id);
                  setAwaitingSince(Date.now());
                }
                setMessages(m => [...m, { id: String(Date.now() + 1), role: 'assistant', text: `Got it — I'll add that as an Action. Want a time or should I just nudge you later?` }]);
                setInput('');
                setLoading(false);
                return;
              }
            } catch (e) {
              // fall back
            }
          }

          if (c?.entryType === 'Plan' && hasWhen) {
            try {
              const body = { raw_text: userMsg.text, entryType: 'Plan', when: c.when } as any;
              const createResp = await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(userId ? { 'x-user-id': userId } : {}) }, body: JSON.stringify(body) });
              if (createResp.ok) {
                const createdJson = await createResp.json();
                const it = createdJson.item || createdJson;
                const collected: CollectedItem = {
                  id: it.id || `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
                  title: c?.title || userMsg.text.split(/\s+/).slice(0,8).join(' '),
                  bucket: it.entry_type || it.bucket || 'Plan',
                  whenText: it.when ?? c?.when,
                  dueAt: it.when ? new Date(it.when) : (parseWhen(c?.when).dueAt ?? null),
                  createdAt: it.created_at ? new Date(it.created_at) : new Date()
                };
                onCollect?.(collected);
                setMessages(m => [...m, { id: String(Date.now() + 1), role: 'assistant', text: `Scheduled — ${parseWhen(c?.when).label || c?.when}.`, classification: c }]);
                setInput('');
                setLoading(false);
                return;
              }
            } catch (e) {
              // ignore
            }
          }

          // fallback collected item
          const words = userMsg.text.trim().split(/\s+/).slice(0,8).join(' ');
          const parsedFallback = parseWhen((classification as any)?.when);
          const item: CollectedItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
            title: words,
            bucket: (classification?.bucket as any) || 'Thought',
            whenText: classification?.when,
            dueAt: parsedFallback.dueAt,
            createdAt: new Date(),
          };
          onCollect?.(item);
          setRecentEntries(r => [{ id: item.id, title: item.title, entryType: item.bucket, when: item.whenText, nouns: ((classification as any)?.title || item.title).split(/\s+/).slice(0,5), lastTouchedAt: new Date().toISOString() }, ...r].slice(0,10));
        } catch (err) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }

    // request assistant text from server
    setInput("");
    setLoading(true);
    setTyping(true);
    setMascotActive(true);
    setTimeout(() => setMascotActive(false), 700);

    try {
      const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(userId ? { 'x-user-id': userId } : {})
        },
        body: JSON.stringify({ message: userMsg.text, classification, clientTz })
      });
      const data = await res.json();
      if (data?.assistant) {
        const assistantMsg: Message = { id: String(Date.now() + 1), role: "assistant", text: data.assistant, classification: data.classification ?? undefined } as any;
        setMessages(m => [...m, assistantMsg]);
        setMascotActive(true);
        setTimeout(() => setMascotActive(false), 700);
        setTyping(false);
        setShowQuickReplies(true);
      } else if (data?.error) {
        const errMsg: Message = { id: String(Date.now() + 2), role: "assistant", text: `Error: ${data.error}` };
        setMessages(m => [...m, errMsg]);
      }
    } catch (err: unknown) {
      const errMsg: Message = { id: String(Date.now() + 3), role: "assistant", text: `Error: ${String(err)}` };
      setMessages(m => [...m, errMsg]);
      setTyping(false);
    } finally {
      setLoading(false);
    }
  }

  // followup resolver
  async function handleFollowupSelect(message: Message, option: { label: string; value: any }) {
    try { telemetry('chat_followup_resolved', { followupId: (message.classification as any)?.followup?.id, chosen: option, text: message.text }); } catch {}
    try {
        const body = { followupId: (message.classification as any)?.followup?.id, option: { label: option.label, value: option.value }, text: message.text, userId } as any;
        // If we're currently awaiting a follow-up for an existing item, PATCH it instead of creating new
        if (awaitingAnswerForId) {
          try {
            const v = option?.value || {};
            const patchBody: any = {};
            if (v.intent || v.entryType || v.subtype) {
              const type = v.entryType || v.intent || v.subtype;
              if (type === 'Plan' || v.subtype === 'plan') patchBody.entryType = 'Plan';
              else if (type === 'Habit' || v.subtype === 'habit') patchBody.entryType = 'Habit';
              else if (type === 'Action' || v.subtype === 'action' || type === 'do') patchBody.entryType = 'Action';
              else patchBody.entryType = 'Thought';
            }
            if (v.when) patchBody.when = v.when;
            if (v.rrule) patchBody.rrule = v.rrule;

            // only attempt patch if we have something to change
            if (Object.keys(patchBody).length > 0) {
              const patchRes = await fetch(`/api/items/${awaitingAnswerForId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(userId ? { 'x-user-id': userId } : {}) },
                body: JSON.stringify(patchBody)
              });

              if (patchRes.ok) {
                const json = await patchRes.json();
                const it = json.item || json;
                const parsed = parseWhen(it?.when || v?.when);
                const collected: CollectedItem = {
                  id: it.id,
                  title: it.raw_text || it.title || message.text.split(/\s+/).slice(0,8).join(' '),
                  bucket: it.entry_type || it.bucket || patchBody.entryType || 'Thought',
                  whenText: it.when ?? v?.when,
                  dueAt: it.when ? new Date(it.when) : (parsed?.dueAt ?? null),
                  createdAt: it.created_at ? new Date(it.created_at) : new Date()
                };
                onCollect?.(collected);
                setMessages(m => [...m, { id: String(Date.now() + 1), role: 'assistant', text: `Saved as ${collected.bucket}${collected.whenText ? ' — scheduled' : ''}.` }]);
                setAwaitingAnswerForId(null);
                setAwaitingSince(null);
                return;
              }
            }
          } catch (e) {
            // fall through to resolver create path
          }
        }
      const r = await fetch('/api/followups/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(userId ? { 'x-user-id': userId } : {}) }, body: JSON.stringify(body) });
      const json = await r.json();
      const applied = json?.result || json?.applied || json;

      // prefer server-returned item/id
      let collected: CollectedItem | null = null;
      if (applied?.item || applied?.id) {
        const it = applied.item || applied;
        const parsed = parseWhen(it?.when ?? applied?.when);
        collected = {
          id: it.id || applied.id,
          title: it.raw_text || it.title || message.text.split(/\s+/).slice(0,8).join(' '),
          bucket: it.entry_type || it.bucket || applied?.entryType || 'Thought',
          whenText: it.when ?? applied?.when,
          dueAt: it.when ? new Date(it.when) : (parsed?.dueAt ?? null),
          createdAt: it.created_at ? new Date(it.created_at) : new Date()
        };
      } else {
        try {
          const entryType = applied?.entryType || applied?.bucket || applied?.intent || 'Thought';
          const createBody: any = { raw_text: message.text, entryType };
          if (applied?.when) createBody.when = applied.when;
          const createResp = await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify(createBody) });
          if (createResp.ok) {
            const createdJson = await createResp.json();
            const it = createdJson.item || createdJson;
            const parsed = parseWhen(it?.when ?? applied?.when);
            collected = {
              id: it.id || `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
              title: applied?.title || it?.raw_text || message.text.split(/\s+/).slice(0,8).join(' '),
              bucket: it.entry_type || it.bucket || entryType,
              whenText: it.when ?? applied?.when,
              dueAt: it.when ? new Date(it.when) : (parsed?.dueAt ?? null),
              createdAt: it.created_at ? new Date(it.created_at) : new Date()
            };
          }
        } catch (e) {
          // fallback
        }
      }

      if (!collected) {
        const parsed = parseWhen(applied?.when);
        collected = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
          title: applied?.title || message.text.split(/\s+/).slice(0,8).join(' '),
          bucket: applied?.entryType || applied?.bucket || applied?.intent || 'Thought',
          whenText: applied?.when,
          dueAt: parsed?.dueAt ?? null,
          createdAt: new Date()
        };
      }

      onCollect?.(collected);
      setMessages(m => m.map(msg => msg.id === message.id ? { ...msg, classification: { ...(msg.classification as any), ...applied, followup: undefined } } : msg));
      setMessages(m => [...m, { id: String(Date.now() + 1), role: 'assistant', text: applied?.assistantText || `Saved as ${collected.bucket}${collected.whenText ? ' — scheduled' : ''}.` }]);
      setShowQuickReplies(true);
    } catch (err) {
      console.error('followup resolve failed', err);
    }
  }

  return (
    <div className="chat-container animate-chatSlideUp" style={{ display: 'flex', maxWidth: 1100, margin: "16px auto", paddingTop: 0, paddingRight: 12, paddingBottom: 12, paddingLeft: 12, gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div className="gremly-header">
          <div className="mb-3">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Unclog Your Mind</h2>
            <p className="mt-1 text-sm md:text-base text-muted-foreground leading-relaxed">Let Gremly organize your thoughts</p>
          </div>
          <div className="gremly-title-glow" />
        </div>

        <div>
          <BrainDumpInput initial={input} onSubmit={(text: string) => { setInput(text); void send(); }} />
        </div>

        <div className="panel-glass messages-scroll relative" style={{ minHeight: 200 }}>
          {messages.length === 0 ? (
            <div style={{ color: "#aaa", position: 'relative', minHeight: 240 }}>
              <div style={{ textAlign: 'center', paddingTop: 36 }}>
                <div style={{ fontWeight: 600 }}>Drop anything here. I’ll sort it.</div>
                <div style={{ color: '#95a3b3', marginTop: 6 }}>Try typing or pasting a thought</div>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#888" }}>{m.role}</div>
                {m.role === 'assistant' ? (
                  <>
                    <AssistantBubble text={m.text} />
                    {showQuickReplies && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="next-step-btn" onClick={() => { setInput('Capture as an Action'); setShowQuickReplies(false); }}>Capture as an Action</button>
                        <button className="next-step-btn" onClick={() => { setInput('Remind me today'); setShowQuickReplies(false); }}>Remind me today</button>
                        <button className="next-step-btn" onClick={() => { setInput('Just chat'); setShowQuickReplies(false); }}>Just chat</button>
                      </div>
                    )}
                    {(m.classification as any)?.followup && (
                      <div style={{ marginTop: 8 }}>
                        <FollowupChips
                          message={(m.classification as any).followup.message}
                          options={(m.classification as any).followup.options}
                          onSelect={(opt) => handleFollowupSelect(m, opt)}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="user-bubble">{m.text}</div>
                )}
                {m.role === 'user' && m.classification && (
                  <ClassificationBadge bucket={(m.classification as any)?.entryType ?? (m.classification as any)?.bucket} />
                )}
              </div>
            ))
          )}
        </div>

        {loading && (
          <div style={{ marginTop: 8 }}><span className="typing-dots"><span></span><span></span><span></span></span></div>
        )}

        {typing && (
          <div style={{ marginTop: 8 }}>
            <div className="assistant-bubble"><span className="typing-dots"><span></span><span></span><span></span></span></div>
          </div>
        )}

      </div>

      <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 9999 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: '#111', color: '#fff', padding: '8px 12px', borderRadius: 6, marginTop: 8 }}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}
