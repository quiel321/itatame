create index if not exists idx_foto_arquivos_tags
  on public.foto_arquivos
  using gin (tags);

comment on index public.idx_foto_arquivos_tags is
  'Acelera a busca por tags internas, incluindo números detectados nas miniaturas pela IA.';
