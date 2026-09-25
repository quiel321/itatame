-- Execute uma vez no SQL Editor do projeto antes de publicar o upload da tabela de peso.
alter table public.eventos
  add column if not exists tabela_peso_pdf_url text;
