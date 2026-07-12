"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import FotosShell from "../../_components/FotosShell";
import { ArrowRight, Camera, CheckCircle2, CloudUpload, CreditCard, FolderOpen, ImagePlus, ShieldCheck, Wallet, LogOut, AlertCircle, Store } from "lucide-react";

type FotografoPerfil = { id: string; nome: string | null; email: string | null; telefone?: string | null; documento?: string | null; cep?: string | null; endereco?: string | null; cidade?: string | null; estado?: string | null; bio?: string | null; perfil_completo?: boolean | null; status: string | null; mp_connected_at?: string | null; mp_user_id?: string | null; };
type Totais = { fotos: number; albuns: number; eventos: number; vendas: number };
type PerfilForm = { nome: string; telefone: string; documento: string; cep: string; endereco: string; cidade: string; estado: string; bio: string; };

function perfilParaForm(perfil: FotografoPerfil | null, email: string | null): PerfilForm {
  return { nome: perfil?.nome || email?.split("@")[0] || "", telefone: perfil?.telefone || "", documento: perfil?.documento || "", cep: perfil?.cep || "", endereco: perfil?.endereco || "", cidade: perfil?.cidade || "", estado: perfil?.estado || "", bio: perfil?.bio || "", };
}

export default function FotografoDashboardPage() {
  const router = useRouter();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<FotografoPerfil | null>(null);
  const [totais, setTotais] = useState<Totais>({ fotos: 0, albuns: 0, eventos: 0, vendas: 0 });
  const [carregando, setCarregando] = useState(true);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [mostrarFormularioPerfil, setMostrarFormularioPerfil] = useState(false);
  const [perfilForm, setPerfilForm] = useState<PerfilForm>(() => perfilParaForm(null, null));

  const nomeExibicao = useMemo(() => perfil?.nome || email?.split("@")[0] || "Fotógrafo", [perfil?.nome, email]);
  const mercadoPagoConectado = useMemo(() => Boolean(perfil?.mp_connected_at), [perfil?.mp_connected_at]);
  const perfilPendente = useMemo(() => Boolean(userId && (!perfil?.perfil_completo || !perfil?.telefone || !perfil?.documento)), [userId, perfil]);
  const exibirFormularioPerfil = useMemo(() => Boolean(userId && (perfilPendente || mostrarFormularioPerfil)), [userId, perfilPendente, mostrarFormularioPerfil]);
  const mpConnectUrl = useMemo(() => userId ? `/api/mercado-pago/connect?perfil=fotografo&user_id=${encodeURIComponent(userId)}&return_to=${encodeURIComponent("/fotos/fotografo/dashboard")}` : "/fotos/login?perfil=fotografo&next=/fotos/fotografo/dashboard", [userId]);
  const primeiroNome = useMemo(() => nomeExibicao.split(' ')[0], [nomeExibicao]);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      if (!user) {
        router.replace("/fotos/login?perfil=fotografo&next=/fotos/fotografo/dashboard");
        return;
      }

      const { data: isOrg } = await supabase.from("organizadores").select("user_id").eq("user_id", user.id).maybeSingle();
      if (isOrg) {
        router.replace("/fotos/admin");
        return;
      }

      setUserId(user.id);
      setEmail(user.email || null);

      let perfilAtual: FotografoPerfil | null = null;
      const tentativaCompleta = await supabase.from("fotografos").select("id, nome, email, telefone, documento, cep, endereco, cidade, estado, bio, perfil_completo, status, mp_connected_at, mp_user_id").eq("user_id", user.id).maybeSingle();

      if (tentativaCompleta.data) {
        perfilAtual = tentativaCompleta.data as FotografoPerfil;
      } else {
        const tentativaBasica = await supabase.from("fotografos").select("id, nome, email, telefone, documento, bio, status").eq("user_id", user.id).maybeSingle();
        perfilAtual = (tentativaBasica.data as FotografoPerfil | null) || null;
      }

      if (!perfilAtual) {
        router.replace("/fotos/login?perfil=fotografo");
        return;
      }

      setPerfil(perfilAtual);
      setPerfilForm(perfilParaForm(perfilAtual, user.email || null));

      // 🔥 BUSCANDO AS VENDAS REAIS!
      if (perfilAtual?.id) {
        const [fotos, albuns, vendas] = await Promise.all([
          supabase.from("foto_arquivos").select("id", { count: "exact", head: true }).eq("fotografo_id", perfilAtual.id),
          supabase.from("foto_albuns").select("id", { count: "exact", head: true }).eq("fotografo_id", perfilAtual.id),
          supabase.from("foto_pedidos").select("id", { count: "exact", head: true }).eq("fotografo_id", perfilAtual.id).eq("status", "pago"),
        ]);
        setTotais((atual) => ({ ...atual, fotos: fotos.count || 0, albuns: albuns.count || 0, vendas: vendas.count || 0 }));
      }

      const eventos = perfilAtual?.id ? await supabase.from("foto_evento_fotografos").select("id", { count: "exact", head: true }).eq("fotografo_id", perfilAtual.id).eq("status", "ativo") : { count: 0 };
      setTotais((atual) => ({ ...atual, eventos: eventos.count || 0 }));
      setCarregando(false);
    }
    void carregar();
  }, [router]);

  async function deslogar() {
    await supabase.auth.signOut();
    router.push("/fotos/login?perfil=fotografo");
  }

  async function salvarPerfilFotografo() {
    if (!perfil?.id) return;
    setSalvandoPerfil(true);
    const payloadCompleto = { nome: perfilForm.nome.trim(), telefone: perfilForm.telefone.trim(), documento: perfilForm.documento.trim(), cep: perfilForm.cep.trim(), endereco: perfilForm.endereco.trim(), cidade: perfilForm.cidade.trim(), estado: perfilForm.estado.trim().toUpperCase(), bio: perfilForm.bio.trim(), perfil_completo: true, status: "ativo" };

    let resultado = await supabase.from("fotografos").update(payloadCompleto).eq("id", perfil.id).select("*").single();

    if (resultado.error) {
      resultado = await supabase.from("fotografos").update({ nome: payloadCompleto.nome, telefone: payloadCompleto.telefone, documento: payloadCompleto.documento, bio: payloadCompleto.bio, status: "ativo" }).eq("id", perfil.id).select("*").single();
    }

    setSalvandoPerfil(false);
    if (!resultado.error) {
      setPerfil({ ...(perfil || {}), ...payloadCompleto, ...(resultado.data ? (resultado.data as FotografoPerfil) : {}) });
      setMostrarFormularioPerfil(false);
    }
  }

  async function desvincularMercadoPago() {
    if (!perfil?.id) return;
    if (!confirm("Tem certeza que deseja desvincular sua conta do Mercado Pago?")) return;
    const { error } = await supabase.from("fotografos").update({ mp_access_token: null, mp_refresh_token: null, mp_public_key: null, mp_user_id: null, mp_connected_at: null, mp_token_expires_at: null }).eq("id", perfil.id);
    if (!error) { setPerfil({ ...perfil, mp_connected_at: null, mp_user_id: null }); alert("Conta desvinculada com sucesso."); }
  }

  if (carregando) return <FotosShell><main className="min-h-screen bg-[#050505] flex items-center justify-center"><Camera size={32} className="text-cyan-500 animate-pulse"/></main></FotosShell>;

  return (
    <FotosShell>
      <main className="min-h-screen bg-[#050505] text-white font-sans">
        <section className="border-b border-white/5 bg-[radial-gradient(circle_at_85%_0%,rgba(6,182,212,0.18),transparent_32%),linear-gradient(180deg,#101014,#050505)]">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-10">
              <div>
                <p className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.24em] text-cyan-400 mb-4 shadow-[0_0_15px_rgba(6,182,212,0.1)]"><Camera size={12} /> Dashboard do Fotógrafo</p>
                <h1 className="text-3xl font-black uppercase tracking-tight leading-none md:text-5xl drop-shadow-md">Olá, {primeiroNome}!</h1>
                <p className="mt-3 max-w-xl text-xs md:text-sm leading-relaxed text-zinc-400 font-medium">Acompanhe suas galerias, conecte sua conta de recebimento e envie fotos oficiais para os eventos liberados.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/fotos/fotografo/painel" className="cursor-pointer inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 text-[10px] font-black uppercase tracking-widest text-black hover:bg-cyan-400 transition-colors shadow-sm">Upload de Fotos <CloudUpload size={14} /></Link>
                {userId && <button onClick={deslogar} className="cursor-pointer inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-6 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm">Sair <LogOut size={14} /></button>}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 🔥 AGORA COM totais.vendas INSERIDO! */}
              {[[ImagePlus, "Fotos Publicadas", totais.fotos, "text-cyan-400"], [FolderOpen, "Álbuns Criados", totais.albuns, "text-white"], [Store, "Eventos Abertos", totais.eventos, "text-amber-400"], [Wallet, "Vendas", totais.vendas, "text-emerald-400"]].map(([Icon, label, valor, cor], index) => {
                const IconComponent = Icon as typeof Camera;
                return (
                  <div key={index} className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0e]/80 backdrop-blur-md p-5 shadow-lg group hover:border-white/10 transition-colors">
                    <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2 relative z-10"><IconComponent size={14} /> {label as string}</p>
                    <p className={`text-3xl md:text-4xl font-black relative z-10 drop-shadow-md ${cor as string}`}>{carregando ? "..." : valor as number}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[1fr_0.8fr] md:px-8">
          <div className="space-y-6">
            {!userId ? null : (
              <>
                {(!exibirFormularioPerfil && !perfilPendente) ? (
                   <div className="bg-[#0a0a0e] rounded-3xl p-5 border border-white/5 shadow-xl flex items-center justify-between">
                      <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500"><CheckCircle2 size={20} /></div><div><p className="text-sm font-black text-white uppercase tracking-tight">Cadastro Concluído</p><p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Apto a faturar</p></div></div>
                      <button onClick={() => setMostrarFormularioPerfil(true)} className="cursor-pointer px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors border border-white/10">Editar Perfil</button>
                   </div>
                ) : (
                   <div className="rounded-3xl border border-cyan-500/30 bg-cyan-500/5 shadow-[0_0_30px_rgba(6,182,212,0.05)] p-6 md:p-8">
                     <div className="flex items-start justify-between mb-6"><div><h2 className="text-base font-black uppercase tracking-tight text-white md:text-lg">Dados do Fotógrafo</h2><p className="text-[10px] font-bold text-cyan-500/80 uppercase tracking-widest mt-1">{perfilPendente ? "Necessário para repasses" : "Atualizar Informações"}</p></div>{!perfilPendente && (<button onClick={() => setMostrarFormularioPerfil(false)} className="cursor-pointer inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-white/5 px-3 text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors">Cancelar</button>)}</div>

                     <div className="space-y-4">
                       {perfilPendente && (<div className="flex items-start gap-3 bg-black/40 p-4 rounded-xl border border-cyan-500/20 mb-4"><AlertCircle size={16} className="text-cyan-500 shrink-0 mt-0.5" /><p className="text-[10px] font-bold text-cyan-100 leading-relaxed uppercase tracking-wider">Preencha os campos abaixo para que as suas fotos possam ser exibidas nas galerias oficiais.</p></div>)}

                       <div className="grid gap-3 sm:grid-cols-2">
                         <div className="sm:col-span-2"><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Nome Completo</label><input value={perfilForm.nome} onChange={(e) => setPerfilForm({ ...perfilForm, nome: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="Seu nome" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">WhatsApp</label><input value={perfilForm.telefone} onChange={(e) => setPerfilForm({ ...perfilForm, telefone: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="(00) 00000-0000" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">CPF</label><input value={perfilForm.documento} onChange={(e) => setPerfilForm({ ...perfilForm, documento: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="000.000.000-00" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">CEP</label><input value={perfilForm.cep} onChange={(e) => setPerfilForm({ ...perfilForm, cep: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="00000-000" /></div>
                         <div className="sm:col-span-2"><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Endereço Completo</label><input value={perfilForm.endereco} onChange={(e) => setPerfilForm({ ...perfilForm, endereco: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="Rua, Número, Bairro" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Cidade</label><input value={perfilForm.cidade} onChange={(e) => setPerfilForm({ ...perfilForm, cidade: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="Sua cidade" /></div>
                         <div><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Estado (UF)</label><input value={perfilForm.estado} onChange={(e) => setPerfilForm({ ...perfilForm, estado: e.target.value })} className="cursor-text h-11 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="Ex: SP" maxLength={2} /></div>
                         <div className="sm:col-span-2"><label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-zinc-500">Bio (Equipamento / Foco)</label><textarea value={perfilForm.bio} onChange={(e) => setPerfilForm({ ...perfilForm, bio: e.target.value })} className="cursor-text min-h-20 w-full rounded-xl border border-white/10 bg-[#050505] p-3 text-xs font-bold text-white outline-none focus:border-cyan-500" placeholder="Ex: Especialista em desporto. Utilizo Sony A7IV com lente 70-200mm." /></div>
                       </div>
                       <div className="mt-6"><button type="button" onClick={salvarPerfilFotografo} disabled={salvandoPerfil || !perfilForm.nome.trim() || !perfilForm.telefone.trim() || !perfilForm.documento.trim()} className="cursor-pointer h-12 w-full items-center justify-center rounded-xl bg-cyan-500 text-[11px] font-black uppercase tracking-widest text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)]">{salvandoPerfil ? "A Processar..." : "Salvar Perfil Seguro"}</button></div>
                     </div>
                   </div>
                )}

                <div className="rounded-3xl border border-white/5 bg-[#0a0a0e] p-6 md:p-8 shadow-xl">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6"><div><h2 className="text-lg font-black uppercase tracking-tight text-white">Upload Inteligente</h2><p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">As suas fotos prontas em segundos</p></div><Link href="/fotos/fotografo/painel" className="cursor-pointer inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 px-5 text-[9px] font-black uppercase tracking-widest text-cyan-400 hover:bg-cyan-500 hover:text-black transition-colors shrink-0">Abrir Área de Upload <CloudUpload size={14} /></Link></div>
                  <div className="grid gap-3 sm:grid-cols-3">{[[FolderOpen, "1. Escolha o Evento", "Use as galerias já validadas pelo organizador da competição."], [CloudUpload, "2. Upload em Lote", "Arraste as fotos originais. Nós otimizamos o tamanho por si."], [ShieldCheck, "3. Venda Segura", "Aplicamos a marca de água no site e guardamos o ficheiro original em HD."]].map(([Icon, titulo, texto]) => { const IconComponent = Icon as typeof Camera; return (<div key={String(titulo)} className="rounded-2xl border border-white/5 bg-[#050505] p-5 hover:border-white/10 transition-colors"><IconComponent size={20} className="text-cyan-500 mb-3" /><p className="text-[10px] font-black uppercase tracking-widest text-white leading-tight mb-2">{titulo as string}</p><p className="text-[9px] font-medium text-zinc-500 leading-relaxed">{texto as string}</p></div>); })}</div>
                </div>
              </>
            )}
          </div>

          <div className="space-y-6">
            {userId && (
               <div className="rounded-3xl border border-white/5 bg-[#0a0a0e] p-6 md:p-8 shadow-xl">
                 <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4"><CreditCard size={20} className="text-amber-500" /><h2 className="text-lg font-black uppercase tracking-tight text-white">Recebimentos</h2></div>
                 <div className="space-y-4">
                   <div className={`rounded-2xl border p-5 ${mercadoPagoConectado ? "bg-emerald-500/5 border-emerald-500/20" : "bg-[#050505] border-white/5"}`}>
                     <div className="flex items-center justify-between mb-3"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Gateway de Pagamento</p><img src="https://logospng.org/download/mercado-pago/logo-mercado-pago-icone-1024.png" alt="MP" className="h-5 opacity-80" /></div>
                     <h3 className="text-base font-black text-white mb-1">Mercado Pago</h3>
                     <p className={`text-[10px] font-black uppercase tracking-widest ${mercadoPagoConectado ? "text-emerald-400" : "text-amber-500"}`}>{mercadoPagoConectado ? "● Conta Ativa (Split Direto)" : "● Requer Conexão Urgente"}</p>
                     <p className="text-[9px] font-medium text-zinc-500 mt-4 leading-relaxed">Conecte a sua carteira para receber automaticamente a sua % de cada foto vendida. O iTatame faz o Split (divisão) na hora.</p>
                     {mercadoPagoConectado ? (
                       <button onClick={desvincularMercadoPago} className="cursor-pointer mt-5 flex w-full h-11 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-colors">Desvincular Conta MP <LogOut size={14} /></button>
                     ) : (
                       <a href={mpConnectUrl} className="cursor-pointer mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 text-[9px] font-black uppercase tracking-widest text-black hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]">Ligar Carteira Digital <ArrowRight size={14} /></a>
                     )}
                   </div>
                   <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-6 pt-4 border-t border-white/5"><ShieldCheck size={14} /> Pix Automático e Seguro</div>
                 </div>
               </div>
            )}
          </div>
        </section>
      </main>
    </FotosShell>
  );
}