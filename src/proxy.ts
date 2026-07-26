import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import { createRequestId, REQUEST_ID_HEADER, structuredLog } from '@/lib/observability'

export async function proxy(request: NextRequest) {
  const requestId = createRequestId()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  const responseForRequest = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  }
  let supabaseResponse = responseForRequest()
  const { pathname } = request.nextUrl

  structuredLog("info", "http.request.received", {
    requestId,
    route: pathname,
    method: request.method,
  })

  // API kimlik doğrulaması route içinde yapılır. Burada yalnız korelasyon
  // kimliği eklenir; webhook ve health çağrıları oturum yenilemeye zorlanmaz.
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = responseForRequest()
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired — required for Server Components
  const { data: { user } } = await supabase.auth.getUser()

  // If not logged in and trying to access a protected route → redirect to login
  const protectedPaths = ['/dashboard', '/customers', '/appointments', '/countries', '/reports', '/settings', '/staff']
  const isProtected = protectedPaths.some(path => pathname.startsWith(path))

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/'
    const response = NextResponse.redirect(loginUrl)
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  }

  // If already logged in and trying to access login page → redirect to dashboard
  if (user && pathname === '/') {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    const response = NextResponse.redirect(dashboardUrl)
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static
     * - _next/image
     * - favicon.ico
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
