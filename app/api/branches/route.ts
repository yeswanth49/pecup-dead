// Branches API Route
// Manages academic branches/departments

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createSupabaseAdmin } from '@/lib/supabase';
import { Branch } from '@/lib/types';

const supabaseAdmin = createSupabaseAdmin();

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('branches')
      .select('*')
      .order('code');

    if (error) {
      console.error('Branches fetch error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ branches: data || [] });
  } catch (error) {
    console.error('Branches API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Require admin access to create branches
    await requireAdmin('admin');
    
    const body = await request.json();
    const { name, code } = body;

    if (!name || !code) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, code' 
      }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('branches')
      .insert({ name, code })
      .select('*')
      .single();

    if (error) {
      console.error('Branch creation error:', error);
      
      // Handle uniqueness violations
      const isUniqueViolation = (error as any)?.code === '23505';
      const message = isUniqueViolation ? 'Branch code already exists' : 'Database error';
      
      return NextResponse.json({ 
        error: message,
        details: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ branch: data }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Branches API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
