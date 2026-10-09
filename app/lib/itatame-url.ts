/** Endereço direto do iTatame: notificações de pagamento não devem depender de redirects. */
export function obterBaseUrlItatame(request: Request) {
  const url = new URL(process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin);
  if (url.hostname.toLowerCase() === "www.itatame.com.br") {
    url.hostname = "itatame.com.br";
  }
  return url.origin;
}
