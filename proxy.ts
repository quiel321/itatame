import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // As sessões principais do Supabase vivem no armazenamento do navegador.
  // Aqui fazemos apenas a barreira otimista do fluxo de staff, que usa cookie próprio após validar o PIN.
  const rotasProtegidas = ['/staff'];
  const isRotaProtegida = rotasProtegidas.some((rota) => path.startsWith(rota)) && path !== '/staff/login';

  const temAcessoStaff = path.startsWith('/staff') && request.cookies.get('itatame_staff_access')?.value === '1';

  if (isRotaProtegida && !temAcessoStaff) {
    return NextResponse.redirect(new URL('/staff/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
