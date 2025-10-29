import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  console.log('[Hero API] Called')
  const fallbackTexts = [
    "for any errors, report them in Whatsapp Group"
  ]

  try {
    const supabase = getSupabaseAdmin()

    // Fetch active hero texts ordered by priority
    console.log('[Hero API] Querying hero_texts')
    // Filter out expired texts (time_limit is null or in the future)
    const { data: texts, error } = await supabase
      .from('hero_texts')
      .select('text, priority, time_limit')
      .or('time_limit.is.null,time_limit.gt.' + new Date().toISOString())
      .order('priority', { ascending: true })

    console.log('[Hero API] Raw texts data:', texts)
    console.log('[Hero API] Error fetching:', error)

    if (error) {
      console.error('Error fetching hero texts:', error)
      // Return fallback texts (table might not exist yet)
      return NextResponse.json(fallbackTexts)
    }

    // Extract just the text values for the component, or fallback if empty
    const heroTexts = texts?.map(item => item.text) || fallbackTexts
    console.log('[Hero API] Returning heroTexts:', heroTexts)
    console.log('[Hero API] Unexpected error, returning fallback:', fallbackTexts)

    return NextResponse.json(heroTexts)
  } catch (error) {
    console.error('Unexpected error:', error)
    // Return fallback texts on any error
    return NextResponse.json(fallbackTexts)
  }
}