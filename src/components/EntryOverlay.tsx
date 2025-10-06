"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nanoid } from 'nanoid';
import type { EntryPayload } from '@/types/entries';

type Mode = 'create' | 'edit';

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string | null;
  mode?: Mode;
  initialValue?: Partial<EntryPayload> | null;
  onSubmit: (payload: EntryPayload) => Promise<void> | void;
};

export default function EntryOverlay({ isOpen, onOpenChange, mode = 'create', initialValue = null, onSubmit }: Props) {
  const isClient = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (!isClient) return null;
  const [title, setTitle] = useState(initialValue?.title ?? '');
  const [whenText, setWhenText] = useState(initialValue?.when ?? '');
  const [type, setType] = useState<EntryPayload['type']>((initialValue?.type as EntryPayload['type']) ?? 'Action');
  const [priority, setPriority] = useState<EntryPayload['priority']>(initialValue?.priority ?? null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialValue?.title ?? '');
      setWhenText(initialValue?.when ?? '');
      setType((initialValue?.type as EntryPayload['type']) ?? 'Action');
      setPriority(initialValue?.priority ?? null);
    }
  }, [initialValue, isOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        onOpenChange(!isOpen);
        return;
      }
      if (meta && e.key === 'Enter') {
        e.preventDefault();
        void handleSubmit();
        return;
      }
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, title, whenText, type, priority, onOpenChange]);

  if (!isOpen) return null;

  async function handleSubmit() {
    const payload: EntryPayload = {
      id: (initialValue as any)?.id ?? nanoid(),
      title: title.trim() || 'Untitled',
      when: whenText || undefined,
      type,
      priority: priority ?? null,
      raw: initialValue?.raw ?? undefined,
    } as EntryPayload;

    try {
      await Promise.resolve(onSubmit(payload));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('EntryOverlay submit error', err);
    }

    onOpenChange(false);
  }

  const overlay = (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-4" ref={containerRef}>
      <div className="w-full max-w-xl rounded bg-white dark:bg-neutral-900 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">{mode === 'create' ? 'Add entry' : 'Edit entry'}</h3>
          <div className="flex gap-2">
            <button className="text-sm text-neutral-600 hover:underline" onClick={() => onOpenChange(false)}>Cancel</button>
            <button className="rounded bg-sky-600 px-3 py-1 text-white" onClick={() => void handleSubmit()}>Save</button>
          </div>
        </div>

        <div className="space-y-3">
          <input
            className="w-full rounded border px-3 py-2 bg-white dark:bg-neutral-800"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            aria-label="Entry title"
          />

          <input
            className="w-full rounded border px-3 py-2 bg-white dark:bg-neutral-800"
            value={whenText ?? ''}
            onChange={(e) => setWhenText(e.target.value)}
            placeholder="When (natural language ok)"
            aria-label="When"
          />

          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EntryPayload['type'])}
              className="rounded border px-2 py-1 bg-white dark:bg-neutral-800"
              aria-label="Type"
            >
              <option value="Action">Action</option>
              <option value="Plan">Plan</option>
              <option value="Habit">Habit</option>
              <option value="Thought">Thought</option>
              <option value="Later">Later</option>
            </select>

            <select
              value={priority ?? ''}
              onChange={(e) => setPriority(e.target.value ? (e.target.value as EntryPayload['priority']) : null)}
              className="rounded border px-2 py-1 bg-white dark:bg-neutral-800"
              aria-label="Priority"
            >
              <option value="">Priority</option>
              <option value="low">Low</option>
              <option value="med">Med</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
