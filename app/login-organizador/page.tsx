"use client";

import { useState, useRef } from "react";
import { supabase } from "../lib/supabase"; 
import { useRouter } from "next/navigation";
import Link from "next/link";
import imageCompression from 'browser-image-compression';

export default function LoginOrganizadorPage() {
  const router = useRouter();
  
  // CONTROLADOR DE ESTADOS
  const [aba, setAba] = useState<"login" | "cadastro">("login");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [mostrarPendencia, setMostrarPendencia] = useState(false);

  // CAMPOS DO FORMULÁRIO
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [nomeAcademia, setNomeAcademia] = useState("");
  const [telefone, setTelefone] = useState("");
  
  // ESTADOS DA FOTO DE PERFIL
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // FUNÇÃO: PROCESSAR FOTO
  // ==========================================
  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErro("");
    try {
      let processedFile = file;

      if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
        const heic2any = (await import("heic2any")).default;
        const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
        const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        processedFile = new File([finalBlob], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
      }

      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true };
      const compressedFile = await imageCompression(processedFile, options);

      setFoto(compressedFile);
      setFotoPreview(URL.createObjectURL(compressedFile));
    } catch (error) {
      console.error("Erro na imagem:", error);
      setErro("Erro ao processar a imagem. Tente usar um JPG ou PNG normal.");
    }
  }

  // ==========================================
  // FUNÇÃO: LOGIN
  // ==========================================
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");
    setSucesso("");

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (authError) {
      setErro("Credenciais inválidas. Verifique o seu e-mail e palavra-passe.");
      setLoading(false);
      return;
    }

    if (authData?.session?.access_token) {
      const resposta = await fetch('/api/organizador/acesso', {
        headers: { Authorization: `Bearer ${authData.session.access_token}` },
        cache: 'no-store',
      });
      const acesso = await resposta.json() as { destino?: string };

      if (acesso.destino === 'admin') {
        router.push('/admin');
      } else if (acesso.destino === 'super-admin') {
        router.push('/super-admin');
      } else if (acesso.destino === 'pendente') {
        setMostrarPendencia(true);
      } else if (acesso.destino === 'erro') {
        setErro('Não foi possível validar a homologação agora. Tente novamente.');
      } else {
        setErro('Acesso Negado: Esta área é restrita para Organizadores.');
        await supabase.auth.signOut();
      }
    }
    setLoading(false);
  }

  // ==========================================
  // FUNÇÃO: CADASTRO NA NOVA TABELA
  // ==========================================
  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");
    setSucesso("");

    if (!nomeCompleto || !email || !senha || !telefone) {
      setErro("Preencha todos os campos obrigatórios (*).");
      setLoading(false);
      return;
    }

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: senha,
      });

      if (signUpError) throw signUpError;
      
      if (signUpData?.user) {
        let fotoUrlFinal = "";

        if (foto) {
          const fileExt = foto.name.split('.').pop();
          const fileName = `${signUpData.user.id}-${Date.now()}.${fileExt}`;
          const filePath = `organizadores/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, foto);

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

          fotoUrlFinal = publicUrlData.publicUrl;
        }

        // INSERÇÃO LIMPA DIRETAMENTE NA TABELA 'ORGANIZADORES'
        const { error: dbError } = await supabase.from("organizadores").insert([
          {
            user_id: signUpData.user.id,
            nome: nomeCompleto,
            email: email, 
            telefone: telefone, 
            academia: nomeAcademia || "Independente",
            foto_url: fotoUrlFinal,
            status: "pendente", // Nasce pendente de aprovação
          }
        ]);

        if (dbError) throw dbError;

        // 🔥 GATILHO DO E-MAIL DE BOAS-VINDAS (ORGANIZADOR) 🔥
        try {
          await fetch('/api/boas-vindas-org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              email: email,
              nome: nomeCompleto
            }),
          });
        } catch (err) {
          console.error("Erro ao enviar e-mail de boas-vindas do organizador", err);
        }
        // 🔥 FIM DO GATILHO 🔥

        setMostrarPendencia(true);
      }
    } catch (err: any) {
      setErro(err.message || "Erro ao realizar registo do organizador.");
    } finally {
      setLoading(false);
    }
  }

  const whatsappNumber = "5565993059729";
  const whatsappMessage = encodeURIComponent("Olá! Acabei de registar a minha organização no iTatame e gostaria de solicitar a libertação do meu painel administrativo.");
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  return (
    <main className="min-h-screen bg-[#050505] flex justify-center p-4 py-8 md:p-8 relative overflow-x-hidden font-sans">
      
      {/* EFEITOS DE LUZ NO FUNDO */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-yellow-600/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-red-600/5 blur-[100px] rounded-full pointer-events-none"></div>

      {/* ADICIONADO 'my-auto' PARA O CARD FICAR CENTRALIZADO NO PC, MAS FLUIR NO MOBILE */}
      <div className="w-full max-w-[850px] my-auto flex flex-col md:flex-row bg-[#0a0a0e]/90 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] relative z-10">
        
        {/* LADO ESQUERDO: O MANIFESTO (AGORA VISÍVEL NO MOBILE!) */}
        <div className="flex flex-col justify-center md:justify-between w-full md:w-1/2 p-6 md:p-8 lg:p-10 relative overflow-hidden bg-gradient-to-br from-[#0a0a0e] to-black border-b md:border-b-0 md:border-r border-white/5">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
          
          <div className="relative z-10 flex items-center justify-between md:items-start md:flex-col gap-4">
            <div>
              <h1 className="text-white font-black text-2xl md:text-3xl italic tracking-tighter mb-1 cursor-default leading-none">
                <span className="text-red-600">i</span>TATAME
              </h1>
              <span className="text-yellow-600 text-[8px] font-black uppercase tracking-widest block border border-yellow-600/30 bg-yellow-600/10 px-2 py-1 rounded w-max cursor-default">
                Network Partners
              </span>
            </div>

            {/* SELO DE SEGURANÇA COMPACTO PARA O MOBILE */}
            <div className="md:hidden flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg">
               <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
               <span className="text-[8px] uppercase tracking-widest font-bold text-zinc-400 mt-0.5">Ambiente Seguro</span>
            </div>
          </div>

          <div className="relative z-10 mt-5 md:mt-8 cursor-default">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white leading-[1.1] mb-2 md:mb-3 tracking-tight">
              O controle absoluto do seu <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-700">evento.</span>
            </h2>
            <p className="text-zinc-400 md:text-zinc-500 text-[10px] md:text-[11px] leading-relaxed max-w-sm font-medium">
              Acesso exclusivo à central de comando. Gira chaves, pesagem, cronogramas e inscrições em tempo real com a tecnologia líder do mercado.
            </p>
          </div>

          <div className="hidden md:flex relative z-10 mt-10 cursor-default">
             <p className="text-zinc-600 text-[9px] uppercase font-bold tracking-widest flex items-center gap-2">
               <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
               Ambiente Seguro Criptografado
             </p>
          </div>
        </div>

        {/* LADO DIREITO: ÁREA DE INTERAÇÃO */}
        <div className="w-full md:w-1/2 p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-black/60 relative">
          
          {mostrarPendencia ? (
            <div className="flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500 py-6 md:py-0">
              <div className="w-20 h-20 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                <svg className="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <h3 className="text-xl md:text-2xl font-black text-white tracking-tight mb-2">Conta Sob Análise</h3>
              <p className="text-zinc-400 text-xs md:text-sm leading-relaxed mb-8 max-w-sm">
                O seu cadastro foi recebido com sucesso e já está em análise! A nossa equipe do iTatame entrará em contato o mais rápido possível para validar os seus dados e liberar o acesso. Se quiser agilizar o processo, chame-nos no WhatsApp abaixo.
              </p>
              
              <a 
                href={whatsappLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="cursor-pointer w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(22,163,74,0.3)] flex items-center justify-center gap-3 text-[11px] md:text-xs"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                Falar com Gestor no WhatsApp
              </a>

              <button onClick={() => { setMostrarPendencia(false); supabase.auth.signOut(); }} className="mt-6 text-zinc-500 text-[10px] uppercase font-bold tracking-widest hover:text-white transition-colors">
                Voltar para o Login
              </button>
            </div>
          ) : (
            <>
              {/* SELETOR DE ABAS PREMIUM */}
              <div className="flex bg-black/60 p-1.5 rounded-xl border border-white/10 mb-6 relative shadow-inner">
                <button onClick={() => { setAba("login"); setErro(""); setSucesso(""); }} className={`relative z-10 flex-1 cursor-pointer py-3 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all rounded-lg ${aba === "login" ? "bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]" : "text-zinc-500 hover:text-white"}`}>
                  Acesso Restrito
                </button>
                <button onClick={() => { setAba("cadastro"); setErro(""); setSucesso(""); }} className={`relative z-10 flex-1 cursor-pointer py-3 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all rounded-lg flex items-center justify-center gap-2 ${aba === "cadastro" ? "bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]" : "text-zinc-500 hover:text-white"}`}>
                  Novo Parceiro
                  {aba !== "cadastro" && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
                    </span>
                  )}
                </button>
              </div>

              {erro && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 animate-in fade-in shadow-lg">
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <span className="text-red-400 text-[10px] md:text-xs font-bold leading-tight">{erro}</span>
                </div>
              )}

              {/* ABA LOGIN */}
              {aba === "login" ? (
                <form onSubmit={handleLogin} className="space-y-3.5 animate-in fade-in">
                  <div>
                    <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest block mb-1.5 ml-1">E-mail Autorizado</label>
                    <div className="relative cursor-text">
                      <svg className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@evento.com" className="w-full bg-[#050505] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 outline-none focus:border-yellow-600 text-white transition-colors text-xs font-bold placeholder:text-zinc-700 shadow-inner" />
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest block mb-1.5 ml-1">Senha de Segurança</label>
                    <div className="relative cursor-text">
                      <svg className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" className="w-full bg-[#050505] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 outline-none focus:border-yellow-600 text-white transition-colors text-xs font-bold placeholder:text-zinc-700 shadow-inner" />
                    </div>
                    {/* 🔥 BOTÃO ESQUECI MINHA SENHA ADICIONADO AQUI 🔥 */}
                    <div className="flex justify-end mt-2 animate-in fade-in">
                      <button 
                        type="button" 
                        onClick={() => router.push('/recuperar-senha')} 
                        className="text-[10px] font-bold text-zinc-500 hover:text-yellow-500 uppercase tracking-widest transition-colors cursor-pointer"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="cursor-pointer w-full mt-4 bg-yellow-600 hover:bg-yellow-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-black uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(202,138,4,0.15)] flex items-center justify-center gap-2 text-[10px] md:text-xs">
                    {loading ? "Validando Chave..." : "Acessar Central de Comando"}
                  </button>
                </form>
              ) : (
                
                /* ABA CADASTRO */
                <form onSubmit={handleCadastro} className="space-y-3.5 animate-in fade-in h-[60vh] md:h-auto overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                  
                  {/* UPLOADER DE FOTO */}
                  <div className="flex flex-col items-center justify-center mb-4">
                    <div 
                      className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center bg-black hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-colors cursor-pointer group overflow-hidden"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {fotoPreview ? (
                        <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <svg className="w-8 h-8 text-zinc-600 group-hover:text-yellow-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      )}
                      
                      {fotoPreview && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-2 cursor-default">Logo ou Foto do Perfil</span>
                    <input 
                      type="file" 
                      accept="image/*, .heic" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFotoChange}
                    />
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest block mb-1.5 ml-1">Nome do Responsável *</label>
                    <div className="relative cursor-text">
                      <svg className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      <input type="text" required value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} placeholder="O seu nome completo" className="w-full bg-[#050505] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 outline-none focus:border-yellow-600 text-white transition-colors text-xs font-bold placeholder:text-zinc-700 shadow-inner" />
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest block mb-1.5 ml-1">Nome da Federação / Equipa</label>
                    <div className="relative cursor-text">
                      <svg className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      <input type="text" value={nomeAcademia} onChange={(e) => setNomeAcademia(e.target.value)} placeholder="Ex: Spartan Jiu-Jitsu" className="w-full bg-[#050505] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 outline-none focus:border-yellow-600 text-white transition-colors text-xs font-bold placeholder:text-zinc-700 shadow-inner" />
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest block mb-1.5 ml-1">Telefone / WhatsApp *</label>
                    <div className="relative cursor-text">
                      <svg className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      <input type="text" required value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className="w-full bg-[#050505] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 outline-none focus:border-yellow-600 text-white transition-colors text-xs font-bold placeholder:text-zinc-700 shadow-inner" />
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest block mb-1.5 ml-1">E-mail de Registo *</label>
                    <div className="relative cursor-text">
                      <svg className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemplo@email.com" className="w-full bg-[#050505] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 outline-none focus:border-yellow-600 text-white transition-colors text-xs font-bold placeholder:text-zinc-700 shadow-inner" />
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[9px] font-black uppercase tracking-widest block mb-1.5 ml-1">Criar Palavra-passe *</label>
                    <div className="relative cursor-text">
                      <svg className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full bg-[#050505] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 outline-none focus:border-yellow-600 text-white transition-colors text-xs font-bold placeholder:text-zinc-700 shadow-inner" />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="cursor-pointer w-full mt-4 bg-yellow-600 hover:bg-yellow-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-black uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(202,138,4,0.15)] flex items-center justify-center gap-2 text-[10px] md:text-xs">
                    {loading ? "Criando Credenciais..." : "Solicitar Homologação"}
                  </button>
                </form>
              )}

              {/* ROTA DE FUGA */}
              <div className="mt-8 pt-4 border-t border-white/5 text-center">
                <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest cursor-default">
                  Você é um atleta competidor?
                </p>
                <Link href="/login" className="cursor-pointer inline-block mt-1.5 text-white text-[10px] font-bold hover:text-red-500 transition-colors">
                  Ir para o Portal do Atleta →
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </main>
  );
}
