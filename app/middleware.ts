import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Definir as rotas que precisam de proteção rigorosa (adicione outras se precisar)
  const rotasProtegidas = ['/perfil', '/admin', '/super-admin', '/staff', '/minhas-inscricoes'];
  const isRotaProtegida = rotasProtegidas.some(rota => path.startsWith(rota));

  // 2. Definir as rotas públicas (onde quem já tem sessão iniciada não deve voltar a entrar)
  const rotasPublicas = ['/login', '/login-organizador', '/cadastro', '/recuperar-senha'];
  const isRotaPublica = rotasPublicas.includes(path);

  // 3. Verificar se o utilizador tem o "passe livre" (cookie de autenticação do Supabase)
  // O Supabase guarda o token num cookie que geralmente contém '-auth-token' no nome
  const temSessao = request.cookies.getAll().some(cookie => cookie.name.includes('-auth-token'));

  // REGRA A: Sem sessão e a tentar entrar numa área restrita -> Vai para o Login
  if (isRotaProtegida && !temSessao) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // REGRA B: Com sessão e a tentar aceder ao ecrã de Login/Registo -> Vai para o Perfil
  if (isRotaPublica && temSessao) {
    return NextResponse.redirect(new URL('/perfil', request.url));
  }

  // Se não cair em nenhuma regra, deixa passar normalmente
  return NextResponse.next();
}

// 4. Configurar onde o segurança DEVE e NÃO DEVE atuar
// Ignora os ficheiros de sistema (imagens, css, logos, rotas de API invisíveis, etc.)
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};