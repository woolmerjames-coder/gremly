import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function formatError(e: unknown) {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (typeof e === 'object' && 'message' in e) return (e as { message?: string }).message;
  return String(e);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { raw_text, bucket, conversationId } = body as Record<string, unknown>;
    if (!raw_text) return NextResponse.json({ error: 'raw_text required' }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey)
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // try to get user id from Authorization header
    let userId: string | null = null;
    try {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace(/^Bearer\s+/, '');
        const { data } = await supabase.auth.getUser(token);
        userId = data?.user?.id || null;
      }
    } catch {
      // ignore
    }

    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: item, error } = await supabase
      .from('items')
      .insert({ user_id: userId, raw_text: String(raw_text), bucket: (bucket as string) || 'Note', source_conversation: conversationId })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message || error }, { status: 500 });
    return NextResponse.json({ ok: true, item });
    } catch (e: unknown) {
    return NextResponse.json({ error: formatError(e) }, { status: 500 });
  }
}
