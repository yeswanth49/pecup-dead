import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

type QueryParamPrimitive = string | number | boolean;
type QueryParamValue = QueryParamPrimitive | Array<QueryParamPrimitive>;
type QueryParams = Record<string, QueryParamValue>;

function appendQueryParams(url: URL, params?: QueryParams): void {
  if (!params) return;
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const element of value) {
        if (element === undefined || element === null) continue;
        url.searchParams.append(key, String(element));
      }
    } else {
      url.searchParams.append(key, String(value));
    }
  }
}

async function testAPI(
  endpoint: string,
  params?: QueryParams,
  timeoutMs: number = 10000
) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  appendQueryParams(url, params);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`Testing ${endpoint}...`);
    if (url.search) {
      console.log(`   Query: ${url.searchParams.toString()}`);
    }

    const response = await fetch(url.toString(), { signal: controller.signal });
    const contentType = response.headers.get('content-type') || '';

    let parsedJson: unknown = null;
    let rawText: string | null = null;
    let parseError: unknown = null;

    try {
      if (contentType.toLowerCase().includes('application/json')) {
        parsedJson = await response.json();
      } else {
        rawText = await response.text();
      }
    } catch (err) {
      parseError = err;
    }

    const statusInfo = `${response.status} ${response.statusText}`.trim();
    const bodyPreview = (() => {
      try {
        const bodyString = rawText ?? JSON.stringify(parsedJson);
        return bodyString ? `${bodyString.substring(0, 200)}${bodyString.length > 200 ? '...' : ''}` : '(no body)';
      } catch {
        return '(unserializable body)';
      }
    })();

    if (response.ok) {
      console.log(`✅ ${endpoint} - SUCCESS`);
      console.log(`   Status: ${statusInfo}`);
      console.log(`   Content-Type: ${contentType || '(none)'}`);
      console.log(`   Body: ${bodyPreview}`);
    } else {
      console.log(`❌ ${endpoint} - ERROR`);
      console.log(`   Status: ${statusInfo}`);
      console.log(`   Content-Type: ${contentType || '(none)'}`);
      console.log(`   Error body: ${bodyPreview}`);
    }

    if (parseError) {
      const message = parseError instanceof Error ? parseError.message : String(parseError);
      console.log(`   ⚠️ Body parse error: ${message}`);
    }
  } catch (error) {
    const isAbort = (error as any)?.name === 'AbortError';
    console.log(`❌ ${endpoint} - FETCH ERROR`);
    if (isAbort) {
      console.log(`   Error: Request timed out after ${timeoutMs} ms`);
    } else {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`   Error: ${message}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  console.log('');
}

async function runTests() {
  console.log('🧪 Testing Supabase-migrated API endpoints...\n');
  
  // Test resources API
  await testAPI('/api/resources', {
    category: 'notes',
    subject: 'math',
    unit: '1'
  });
  
  // Test reminders API
  await testAPI('/api/reminders');
  
  // Test recent updates API
  await testAPI('/api/recent-updates');
  
  // Test prime section data API
  await testAPI('/api/prime-section-data');
  
  console.log('🏁 API tests completed!');
}

runTests().catch(console.error); 