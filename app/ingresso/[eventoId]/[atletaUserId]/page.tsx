"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import QRCode from "react-qr-code";
import Link from "next/link";

export default function IngressoDigitalPage() {
  const params = useParams();
  const router = useRouter();
  const eventoId = params.eventoId as string;
  const atletaUserId = params.atletaUserId as string;

  const [loading, setLoading] = useState(true);
  const [evento, setEvento] = useState<any>(null);
  const [atleta, setAtleta] = useState<any>(null);
  const [inscricao, setInscricao] = useState<any>(null); // Agora tratamos como uma inscrição única
  const [qrValue, setQrValue] = useState("");

  useEffect(() => {
    async function carregarIngresso() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push("/login");
        return;
      }

      // 1. Busca o Evento
      const { data: evData } = await supabase.from("eventos").select("nome, data_evento, banner_url, local, cidade, estado").eq("id", eventoId).single();
      if (evData) setEvento(evData);

      // 2. Busca o Atleta
      const { data: atlData } = await supabase.from("atletas").select("*").eq("user_id", atletaUserId).single();
      if (atlData) setAtleta(atlData);

      // 3. Busca a ÚNICA inscrição do atleta no evento
      const { data: inscData } = await supabase.from("inscricoes")
        .select("*")
        .eq("evento_id", eventoId)
        .eq("user_id", atletaUserId)
        .eq("pagamento_ok", true)
        .maybeSingle(); // 🟢 Usamos maybeSingle pois agora é uma linha só
      
      if (inscData) {
        setInscricao(inscData);
        setQrValue(`ITATAME|${eventoId}|${atletaUserId}`);
      }

      setLoading(false);
    }
    carregarIngresso();
  }, [eventoId, atletaUserId, router]);

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-zinc-500 font-bold text-xs uppercase tracking-widest">Gerando Passaporte...</div>;

  if (!inscricao) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-black text-white mb-2">Nenhum ingresso encontrado</h2>
        <p className="text-zinc-500 text-sm mb-6">Sua inscrição não foi localizada ou o pagamento ainda está pendente.</p>
        <Link href="/pagamento" className="bg-red-600 text-white font-bold px-6 py-3 rounded-xl">Voltar para Pagamentos</Link>
      </div>
    );
  }

  const formatarData = (dataStr: string) => {
    if (!dataStr) return "";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <main className="min-h-screen bg-[#050505] p-4 md:p-8 flex items-center justify-center font-sans relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => router.back()} className="cursor-pointer text-zinc-400 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
            Voltar
          </button>
          <span className="bg-green-500/10 border border-green-500/30 text-green-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Atleta Confirmado</span>
        </div>

        <div className="bg-[#0e0e12] border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="h-32 relative bg-zinc-900 border-b border-white/10">
            {evento?.banner_url ? <img src={evento.banner_url} className="w-full h-full object-cover opacity-60" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600">🥋</div>}
            <div className="absolute bottom-4 left-4 right-4">
              <h2 className="text-white font-black text-xl truncate">{evento?.nome}</h2>
              <p className="text-red-400 text-xs font-bold uppercase tracking-widest">{formatarData(evento?.data_evento)} • {evento?.cidade}</p>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-white/10 shrink-0 overflow-hidden">
                {atleta?.foto_url ? <img src={atleta.foto_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold text-xl">{atleta?.nome?.charAt(0)}</div>}
              </div>
              <div className="overflow-hidden">
                <h3 className="text-white font-black text-lg truncate">{atleta?.nome}</h3>
                <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest truncate">{atleta?.equipe}</p>
              </div>
            </div>

            <div className="mb-6 space-y-2">
              <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2">Chaves Confirmadas</span>
              {/* Lógica inteligente: Mostra a Categoria e, se absoluto=true, mostra também o Absoluto */}
              <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                <span className="text-white text-xs font-bold truncate">{inscricao.categoria}</span>
              </div>
              {inscricao.absoluto && (
                <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                  <span className="text-white text-xs font-bold truncate">Absoluto Livre</span>
                </div>
              )}
            </div>

            <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center gap-3">
              <QRCode value={qrValue} size={180} level="H" className="rounded-lg" />
              <p className="text-black text-[9px] font-black uppercase tracking-widest text-center">Apresente este código na <br/>pesagem oficial</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}