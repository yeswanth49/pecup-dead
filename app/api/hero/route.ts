import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const fallbackTexts = [
    "for any errors, report them in Whatsapp Group"
  ]

  try {
    const supabase = getSupabaseAdmin()

    // Fetch active hero texts ordered by priority
    // Filter out expired texts (time_limit is null or in the future)
    const { data: texts, error } = await supabase
      .from('hero_texts')
      .select('text, priority, time_limit')
      .or('time_limit.is.null,time_limit.gt.' + new Date().toISOString())
      .order('priority', { ascending: true })

    if (error) {
      console.error('Error fetching hero texts:', error)
      // Return fallback texts (table might not exist yet)
      return NextResponse.json(fallbackTexts)
    }

    // Extract just the text values for the component, or fallback if empty
    const heroTexts = texts?.map(item => item.text) || fallbackTexts

    return NextResponse.json(heroTexts)
  } catch (error) {
    console.error('Unexpected error:', error)
    // Return fallback texts on any error
    return NextResponse.json(fallbackTexts)
  }
}