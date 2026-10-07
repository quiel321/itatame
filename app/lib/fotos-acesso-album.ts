import { timingSafeEqual } from "crypto";

export type AcessoAlbum = {
  acesso_por_link?: boolean | null;
  acesso_token?: string | null;
  status?: string | null;
};

export function acessoAlbumPermitido(album: AcessoAlbum | null | undefined, token: string | null | undefined) {
  if (!album || album.status !== "publicado") return false;
  if (!album.acesso_por_link) return true;
  if (!token || !album.acesso_token) return false;
  const recebido = Buffer.from(token.toLowerCase(), "utf8");
  const esperado = Buffer.from(album.acesso_token.toLowerCase(), "utf8");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
