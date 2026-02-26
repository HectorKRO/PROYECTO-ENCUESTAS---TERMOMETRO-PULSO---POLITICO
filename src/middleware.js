import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  const response = NextResponse.next();

  // En modo demo, permitir todo
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return response;
  }

  // Si la URL tiene ?demo, permitir
  if (request.nextUrl.searchParams.has('demo')) {
    return response;
  }

  // ✅ FIX: Validación de variables de entorno
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Middleware] Missing Supabase environment variables');
    // En desarrollo, permitir pasar para mostrar error más amigable
    if (process.env.NODE_ENV === 'development') {
      return response;
    }
    return NextResponse.redirect(new URL('/offline', request.url));
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data: { session }, error } = await supabase.auth.getSession();
    
    // ✅ FIX: Manejo de errores de Supabase
    if (error) {
      console.error('[Middleware] Supabase error:', error.message);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'session_error');
      return NextResponse.redirect(loginUrl);
    }

    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  } catch (err) {
    // ✅ FIX: Manejo de errores inesperados
    console.error('[Middleware] Unexpected error:', err);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'unknown');
    return NextResponse.redirect(loginUrl);
  }
}

// ✅ FIX: /encuesta es público (no requiere auth). Solo dashboard y admin están protegidos.
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
