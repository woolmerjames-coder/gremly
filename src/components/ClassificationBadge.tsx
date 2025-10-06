"use client";

import React from "react";
import type { ClassifierResult } from "../lib/classify";

export default function ClassificationBadge({ c }: { c: ClassifierResult }) {
  const { bucket, confidence, explain } = c;
  const pct = Math.round((confidence ?? 0) * 100);
  const color = bucket === 'Task' ? '#0b74de' : bucket === 'Calendar Event' ? '#ff8a00' : bucket === 'Habit' ? '#00a86b' : bucket === 'Goal/Project' ? '#7b61ff' : '#6b6b6b';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
      <div style={{ padding: '6px 10px', background: color, color: '#fff', borderRadius: 999, fontWeight: 600, fontSize: 12 }}>{bucket}</div>
      <div style={{ flex: 1 }}>
        <div style={{ height: 8, background: '#eee', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color }} />
        </div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>{explain}</div>
      </div>
      <div style={{ fontSize: 12, color: '#555', minWidth: 46, textAlign: 'right' }}>{pct}%</div>
    </div>
  );
}
