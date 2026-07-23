"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { calcularResultadosChaves } from "../lib/ranking-eventos";
import imageCompression from 'browser-image-compression';
import QRCode from "react-qr-code";

export default function PerfilPage() {
  const [perfilId, setPerfilId] = useState<number | null>(null);

  const [fotoUrl, setFotoUrl] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [abaAtiva, setAbaAtiva] = useState("resumo");
  const [filtroInscricao, setFiltroInscricao] = useState("Todas");

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("atleta");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [equipe, setEquipe] = useState("");
  const [academia, setAcademia] = useState("");
  const [professor, setProfessor] = useState("");
  const [peso, setPeso] = useState("");
  const [cidade, setCidade] = useState("");
  const [faixa, setFaixa] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [sexo, setSexo] = useState("");

  const [stats, setStats] = useState({ eventos: 0, lutas: 0, vitorias: 0, ouros: 0, pratas: 0, bronzes: 0, wo: 0 });
  const [minhasInscricoes, setMinhasInscricoes] = useState<any[]>([]);
  const [editandoInscricao, setEditandoInscricao] = useState<any>(null);
  const [salvandoInscricao, setSalvandoInscricao] = useState(false);
  const [minhaEquipe, setMinhaEquipe] = useState<any[]>([]);

  const [dependentes, setDependentes] = useState<any[]>([]);
  const [formDependente, setFormDependente] = useState<any>(null);

  const [professoresDisponiveis, setProfessoresDisponiveis] = useState<any[]>([]);
  const [professorPersonalizado, setProfessorPersonalizado] = useState(false);
  
  // 🔥 NOVO: Estado para controlar o Popup de Notificações
  const [mostrarPopupNotificacao, setMostrarPopupNotificacao] = useState(false);

  const formatarCpf = (value: string) => {
    if (!value) return "";
    return value.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2").substring(0, 14);
  };

  const calcularIdade = (dataNasc: string) => {
    if (!dataNasc) return "?";
    try {
      const hoje = new Date();
      const nasc = new Date(dataNasc);
      let idade = hoje.getFullYear() - nasc.getFullYear();
      const m = hoje.getMonth() - nasc.getMonth();
      if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
      return Number.isNaN(idade) ? "?" : idade;
    } catch {
      return "?";
    }
  };

  const getCorFaixa = (nomeFaixa: string) => {
    if (!nomeFaixa) return "bg-zinc-800 text-zinc-400 border border-zinc-700";
    const f = nomeFaixa.toLowerCase();
    if (f.includes("branca")) return "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.2)]";
    if (f.includes("azul")) return "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]";
    if (f.includes("roxa")) return "bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.4)]";
    if (f.includes("marrom")) return "bg-amber-800 text-white shadow-[0_0_10px_rgba(146,64,14,0.4)]";
    if (f.includes("preta")) return "bg-black text-white border border-zinc-700 shadow-[0_0_10px_rgba(0,0,0,0.6)]";
    return "bg-zinc-800 text-zinc-300 border border-zinc-700";
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const b64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(b64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  };

  const inscreverParaNotificacoes = async () => {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
      alert("Seu navegador não suporta notificações.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert("Você precisa permitir as notificações no cadeado ao lado da URL.");
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("A CHAVE VAPID sumiu ou não foi lida do .env.local!");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey.trim())
      });
      const subData = subscription.toJSON();
      const { data: jaExiste } = await supabase.from("assinaturas_push").select("id").eq("user_id", userId).maybeSingle();
      if (jaExiste) {
        const { error: errUpdate } = await supabase.from("assinaturas_push").update({ subscription: subData }).eq("id", jaExiste.id);
        if (errUpdate) throw errUpdate;
      } else {
        const { error: errInsert } = await supabase.from("assinaturas_push").insert({ user_id: userId, subscription: subData });
        if (errInsert) throw errInsert;
      }
      alert("✅ SUCESSO! Você receberá os avisos de luta.");
      setMostrarPopupNotificacao(false); // Fecha o modal após sucesso
    } catch (err: any) {
      alert("ERRO: " + (err.message || err.name || "Verifique se não está em aba anônima."));
    }
  };

  useEffect(() => {
    carregarDadosCompletos();
  }, []);

  useEffect(() => {
    carregarDadosCompletos();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && 'Notification' in window) {
      // Se o utilizador ainda não tomou uma decisão (nem aceitou, nem bloqueou)
      if (Notification.permission === 'default') {
        // Dá 1.5 segundos para a página carregar bonita antes de saltar o Popup
        const timer = setTimeout(() => {
          setMostrarPopupNotificacao(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  async function carregarDadosCompletos() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      window.location.href = "/login";
      return;
    }

    setUserId(authData.user.id);
    setEmail(authData.user.email || "");

    const { data: perfilData } = await supabase.from("atletas").select("*").eq("user_id", authData.user.id).maybeSingle();
    const { data: orgData } = await supabase.from("organizadores").select("id").eq("user_id", authData.user.id).maybeSingle();

    if (!perfilData) {
      const metadataRole = authData.user.user_metadata?.role;
      if (orgData) {
        window.location.href = "/admin";
        return;
      }
      if (metadataRole === "super-admin") {
        window.location.href = "/super-admin";
        return;
      }

      await supabase.auth.signOut();
      window.location.href = "/login?motivo=sem-cadastro";
      return;
    }

    const userRole = perfilData?.role || authData.user.user_metadata?.role || "atleta";
    setRole(userRole);

    if (orgData && userRole !== "super-admin") {
      window.location.href = "/admin";
      return;
    }

    const { data: profsData } = await supabase.from("atletas").select("nome, equipe, academia, modalidade").eq("role", "professor").neq("nome", "");
    if (profsData) setProfessoresDisponiveis(profsData);

    const { data: depsData } = await supabase.from("atletas").select("*").eq("responsavel_id", authData.user.id);
    if (depsData) setDependentes(depsData);

    const idsFamilia = [authData.user.id];
    if (depsData) depsData.forEach(d => idsFamilia.push(d.user_id));

    const { data: inscricoesData } = await supabase
      .from("inscricoes")
      .select(`id, evento_id, user_id, categoria, absoluto, pagamento_ok, pesagem_ok, eventos (nome, data_evento, data_inicio_checagem, data_fim_checagem, data_divulgacao_chaves)`)
      .in("user_id", idsFamilia);

    if (inscricoesData) setMinhasInscricoes(inscricoesData);

    let totalEventosParticipados = 0;
    if (inscricoesData) {
      const inscTitular = inscricoesData.filter(i => i.pagamento_ok && i.user_id === authData.user.id);
      const eventosUnicos = new Set(inscTitular.map(i => i.evento_id));
      totalEventosParticipados = eventosUnicos.size;
    }

    if (perfilData) {
      setPerfilId(perfilData.id);
      setNome(perfilData.nome || "");
      setFotoUrl(perfilData.foto_url || "");
      setCpf(perfilData.cpf || authData.user.user_metadata?.cpf || "");
      setNascimento(perfilData.nascimento || "");
      setTelefone(perfilData.telefone || "");
      setEquipe(perfilData.equipe || "");
      setAcademia(perfilData.academia || "");
      setProfessor(perfilData.professor || "");
      setPeso(perfilData.peso || "");
      setCidade(perfilData.cidade || "");
      setFaixa(perfilData.faixa || "");
      setModalidade(perfilData.modalidade || "");
      setSexo(perfilData.sexo || "");

      const { data: lutasPerfilData } = await supabase
        .from("chaves")
        .select("id, evento_id, categoria, fase, faixa, id_visual, proxima_luta, atleta_1, atleta_2, atleta_1_id, atleta_2_id, equipe_1, equipe_2, vencedor, vencedor_id, status_luta, metodo_vitoria")
        .or(`atleta_1_id.eq.${perfilData.id},atleta_2_id.eq.${perfilData.id},vencedor_id.eq.${perfilData.id},atleta_1.eq."${perfilData.nome}",atleta_2.eq."${perfilData.nome}"`)
        .eq("status_luta", "concluida");

      const resultadoPerfil = calcularResultadosChaves((lutasPerfilData || []) as any[]);
      
      const estatisticaPerfil = resultadoPerfil.atletas.find((item) => 
        String(item.atleta_id) === String(perfilData.id) || String(item.nome) === String(perfilData.nome)
      );

      const numeroPerfil = (valor: any) => Number(valor || 0);
      const vitoriasSalvas = numeroPerfil(perfilData.vitorias ?? perfilData.vitorias_n ?? perfilData["vit\u00f3rias"] ?? perfilData["vit\u00f3rias_n"]);

      setStats({
        eventos: totalEventosParticipados,
        lutas: Math.max(numeroPerfil(estatisticaPerfil?.lutas), numeroPerfil(perfilData.lutas), vitoriasSalvas + numeroPerfil(perfilData.derrotas)),
        vitorias: Math.max(numeroPerfil(estatisticaPerfil?.vitorias), vitoriasSalvas),
        ouros: Math.max(numeroPerfil(estatisticaPerfil?.ouro), numeroPerfil(perfilData.ouro)),
        pratas: Math.max(numeroPerfil(estatisticaPerfil?.prata), numeroPerfil(perfilData.prata)),
        bronzes: Math.max(numeroPerfil(estatisticaPerfil?.bronze), numeroPerfil(perfilData.bronze)),
        wo: Math.max(numeroPerfil(estatisticaPerfil?.vitorias_wo), numeroPerfil(perfilData.vitorias_wo)),
      });

      if (userRole === "professor" || userRole === "super-admin") {
        let query = supabase.from("atletas").select("id, user_id, nome, faixa, peso, nascimento, foto_url, ouro, prata, bronze, professor, equipe").neq("user_id", authData.user.id);

        if (userRole === "professor" && perfilData.nome) {
          query = query.eq("professor", perfilData.nome);
        } else if (userRole === "super-admin" && perfilData.equipe) {
          query = query.eq("equipe", perfilData.equipe);
        }

        const { data: alunosData } = await query;

        if (alunosData && alunosData.length > 0) {
          const alunosIds = alunosData.map(a => a.user_id).filter(id => id);
          let inscricoesAlunos: any[] = [];

          if (alunosIds.length > 0) {
            const { data: inscData } = await supabase.from("inscricoes").select(`id, evento_id, user_id, categoria, absoluto, pagamento_ok, pesagem_ok, eventos (nome, data_evento, data_inicio_checagem, data_fim_checagem, data_divulgacao_chaves)`).in("user_id", alunosIds);
            if (inscData) inscricoesAlunos = inscData;
          }

          const equipeComInscricoes = alunosData.map(aluno => ({
            ...aluno,
            inscricoes: inscricoesAlunos.filter(insc => insc.user_id === aluno.user_id)
          }));
          setMinhaEquipe(equipeComInscricoes);
        } else {
          setMinhaEquipe([]);
        }
      }

      if (userRole === "atleta" && perfilData.professor) {
        const profExisteNaLista = profsData?.some(p => p.nome === perfilData.professor);
        if (!profExisteNaLista) setProfessorPersonalizado(true);
      }

      if (userRole !== "super-admin" && (!perfilData.nome || (!perfilData.cpf && !authData.user.user_metadata?.cpf))) {
        setAbaAtiva("editar");
      } else {
        setAbaAtiva("resumo");
      }

    } else {
      setNome(authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || "");
      setCpf(authData.user.user_metadata?.cpf || "");
      if (userRole === "super-admin") {
        setAbaAtiva("resumo");
      } else {
        setAbaAtiva("editar");
      }
    }

    setLoading(false);
  }

  const handleProfessorChange = (e: React.ChangeEvent<HTMLSelectElement>, isDependente = false) => {
    const selecionado = e.target.value;

    if (isDependente) {
      if (selecionado === "OUTRO") {
        setFormDependente({ ...formDependente, professor: "", equipe: "", academia: "", professorPersonalizado: true });
      } else {
        const profEncontrado = professoresDisponiveis.find(p => p.nome === selecionado);
        setFormDependente({
          ...formDependente,
          professor: selecionado,
          equipe: profEncontrado?.equipe || "",
          academia: profEncontrado?.academia || "",
          modalidade: profEncontrado?.modalidade || formDependente.modalidade,
          professorPersonalizado: false
        });
      }
    } else {
      if (selecionado === "OUTRO") {
        setProfessorPersonalizado(true);
        setProfessor(""); setEquipe(""); setAcademia("");
      } else {
        setProfessorPersonalizado(false);
        setProfessor(selecionado);
        const profEncontrado = professoresDisponiveis.find(p => p.nome === selecionado);
        if (profEncontrado) {
          setEquipe(profEncontrado.equipe || "");
          setAcademia(profEncontrado.academia || "");
          if (profEncontrado.modalidade) setModalidade(profEncontrado.modalidade);
        }
      }
    }
  };

  async function salvarPerfil() {
    setSalvando(true); setMensagem(""); setErro("");
    if (!nome || !cpf) { setErro("Nome e CPF são obrigatórios."); setSalvando(false); return; }

    const perfilAtualizado: any = {
      user_id: userId,
      email,
      nome,
      cpf,
      telefone,
      equipe,
      academia,
      professor,
      cidade,
      faixa,
      modalidade,
      role,
      sexo,
      nascimento: nascimento ? nascimento : null,
      peso: peso ? peso : null,
      foto_url: fotoUrl
    };

    if (perfilId) {
      perfilAtualizado.id = perfilId;
    }

    const { error } = await supabase.from("atletas").upsert(perfilAtualizado);

    if (error) {
      setErro(error.message.includes("duplicate key") ? "Este CPF já está em uso." : "Erro ao salvar: " + error.message);
    } else {
      setMensagem("Dados atualizados com sucesso!");
      setTimeout(() => { setMensagem(""); setAbaAtiva("resumo"); }, 2000);
    }
    setSalvando(false);
  }

  async function salvarDependente() {
    setSalvando(true); setMensagem(""); setErro("");
    if (!formDependente.nome || !formDependente.nascimento || !formDependente.sexo) {
      setErro("Nome, Sexo e Data de Nascimento do dependente são obrigatórios.");
      setSalvando(false); return;
    }

    const isNew = !formDependente.user_id;
    const dependenteId = isNew ? crypto.randomUUID() : formDependente.user_id;

    const dadosDependente = {
      user_id: dependenteId,
      responsavel_id: userId,
      role: "atleta",
      nome: formDependente.nome,
      cpf: formDependente.cpf || null,
      nascimento: formDependente.nascimento,
      sexo: formDependente.sexo,
      equipe: formDependente.equipe,
      academia: formDependente.academia,
      professor: formDependente.professor,
      faixa: formDependente.faixa,
      peso: formDependente.peso ? formDependente.peso : null,
      modalidade: formDependente.modalidade,
      cidade: formDependente.cidade || cidade
    };

    const { error } = await supabase.from("atletas").upsert(dadosDependente, { onConflict: "user_id" });

    if (error) {
      setErro("Erro ao salvar dependente: " + error.message);
    } else {
      setMensagem("Dependente salvo com sucesso!");
      await carregarDadosCompletos();
      setTimeout(() => { setMensagem(""); setFormDependente(null); }, 1500);
    }
    setSalvando(false);
  }

  async function apagarConta() {
    const confirmacao = window.confirm("CUIDADO: Deseja APAGAR sua conta permanentemente?");
    if (!confirmacao) return;
    setApagando(true);
    try {
      await supabase.from("atletas").delete().eq("user_id", userId);
      await supabase.rpc('deletar_minha_conta');
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err) {
      alert("Erro ao tentar apagar sua conta."); setApagando(false);
    }
  }

  async function sairConta() {
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.href = "/login";
  }

  async function handleUploadFoto(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      if (!event.target.files || event.target.files.length === 0) return;
      let file = event.target.files[0];
      setUploadingFoto(true);

      const isHeic = file.type === "image/heic" || file.type === "image/heif" || file.name.toLowerCase().endsWith(".heic");
      if (isHeic) {
        try {
          const heic2any = (await import("heic2any")).default;
          const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
          file = new File([Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });
        } catch (err) {
          alert("Não foi possível processar a foto."); setUploadingFoto(false); return;
        }
      }

      if (file.size > 10 * 1024 * 1024) { alert("Foto muito grande."); setUploadingFoto(false); return; }

      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 500,
        useWebWorker: true,
        fileType: "image/webp"
      };
      const compressedFile = await imageCompression(file, options);

      const fileName = `avatar-${userId}-${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, compressedFile);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('atletas').update({ foto_url: publicUrlData.publicUrl }).eq('user_id', userId);
      setFotoUrl(publicUrlData.publicUrl);
    } catch (error: any) {
      alert("Erro ao enviar a foto.");
    } finally {
      setUploadingFoto(false);
    }
  }

  const inscricoesFiltradas = minhasInscricoes.filter((insc) => {
    if (filtroInscricao === "Todas") return true;
    return (insc.pagamento_ok ? "PAGAS" : "PENDENTES") === filtroInscricao.toUpperCase();
  });

  const categoriasPesoPermitidas = [
    "Galo (Até 57.500 kg)",
    "Pluma (Até 64.500 kg)",
    "Leve (Até 72.500 kg)",
    "Médio (Até 82.300 kg)",
    "Meio Pesado (Até 88.300 kg)",
    "Pesado (Até 94.300 kg)",
    "Super Pesado (Até 100.500 kg)",
    "Pesadíssimo (Acima de 100.5 kg)"
  ];

  const checagemAbertaParaEdicao = (insc: any) => {
    const evento = insc?.eventos;
    const agora = new Date();
    const inicio = evento?.data_inicio_checagem ? new Date(evento.data_inicio_checagem) : null;
    const fim = evento?.data_fim_checagem ? new Date(evento.data_fim_checagem) : null;
    if (!inicio && !fim) return true;
    return Boolean((!inicio || agora >= inicio) && (!fim || agora <= fim));
  };

  async function abrirEditorInscricao(insc: any) {
    setErro("");
    
    if (!checagemAbertaParaEdicao(insc)) {
      alert("⚠️ ACESSO NEGADO: A edição da inscrição fica disponível apenas no período de checagem definido pelo organizador.");
      return;
    }

    const { count } = await supabase
      .from("chaves")
      .select("id", { count: "exact", head: true })
      .eq("evento_id", insc.evento_id);

    if ((count || 0) > 0) {
      alert("⚠️ ACESSO NEGADO: As chaves oficiais deste evento já foram geradas! O atleta já não pode alterar o peso sozinho. Procure a mesa da organização.");
      return;
    }

    let indiceAtual = categoriasPesoPermitidas.findIndex(c => c === insc.categoria);
    if (indiceAtual === -1) indiceAtual = 0; 
    const categoriasDisponiveis = categoriasPesoPermitidas.slice(indiceAtual);

    setEditandoInscricao({ 
      ...insc, 
      categoriaNova: insc.categoria || categoriasDisponiveis[0], 
      absolutoNovo: Boolean(insc.absoluto),
      categoriasDisponiveis 
    });
  }

  async function salvarEdicaoInscricao() {
    if (!editandoInscricao) return;
    setSalvandoInscricao(true);
    setErro("");
    setMensagem("");

    const payload = {
      categoria: editandoInscricao.categoriaNova,
      absoluto: Boolean(editandoInscricao.absolutoNovo)
    };

    const { error } = await supabase
      .from("inscricoes")
      .update(payload)
      .eq("id", editandoInscricao.id)
      .eq("user_id", editandoInscricao.user_id); 

    if (error) {
      setErro("Não foi possível atualizar a inscrição: " + error.message);
      setSalvandoInscricao(false);
      return;
    }

    setMinhasInscricoes((prev) => prev.map((insc) => insc.id === editandoInscricao.id ? { ...insc, categoria: payload.categoria, absoluto: payload.absoluto } : insc));
    setMensagem("Inscrição atualizada. Confira a checagem do evento novamente.");
    setTimeout(() => {
        setEditandoInscricao(null);
    }, 2000);
    setSalvandoInscricao(false);
  }

  const formatarData = (dataStr: string) => {
    if (!dataStr) return "Data a definir";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const totalAlunos = minhaEquipe.length;
  const ourosEquipe = minhaEquipe.reduce((acc, aluno) => acc + (aluno.ouro || 0), 0);
  const pratasEquipe = minhaEquipe.reduce((acc, aluno) => acc + (aluno.prata || 0), 0);
  const bronzesEquipe = minhaEquipe.reduce((acc, aluno) => acc + (aluno.bronze || 0), 0);

  const getNomeInscrito = (uid: string) => {
    if (uid === userId) return "Eu (Titular)";
    const dep = dependentes.find(d => d.user_id === uid);
    return dep ? dep.nome : "Desconhecido";
  };

  if (loading) return <div className="p-10 text-center text-zinc-500 mt-20 uppercase font-bold text-xs tracking-widest">A carregar perfil...</div>;

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden px-3 sm:px-4 md:px-6 pt-6 md:pt-10 pb-8">
      <div className="grid md:grid-cols-[240px_1fr] gap-4 md:gap-6 max-w-6xl mx-auto w-full">

        {/* SIDEBAR ESQUERDA */}
        <div className={`bg-[#0a0a0e] border ${role === 'professor' ? 'border-yellow-500/30' : 'border-white/5'} rounded-3xl p-4 md:p-5 flex flex-col items-center shadow-xl h-fit relative md:sticky md:top-24 z-10 w-full`}>

          {role === 'professor' && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-yellow-400 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.4)] pointer-events-none">
              Perfil Mestre
            </div>
          )}

          <div className="relative mb-4 mt-2 group cursor-pointer flex-shrink-0" onClick={() => document.getElementById('upload-foto')?.click()}>
            <div className={`w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center text-4xl font-black text-zinc-400 shadow-inner border-[3px] border-[#0a0a0e] ring-2 transition-all duration-300 overflow-hidden relative ${role === 'professor' ? 'ring-yellow-500/50 group-hover:ring-yellow-400' : 'ring-zinc-700/50 group-hover:ring-cyan-500/50'}`}>
              {uploadingFoto ? (
                <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-widest animate-pulse ${role === 'professor' ? 'text-yellow-400' : 'text-cyan-400'}`}>Enviando</span>
              ) : fotoUrl ? (
                <img src={fotoUrl} alt="Foto de Perfil" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs font-black">{nome ? nome.charAt(0).toUpperCase() : "?"}</div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-[9px] text-white font-bold uppercase tracking-widest pointer-events-none">Trocar</span>
              </div>
            </div>
            <div className={`absolute bottom-0 right-0 text-black p-2 rounded-full shadow-lg border-2 border-[#0a0a0e] transition-transform duration-300 group-hover:scale-110 ${role === 'professor' ? 'bg-yellow-500' : 'bg-cyan-500 text-white'}`}>
              <svg className="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </div>
            <input type="file" accept="image/*" className="hidden cursor-pointer" id="upload-foto" onChange={handleUploadFoto} disabled={uploadingFoto} />
          </div>

          <h2 className="text-base font-bold text-white text-center leading-tight mb-1 truncate w-full px-2">{nome || "Novo Usuário"}</h2>
          <span className={`text-[9px] font-black uppercase tracking-wider mb-6 text-center truncate w-full block ${role === 'professor' ? 'text-yellow-500' : 'text-cyan-500'}`}>
            {academia ? `${equipe} - ${academia}` : equipe || "Sem Equipe"}
          </span>

          <div className="w-full flex flex-col gap-1.5">
            {role === "professor" ? (
              <>
                <button onClick={() => setAbaAtiva("resumo")} className={`cursor-pointer w-full py-2.5 px-4 rounded-xl text-[11px] font-bold text-left transition-colors flex items-center gap-3 ${abaAtiva === "resumo" ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 shadow-sm" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>
                  <svg className="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg> Dashboard Academia
                </button>
                <button onClick={() => setAbaAtiva("carteirinha")} className={`cursor-pointer w-full py-2.5 px-4 rounded-xl text-[11px] font-bold text-left transition-colors flex items-center gap-3 ${abaAtiva === "carteirinha" ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 shadow-sm" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>
                  <svg className="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg> Carteira do Mestre
                </button>
                <button onClick={() => setAbaAtiva("editar")} className={`cursor-pointer w-full py-2.5 px-4 rounded-xl text-[11px] font-bold text-left transition-colors flex items-center gap-3 ${abaAtiva === "editar" ? "bg-white/10 text-white border border-white/5 shadow-sm" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>
                  <svg className="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Dados da Academia
                </button>
                <button onClick={() => setAbaAtiva("equipe")} className={`cursor-pointer w-full py-2.5 px-4 rounded-xl text-[11px] font-bold text-left transition-colors flex justify-between items-center ${abaAtiva === "equipe" ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 shadow-sm" : "text-zinc-500 hover:text-yellow-500 hover:bg-yellow-500/5"}`}>
                  <span className="flex items-center gap-3"><svg className="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> Lista de Alunos</span>
                  <span className="bg-zinc-800 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded-full pointer-events-none">{totalAlunos}</span>
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setAbaAtiva("resumo")} className={`cursor-pointer w-full py-2.5 px-4 rounded-xl text-[11px] font-bold text-left transition-colors flex items-center gap-3 ${abaAtiva === "resumo" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>
                  <svg className="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg> Meu Perfil
                </button>
                <button onClick={() => setAbaAtiva("carteirinha")} className={`cursor-pointer w-full py-2.5 px-4 rounded-xl text-[11px] font-bold text-left transition-colors flex items-center gap-3 ${abaAtiva === "carteirinha" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>
                  <svg className="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg> Carteira do Atleta
                </button>
                <button onClick={() => setAbaAtiva("editar")} className={`cursor-pointer w-full py-2.5 px-4 rounded-xl text-[11px] font-bold text-left transition-colors flex items-center gap-3 ${abaAtiva === "editar" ? "bg-white/10 text-white border border-white/5 shadow-sm" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>
                  <svg className="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Alterar Cadastro
                </button>
                <button onClick={() => setAbaAtiva("dependentes")} className={`cursor-pointer w-full py-2.5 px-4 rounded-xl text-[11px] font-bold text-left transition-colors flex justify-between items-center ${abaAtiva === "dependentes" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>
                  <span className="flex items-center gap-3"><svg className="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg> Família / Dependentes</span>
                  {dependentes.length > 0 && <span className="bg-zinc-800 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded-full pointer-events-none">{dependentes.length}</span>}
                </button>
                <button onClick={() => setAbaAtiva("inscricoes")} className={`cursor-pointer w-full py-2.5 px-4 rounded-xl text-[11px] font-bold text-left transition-colors flex justify-between items-center ${abaAtiva === "inscricoes" ? "bg-white/10 text-white border border-white/5 shadow-sm" : "text-zinc-500 hover:text-white hover:bg-white/5"}`}>
                  <span className="flex items-center gap-3"><svg className="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg> Minhas Inscrições</span>
                  {minhasInscricoes.length > 0 && <span className="bg-zinc-800 text-white text-[9px] px-1.5 py-0.5 rounded-full pointer-events-none">{minhasInscricoes.length}</span>}
                </button>
              </>
            )}

            <button onClick={() => window.location.href = "/"} className="cursor-pointer text-zinc-500 hover:text-white hover:bg-white/5 py-2.5 px-4 rounded-xl text-[11px] font-medium text-left transition-colors mb-4 flex items-center gap-3 mt-2 border-t border-white/5">
              <svg className="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> Ver Eventos Abertos
            </button>
          </div>

          <button onClick={sairConta} className="cursor-pointer mt-auto w-full border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white py-2.5 rounded-xl font-bold transition-all text-[11px]">Sair da Conta</button>
          
          {/* 🔥 GATILHO DO MODAL DE NOTIFICAÇÃO (Substitui o botão agressivo antigo) */}
          <button onClick={() => setMostrarPopupNotificacao(true)} className="cursor-pointer mt-3 w-full bg-[#0a0a0e] border border-white/10 hover:border-red-500/50 text-zinc-400 hover:text-white py-2.5 rounded-xl font-bold transition-all text-[11px] flex justify-center items-center gap-2">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg> Alertas no Celular
          </button>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div className={`bg-[#0a0a0e] border ${role === 'professor' && (abaAtiva === 'equipe' || abaAtiva === 'resumo' || abaAtiva === 'carteirinha') ? 'border-yellow-500/20' : 'border-white/5'} rounded-3xl p-4 md:p-6 shadow-xl min-h-[500px] w-full transition-colors duration-500`}>

          {/* 🎫 NOVA ABA: CARTEIRA DO ATLETA */}
          {abaAtiva === "carteirinha" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 w-full flex flex-col items-center pt-4 md:pt-10">
               <div className="w-[340px] bg-[#0c1220] border border-zinc-800 rounded-xl overflow-hidden relative shadow-[0_0_40px_rgba(6,182,212,0.15)] pb-4">
                 <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none"></div>
                 <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 blur-2xl rounded-full pointer-events-none"></div>
                 <div className="flex gap-3 p-4 pb-2 relative z-10">
                    <div className="w-[125px] h-[160px] bg-zinc-900 border-2 border-zinc-800 rounded overflow-hidden shrink-0 shadow-lg">
                       {fotoUrl ? <img src={fotoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl font-black text-zinc-700 bg-zinc-900">{nome?.charAt(0) || "?"}</div>}
                    </div>
                    <div className="flex-1 flex flex-col items-end pt-2">
                       <span className="text-white font-black italic tracking-tighter text-2xl mb-1"><span className="text-red-600">i</span>TATAME</span>
                       <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20 text-right">Digital Card</span>
                    </div>
                 </div>
                 <div className="space-y-1.5 px-4 mb-4 relative z-10">
                    <div className="flex bg-white h-7 items-center overflow-hidden rounded-[2px] shadow-sm">
                       <div className="bg-cyan-900 text-white font-black italic text-[9px] px-2 h-full flex items-center w-[90px]" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>NOME</div>
                       <div className="text-black text-[10px] font-bold px-1 truncate flex-1 uppercase">{nome || "NÃO INFORMADO"}</div>
                    </div>
                    <div className="flex bg-white h-7 items-center overflow-hidden rounded-[2px] shadow-sm">
                       <div className="bg-cyan-900 text-white font-black italic text-[9px] px-2 h-full flex items-center w-[90px]" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>ACADEMIA</div>
                       <div className="text-black text-[10px] font-bold px-1 truncate flex-1 uppercase">{academia ? `${equipe} - ${academia}` : equipe || "SEM EQUIPE"}</div>
                    </div>
                    <div className="flex bg-white h-7 items-center overflow-hidden rounded-[2px] shadow-sm">
                       <div className="bg-cyan-900 text-white font-black italic text-[9px] px-2 h-full flex items-center w-[90px]" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>FAIXA</div>
                       <div className="text-black text-[10px] font-bold px-1 truncate flex-1 uppercase">{faixa || "BRANCA"}</div>
                    </div>
                 </div>
                 <div className="flex gap-3 px-4 relative z-10">
                    <div className="w-[100px] h-[100px] bg-white p-1.5 rounded-[2px] shrink-0 shadow-sm flex items-center justify-center">
                       <QRCode value={`https://itatame.com/atleta/${userId}`} size={88} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
                    </div>
                    <div className="flex-1 space-y-1.5 flex flex-col justify-center">
                         <div className="flex bg-white h-6 items-center overflow-hidden rounded-[2px] shadow-sm">
                            <div className="bg-cyan-900 text-white font-black italic text-[8px] pl-2 pr-2 h-full flex items-center w-[90px]" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>NASCIMENTO</div>
                            <div className="text-black text-[8px] sm:text-[9px] font-bold px-1 truncate flex-1">{nascimento ? formatarData(nascimento) : "--/--/----"}</div>
                         </div>
                         <div className="flex bg-white h-6 items-center overflow-hidden rounded-[2px] shadow-sm">
                            <div className="bg-cyan-900 text-white font-black italic text-[8px] pl-2 pr-2 h-full flex items-center w-[90px]" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>NÚMERO</div>
                            <div className="text-black text-[8px] sm:text-[9px] font-bold px-1 truncate flex-1">{userId.substring(0,8).toUpperCase()}</div>
                         </div>
                         <div className="flex bg-white h-6 items-center overflow-hidden rounded-[2px] shadow-sm">
                            <div className="bg-cyan-900 text-white font-black italic text-[8px] pl-2 pr-2 h-full flex items-center w-[90px]" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>VALIDADE</div>
                            <div className="text-black text-[8px] sm:text-[9px] font-bold px-1 truncate flex-1">31/12/{new Date().getFullYear()}</div>
                         </div>
                    </div>
                 </div>
               </div>
               <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-6 text-center max-w-[300px]">
                 Este é o seu registro digital oficial. Escaneie o QR Code para acessar o seu perfil público e mural de medalhas.
               </p>
            </div>
          )}

          {/* ABA 1: RESUMO DA CARREIRA E DASHBOARD */}
          {abaAtiva === "resumo" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
              <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                {role === "professor" ? (
                  <><svg className="w-5 h-5 text-yellow-500 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg> Dashboard da Equipe</>
                ) : (
                  <><svg className="w-5 h-5 text-cyan-500 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg> Histórico de Campeonatos</>
                )}
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mb-6 w-full">
                {role === "professor" ? (
                  <>
                    <div className="bg-black/50 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center transition-all duration-300 hover:bg-white/10 hover:-translate-y-1 cursor-default">
                      <span className="text-xl md:text-2xl font-black text-white">{totalAlunos}</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Alunos Ativos</span>
                    </div>
                    <div className="bg-[#fff9e6]/5 border border-yellow-500/30 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:bg-yellow-500/10 hover:-translate-y-1 group cursor-default">
                      <span className="text-xl md:text-2xl font-black text-yellow-500">{ourosEquipe}</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-yellow-600 uppercase tracking-widest mt-1">Ouros Equipe</span>
                    </div>
                    <div className="bg-[#f4f4f5]/5 border border-zinc-400/30 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:bg-zinc-400/10 hover:-translate-y-1 group cursor-default">
                      <span className="text-xl md:text-2xl font-black text-zinc-300">{pratasEquipe}</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Pratas Equipe</span>
                    </div>
                    <div className="bg-[#fff1f2]/5 border border-orange-700/40 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:bg-orange-700/10 hover:-translate-y-1 group cursor-default">
                      <span className="text-xl md:text-2xl font-black text-orange-500">{bronzesEquipe}</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-orange-700 uppercase tracking-widest mt-1">Bronzes Equipe</span>
                    </div>
                    <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:bg-yellow-500/10 group cursor-default">
                      <span className="text-xl md:text-2xl font-black text-yellow-500">{ourosEquipe + pratasEquipe + bronzesEquipe}</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-yellow-600 uppercase tracking-widest mt-1">Total Medalhas</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-black/50 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center transition-all duration-300 hover:bg-white/10 hover:-translate-y-1 cursor-default">
                      <span className="text-xl md:text-2xl font-black text-white">{stats.eventos}</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Eventos</span>
                    </div>
                    <div className="bg-black/50 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center transition-all duration-300 hover:bg-white/10 hover:-translate-y-1 cursor-default">
                      <span className="text-xl md:text-2xl font-black text-white">{stats.lutas}</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Lutas</span>
                    </div>
                    <div className="bg-[#fff9e6]/5 border border-yellow-500/30 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:bg-yellow-500/10 hover:-translate-y-1 group cursor-default">
                      <span className="text-xl md:text-2xl font-black text-yellow-500">{stats.ouros}</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-yellow-600 uppercase tracking-widest mt-1">Ouros</span>
                    </div>
                    <div className="bg-[#f4f4f5]/5 border border-zinc-400/30 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:bg-zinc-400/10 hover:-translate-y-1 group cursor-default">
                      <span className="text-xl md:text-2xl font-black text-zinc-300">{stats.pratas}</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Pratas</span>
                    </div>
                    <div className="bg-[#fff1f2]/5 border border-orange-700/40 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:bg-orange-700/10 hover:-translate-y-1 group cursor-default">
                      <span className="text-xl md:text-2xl font-black text-orange-500">{stats.bronzes}</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-orange-700 uppercase tracking-widest mt-1">Bronzes</span>
                    </div>
                    <div className="bg-cyan-900/10 border border-cyan-500/30 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:bg-cyan-500/10 group cursor-default">
                      <span className="text-xl md:text-2xl font-black text-cyan-400">{stats.vitorias}</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-cyan-600 uppercase tracking-widest mt-1">Vitórias</span>
                      <span className="text-[8px] font-bold text-cyan-700 uppercase tracking-widest mt-0.5">W.O. {stats.wo}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="h-[1px] w-full bg-white/5 my-6"></div>

              <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <svg className={`w-5 h-5 pointer-events-none ${role === 'professor' ? 'text-yellow-500' : 'text-cyan-500'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg>
                {role === "professor" ? "Dados Oficiais da Academia" : "Ficha Cadastral"}
              </h3>

              <div className={`bg-[#0b1320] border rounded-2xl p-4 shadow-xl w-full transition-all duration-500 ${role === 'professor' ? 'border-yellow-500/20 hover:border-yellow-500/40' : 'border-cyan-500/20 hover:border-cyan-500/40'}`}>
                {role === "professor" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                    <div className="bg-black/50 border border-white/5 rounded-xl p-3 md:col-span-2 cursor-default">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Professor Líder / Mestre</span>
                      <span className="text-base md:text-lg text-white font-black uppercase tracking-tight break-words">{nome || "NÃO CADASTRADO"}</span>
                    </div>
                    <div className="bg-black/50 border border-yellow-500/10 rounded-xl p-3 cursor-default">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Bandeira / Equipe Oficial</span>
                      <span className="text-sm md:text-base text-yellow-500 font-black uppercase tracking-tight break-words">{equipe || "PENDENTE"}</span>
                    </div>
                    <div className="bg-black/50 border border-white/5 rounded-xl p-3 cursor-default">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Academia / CT Principal</span>
                      <span className="text-sm md:text-base text-white font-black uppercase tracking-tight break-words">{academia || "NÃO INFORMADA"}</span>
                    </div>

                    <div className="bg-black/50 border border-white/5 rounded-xl p-3 flex flex-wrap gap-4 sm:gap-6 cursor-default">
                      <div>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Cidade Sede</span>
                        <span className="text-sm md:text-base text-white font-black uppercase tracking-tight">{cidade || "--"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Modalidade</span>
                        <span className="text-sm md:text-base text-white font-black uppercase tracking-tight">{modalidade || "--"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Sexo</span>
                        <span className="text-sm md:text-base text-white font-black uppercase tracking-tight">{sexo || "--"}</span>
                      </div>
                    </div>
                    <div className="bg-black/50 border border-white/5 rounded-xl p-3 flex items-center justify-between cursor-default">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Sua Faixa de Mestre</span>
                      <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 w-max ${getCorFaixa(faixa)}`}>
                        Faixa {faixa || "NÃO INFORMADA"}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                    <div className="bg-black/50 border border-white/5 rounded-xl p-3 md:col-span-2 cursor-default">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Nome do Titular</span>
                      <span className="text-base md:text-lg text-white font-black uppercase tracking-tight break-words">{nome || "NÃO CADASTRADO"}</span>
                    </div>
                    <div className="bg-black/50 border border-cyan-500/10 rounded-xl p-3 cursor-default">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Bandeira / Equipe Oficial</span>
                      <span className="text-sm md:text-base text-cyan-400 font-black uppercase tracking-tight break-words">{equipe || "SEM EQUIPE"}</span>
                    </div>
                    <div className="bg-black/50 border border-white/5 rounded-xl p-3 cursor-default">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Academia / CT de Treino</span>
                      <span className="text-sm md:text-base text-white font-black uppercase tracking-tight break-words">{academia || "NÃO INFORMADA"}</span>
                    </div>
                    <div className="bg-black/50 border border-white/5 rounded-xl p-3 md:col-span-2 cursor-default">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Professor Responsável</span>
                      <span className="text-sm md:text-base text-white font-black uppercase tracking-tight break-words">{professor || "NÃO INFORMADO"}</span>
                    </div>
                    <div className="bg-black/50 border border-white/5 rounded-xl p-3 flex flex-wrap gap-4 sm:gap-6 cursor-default">
                      <div>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Idade</span>
                        <span className="text-sm md:text-base text-white font-black uppercase tracking-tight">{nascimento ? `${calcularIdade(nascimento)} ANOS` : "--"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Peso Base</span>
                        <span className="text-sm md:text-base text-white font-black uppercase tracking-tight">{peso ? `${peso} KG` : "--"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Sexo</span>
                        <span className="text-sm md:text-base text-white font-black uppercase tracking-tight">{sexo || "--"}</span>
                      </div>
                    </div>
                    <div className="bg-black/50 border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-default">
                      <div>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Modalidade</span>
                        <span className="text-sm md:text-base text-white font-black uppercase tracking-tight">{modalidade || "JIU-JITSU"}</span>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 w-max ${getCorFaixa(faixa)}`}>
                        Faixa {faixa || "NÃO INFORMADA"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 🟠 ABA 2: EDITAR CADASTRO */}
          {abaAtiva === "editar" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 w-full">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-black text-white">{role === "professor" ? "Dados da Academia" : "Alterar Cadastro"}</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-3 mb-5 w-full">
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Nome Completo *</label><input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={`cursor-text w-full bg-black/50 border border-white/5 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors ${role === 'professor' ? 'focus:border-yellow-500/50' : 'focus:border-cyan-500/50'}`} /></div>
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">E-mail</label><input type="email" value={email} disabled className="w-full bg-black/20 border border-transparent outline-none rounded-xl px-3 py-2 text-xs text-zinc-500 cursor-not-allowed" /></div>
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">CPF *</label><input type="text" value={cpf} onChange={(e) => setCpf(formatarCpf(e.target.value))} className={`cursor-text w-full bg-black/50 border border-white/5 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors ${role === 'professor' ? 'focus:border-yellow-500/50' : 'focus:border-cyan-500/50'}`} /></div>
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Telefone / WhatsApp</label><input type="text" value={telefone} onChange={(e) => setTelefone(e.target.value)} className={`cursor-text w-full bg-black/50 border border-white/5 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors ${role === 'professor' ? 'focus:border-yellow-500/50' : 'focus:border-cyan-500/50'}`} /></div>
                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Cidade - Estado</label><input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} className={`cursor-text w-full bg-black/50 border border-white/5 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors ${role === 'professor' ? 'focus:border-yellow-500/50' : 'focus:border-cyan-500/50'}`} /></div>

                {role === "professor" ? (
                  <>
                    <div><label className="block text-[10px] font-bold text-yellow-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Bandeira / Equipe Global Oficial</label><input type="text" value={equipe} onChange={(e) => setEquipe(e.target.value)} placeholder="Ex: Gracie Barra, Nova União" className="cursor-text w-full bg-black/50 border border-white/5 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors focus:border-yellow-500" /></div>
                    <div><label className="block text-[10px] font-bold text-yellow-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Nome da sua Academia / CT local</label><input type="text" value={academia} onChange={(e) => setAcademia(e.target.value)} placeholder="Ex: CT Silva, Matriz Centro" className="cursor-text w-full bg-black/50 border border-white/5 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors focus:border-yellow-500" /></div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Sua Faixa de Mestre</label>
                      <select value={faixa} onChange={(e) => setFaixa(e.target.value)} className="cursor-pointer w-full bg-black/50 border border-white/5 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors appearance-none focus:border-yellow-500">
                        <option value="" className="bg-[#0a0a0e] text-white">Selecione...</option>
                        <option value="Roxa" className="bg-[#0a0a0e] text-white">Roxa</option>
                        <option value="Marrom" className="bg-[#0a0a0e] text-white">Marrom</option>
                        <option value="Preta" className="bg-[#0a0a0e] text-white">Preta</option>
                        <option value="Coral" className="bg-[#0a0a0e] text-white">Coral</option>
                        <option value="Vermelha" className="bg-[#0a0a0e] text-white">Vermelha</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-yellow-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Sua Modalidade Principal</label>
                      <select value={modalidade} onChange={(e) => setModalidade(e.target.value)} className="cursor-pointer w-full bg-black/50 border border-white/5 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors appearance-none focus:border-yellow-500">
                        <option value="" className="bg-[#0a0a0e] text-white">Selecione...</option>
                        <option value="Jiu-Jitsu" className="bg-[#0a0a0e] text-white">Jiu-Jitsu</option>
                        <option value="No-Gi" className="bg-[#0a0a0e] text-white">No-Gi</option>
                        <option value="Judô" className="bg-[#0a0a0e] text-white">Judô</option>
                        <option value="Grappling" className="bg-[#0a0a0e] text-white">Grappling</option>
                        <option value="MMA" className="bg-[#0a0a0e] text-white">MMA</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Sexo</label>
                      <select value={sexo} onChange={(e) => setSexo(e.target.value)} className="cursor-pointer w-full bg-black/50 border border-white/5 focus:border-yellow-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors appearance-none">
                        <option value="" className="bg-[#0a0a0e] text-white">Selecione...</option>
                        <option value="Masculino" className="bg-[#0a0a0e] text-white">Masculino</option>
                        <option value="Feminino" className="bg-[#0a0a0e] text-white">Feminino</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Data de Nascimento</label><input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} className="cursor-pointer w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors [&::-webkit-calendar-picker-indicator]:invert" /></div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Sexo</label>
                      <select value={sexo} onChange={(e) => setSexo(e.target.value)} className="cursor-pointer w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors appearance-none">
                        <option value="" className="bg-[#0a0a0e] text-white">Selecione...</option>
                        <option value="Masculino" className="bg-[#0a0a0e] text-white">Masculino</option>
                        <option value="Feminino" className="bg-[#0a0a0e] text-white">Feminino</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-cyan-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Selecione seu Professor Responsável</label>
                      <select value={professorPersonalizado ? "OUTRO" : professor} onChange={(e) => handleProfessorChange(e, false)} className="cursor-pointer w-full bg-cyan-900/10 border border-cyan-500/30 focus:border-cyan-500 outline-none rounded-xl px-3 py-3 text-xs text-white transition-colors appearance-none">
                        <option value="" className="bg-[#0a0a0e] text-white">Selecione na lista...</option>
                        {professoresDisponiveis.map(p => (
                          <option key={p.nome} value={p.nome} className="bg-[#0a0a0e] text-white">{p.nome}</option>
                        ))}
                        <option value="OUTRO" className="bg-[#0a0a0e] text-white">Outro / Meu professor não está na lista</option>
                      </select>
                      {professorPersonalizado && (
                        <input type="text" placeholder="Digite o nome do seu professor..." value={professor} onChange={(e) => setProfessor(e.target.value)} className="cursor-text w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors mt-2 animate-in fade-in" />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Bandeira / Equipe Global</label>
                      <input type="text" value={equipe} onChange={(e) => setEquipe(e.target.value)} disabled={!professorPersonalizado && professor !== ""} placeholder="Auto-preenchido" className={`w-full outline-none rounded-xl px-3 py-2 text-xs transition-colors ${(!professorPersonalizado && professor !== "") ? 'bg-black/30 border-transparent text-zinc-500 cursor-not-allowed' : 'cursor-text border bg-black/50 border-white/5 text-white focus:border-cyan-500/50'}`} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Academia / CT de Treino</label>
                      <input type="text" value={academia} onChange={(e) => setAcademia(e.target.value)} disabled={!professorPersonalizado && professor !== ""} placeholder="Auto-preenchido" className={`w-full outline-none rounded-xl px-3 py-2 text-xs transition-colors ${(!professorPersonalizado && professor !== "") ? 'bg-black/30 border-transparent text-zinc-500 cursor-not-allowed' : 'cursor-text border bg-black/50 border-white/5 text-white focus:border-cyan-500/50'}`} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Faixa</label>
                      <select value={faixa} onChange={(e) => setFaixa(e.target.value)} className="cursor-pointer w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors appearance-none">
                        <option value="" className="bg-[#0a0a0e] text-white">Selecione...</option>
                        <option value="Branca" className="bg-[#0a0a0e] text-white">Branca</option>
                        <option value="Azul" className="bg-[#0a0a0e] text-white">Azul</option>
                        <option value="Roxa" className="bg-[#0a0a0e] text-white">Roxa</option>
                        <option value="Marrom" className="bg-[#0a0a0e] text-white">Marrom</option>
                        <option value="Preta" className="bg-[#0a0a0e] text-white">Preta</option>
                      </select>
                    </div>
                    <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Peso (KG)</label><input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} className="cursor-text w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors" /></div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Modalidade Principal</label>
                      <select
                        value={modalidade}
                        onChange={(e) => setModalidade(e.target.value)}
                        disabled={!professorPersonalizado && professor !== ""}
                        className={`w-full outline-none rounded-xl px-3 py-2 text-xs transition-colors appearance-none ${(!professorPersonalizado && professor !== "") ? 'bg-black/30 border-transparent text-zinc-500 cursor-not-allowed' : 'cursor-pointer border bg-black/50 border-white/5 text-white focus:border-cyan-500/50'}`}
                      >
                        <option value="" className="bg-[#0a0a0e] text-white">Selecione...</option>
                        <option value="Jiu-Jitsu" className="bg-[#0a0a0e] text-white">Jiu-Jitsu</option>
                        <option value="No-Gi" className="bg-[#0a0a0e] text-white">No-Gi</option>
                        <option value="Judô" className="bg-[#0a0a0e] text-white">Judô</option>
                        <option value="Grappling" className="bg-[#0a0a0e] text-white">Grappling</option>
                        <option value="MMA" className="bg-[#0a0a0e] text-white">MMA</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {erro && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg font-medium text-xs">{erro}</div>}
              {mensagem && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg font-medium text-xs text-center animate-pulse">{mensagem}</div>}

              <button onClick={salvarPerfil} disabled={salvando} className={`cursor-pointer w-full text-white font-black text-sm py-3 rounded-xl transition-all disabled:opacity-50 ${role === 'professor' ? 'bg-yellow-600 hover:bg-yellow-500 shadow-[0_0_15px_rgba(202,138,4,0.2)] text-black' : 'bg-cyan-600 hover:bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]'}`}>
                {salvando ? "Salvando..." : "Salvar Alterações"}
              </button>

              <div className="mt-8 pt-6 border-t border-white/5 flex justify-center">
                <button
                  onClick={apagarConta}
                  disabled={apagando}
                  className="cursor-pointer text-[10px] font-bold text-zinc-600 hover:text-red-500 transition-colors uppercase tracking-widest disabled:opacity-50"
                >
                  {apagando ? "Apagando Registro..." : "Apagar minha conta permanentemente"}
                </button>
              </div>

            </div>
          )}

          {/* 🟢 ABA NOVA: MEUS DEPENDENTES (FILHOS) */}
          {abaAtiva === "dependentes" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 w-full">

              {!formDependente ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <div>
                      <h3 className="text-xl font-black text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-cyan-500 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        Família / Dependentes
                      </h3>
                      <p className="text-zinc-400 text-xs mt-1">Gerencie os perfis de filhos e menores sob sua responsabilidade.</p>
                    </div>
                    <button
                      onClick={() => setFormDependente({ nome: "", cpf: "", nascimento: "", sexo: "", professor: "", equipe: "", academia: "", faixa: "", peso: "", modalidade: "", professorPersonalizado: false })}
                      className="cursor-pointer bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.2)] shrink-0"
                    >
                      + Adicionar Dependente
                    </button>
                  </div>

                  {dependentes.length === 0 ? (
                    <div className="bg-black/30 border border-dashed border-white/10 p-10 rounded-2xl text-center">
                      <p className="text-zinc-500 text-sm font-medium">Você ainda não tem dependentes cadastrados.</p>
                      <p className="text-zinc-600 text-[10px] mt-2 uppercase tracking-widest">Adicione seus filhos para poder inscrevê-los em eventos com a sua conta.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dependentes.map(dep => (
                        <div key={dep.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-cyan-500/30 transition-colors">
                          <div className="flex items-center gap-4 overflow-hidden">
                            <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500 font-black text-lg shrink-0 border border-zinc-700 cursor-default">
                              {dep.nome.charAt(0)}
                            </div>
                            <div className="truncate">
                              <h4 className="text-white font-bold text-sm truncate">{dep.nome}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${getCorFaixa(dep.faixa)}`}>{dep.faixa || "S/ Faixa"}</span>
                                <span className="text-zinc-400 text-[10px] font-bold">{dep.nascimento ? `${calcularIdade(dep.nascimento)} Anos` : ""} • {dep.peso ? `${dep.peso}kg` : ""} • {dep.sexo ? dep.sexo : "S/ Sexo"}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setFormDependente({ ...dep, professorPersonalizado: !professoresDisponiveis.some(p => p.nome === dep.professor) })}
                            className="cursor-pointer bg-white/5 hover:bg-white/10 text-white p-2.5 rounded-lg transition-colors border border-transparent hover:border-white/10 shrink-0"
                          >
                            <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="animate-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                    <h3 className="text-xl font-black text-white">{formDependente.id ? "Editar Dependente" : "Novo Dependente"}</h3>
                    <button onClick={() => setFormDependente(null)} className="cursor-pointer text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest">Voltar</button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3 mb-6">
                    <div className="md:col-span-2"><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Nome Completo (Criança/Atleta) *</label><input type="text" value={formDependente.nome} onChange={(e) => setFormDependente({...formDependente, nome: e.target.value})} className="cursor-text w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors" /></div>
                    <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">CPF (Opcional p/ menor)</label><input type="text" value={formDependente.cpf || ""} onChange={(e) => setFormDependente({...formDependente, cpf: formatarCpf(e.target.value)})} className="cursor-text w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors" /></div>
                    <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Data de Nascimento *</label><input type="date" value={formDependente.nascimento || ""} onChange={(e) => setFormDependente({...formDependente, nascimento: e.target.value})} className="cursor-pointer w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors [&::-webkit-calendar-picker-indicator]:invert" /></div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Sexo *</label>
                      <select value={formDependente.sexo || ""} onChange={(e) => setFormDependente({...formDependente, sexo: e.target.value})} className="cursor-pointer w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors appearance-none">
                        <option value="" className="bg-[#0a0a0e] text-white">Selecione...</option>
                        <option value="Masculino" className="bg-[#0a0a0e] text-white">Masculino</option>
                        <option value="Feminino" className="bg-[#0a0a0e] text-white">Feminino</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 mt-2">
                      <label className="block text-[10px] font-bold text-cyan-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Professor da Criança</label>
                      <select value={formDependente.professorPersonalizado ? "OUTRO" : (formDependente.professor || "")} onChange={(e) => handleProfessorChange(e, true)} className="cursor-pointer w-full bg-cyan-900/10 border border-cyan-500/30 focus:border-cyan-500 outline-none rounded-xl px-3 py-3 text-xs text-white transition-colors appearance-none">
                        <option value="" className="bg-[#0a0a0e] text-white">Selecione na lista...</option>
                        {professoresDisponiveis.map(p => <option key={p.nome} value={p.nome} className="bg-[#0a0a0e] text-white">{p.nome}</option>)}
                        <option value="OUTRO" className="bg-[#0a0a0e] text-white">Outro / O professor não está na lista</option>
                      </select>
                      {formDependente.professorPersonalizado && (
                        <input type="text" placeholder="Digite o nome do professor..." value={formDependente.professor || ""} onChange={(e) => setFormDependente({...formDependente, professor: e.target.value})} className="cursor-text w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors mt-2 animate-in fade-in" />
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Equipe Global</label>
                      <input type="text" value={formDependente.equipe || ""} onChange={(e) => setFormDependente({...formDependente, equipe: e.target.value})} disabled={!formDependente.professorPersonalizado && formDependente.professor !== ""} placeholder="Auto-preenchido" className={`w-full outline-none rounded-xl px-3 py-2 text-xs transition-colors ${(!formDependente.professorPersonalizado && formDependente.professor !== "") ? 'bg-black/30 border-transparent text-zinc-500 cursor-not-allowed' : 'cursor-text border bg-black/50 border-white/5 text-white focus:border-cyan-500/50'}`} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Academia Local</label>
                      <input type="text" value={formDependente.academia || ""} onChange={(e) => setFormDependente({...formDependente, academia: e.target.value})} disabled={!formDependente.professorPersonalizado && formDependente.professor !== ""} placeholder="Auto-preenchido" className={`w-full outline-none rounded-xl px-3 py-2 text-xs transition-colors ${(!formDependente.professorPersonalizado && formDependente.professor !== "") ? 'bg-black/30 border-transparent text-zinc-500 cursor-not-allowed' : 'cursor-text border bg-black/50 border-white/5 text-white focus:border-cyan-500/50'}`} />
                    </div>

                    <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Faixa Atual</label><select value={formDependente.faixa || ""} onChange={(e) => setFormDependente({...formDependente, faixa: e.target.value})} className="cursor-pointer w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors appearance-none"><option value="" className="bg-[#0a0a0e] text-white">Selecione...</option><option value="Cinza" className="bg-[#0a0a0e] text-white">Cinza</option><option value="Amarela" className="bg-[#0a0a0e] text-white">Amarela</option><option value="Laranja" className="bg-[#0a0a0e] text-white">Laranja</option><option value="Verde" className="bg-[#0a0a0e] text-white">Verde</option><option value="Branca" className="bg-[#0a0a0e] text-white">Branca</option><option value="Azul" className="bg-[#0a0a0e] text-white">Azul</option></select></div>
                    <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Peso (KG)</label><input type="number" step="0.1" value={formDependente.peso || ""} onChange={(e) => setFormDependente({...formDependente, peso: e.target.value})} className="cursor-text w-full bg-black/50 border border-white/5 focus:border-cyan-500/50 outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors" /></div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 pl-1 cursor-default">Modalidade Principal</label>
                      <select
                        value={formDependente.modalidade || ""}
                        onChange={(e) => setFormDependente({...formDependente, modalidade: e.target.value})}
                        disabled={!formDependente.professorPersonalizado && formDependente.professor !== ""}
                        className={`w-full outline-none rounded-xl px-3 py-2 text-xs transition-colors appearance-none ${(!formDependente.professorPersonalizado && formDependente.professor !== "") ? 'bg-black/30 border-transparent text-zinc-500 cursor-not-allowed' : 'cursor-pointer border bg-black/50 border-white/5 text-white focus:border-cyan-500/50'}`}
                      >
                        <option value="" className="bg-[#0a0a0e] text-white">Selecione...</option>
                        <option value="Jiu-Jitsu" className="bg-[#0a0a0e] text-white">Jiu-Jitsu</option>
                        <option value="No-Gi" className="bg-[#0a0a0e] text-white">No-Gi</option>
                        <option value="Judô" className="bg-[#0a0a0e] text-white">Judô</option>
                        <option value="Grappling" className="bg-[#0a0a0e] text-white">Grappling</option>
                        <option value="MMA" className="bg-[#0a0a0e] text-white">MMA</option>
                      </select>
                    </div>

                  </div>

                  {erro && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg font-medium text-xs">{erro}</div>}
                  {mensagem && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg font-medium text-xs text-center">{mensagem}</div>}

                  <div className="flex gap-3">
                    <button onClick={() => setFormDependente(null)} className="cursor-pointer flex-1 bg-white/5 hover:bg-white/10 text-white font-bold text-xs py-3 rounded-xl transition-colors">Cancelar</button>
                    <button onClick={salvarDependente} disabled={salvando} className="cursor-pointer flex-[2] bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] disabled:opacity-50">
                      {salvando ? "Salvando..." : "Salvar Perfil do Dependente"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 🔵 ABA 3: MINHAS INSCRIÇÕES */}
          {abaAtiva === "inscricoes" && role !== "professor" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                <h3 className="text-xl font-black text-white">Minhas Inscrições</h3>
                <div className="flex bg-black/50 p-1 rounded-xl border border-white/5 overflow-x-auto w-full sm:w-auto">
                  {["Todas", "Pagas", "Pendentes"].map((filtro) => (
                    <button key={filtro} onClick={() => setFiltroInscricao(filtro)} className={`cursor-pointer flex-1 sm:flex-none px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider ${filtroInscricao === filtro ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-white"}`}>
                      {filtro}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 w-full">
                {inscricoesFiltradas.length === 0 ? (
                  <div className="text-center py-16 bg-black/30 rounded-2xl border border-dashed border-white/10 w-full">
                    <span className="text-4xl block mb-3 opacity-50 pointer-events-none">🥋</span>
                    <p className="text-zinc-400 font-medium text-sm">Você ainda não tem inscrições registradas.</p>
                    <button onClick={() => window.location.href = "/"} className="cursor-pointer mt-5 px-6 py-3 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black rounded-xl transition-colors uppercase tracking-widest shadow-lg">Ver Calendário de Eventos</button>
                  </div>
                ) : (
                  inscricoesFiltradas.map((insc) => (
                    <div key={insc.id} className={`bg-black/40 border rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all shadow-lg ${insc.pagamento_ok ? 'border-green-500/20 hover:border-green-500/40' : 'border-red-500/20 hover:border-red-500/40'}`}>

                      <div className="w-full md:w-auto overflow-hidden flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3 w-full">

                          <span className="bg-white/10 border border-white/20 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded flex items-center gap-1 cursor-default">
                            <svg className="w-3 h-3 text-cyan-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                            {getNomeInscrito(insc.user_id)}
                          </span>

                          <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded flex items-center gap-1 border cursor-default ${insc.pagamento_ok ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
                            {insc.pagamento_ok ? (
                              <><svg className="w-3 h-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Pago</>
                            ) : (
                              <><svg className="w-3 h-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Pendente</>
                            )}
                          </span>

                          <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded flex items-center gap-1 border cursor-default ${insc.pesagem_ok ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                            {insc.pesagem_ok ? "Peso OK" : "Pesagem Pendente"}
                          </span>

                          <span className="text-zinc-500 text-[10px] font-bold ml-auto md:ml-2 whitespace-nowrap cursor-default">
                            {insc.eventos?.data_evento ? formatarData(insc.eventos.data_evento) : "Data a definir"}
                          </span>
                        </div>

                        <h4 className="text-base md:text-lg font-black text-white leading-tight truncate w-full cursor-default mb-1.5">{insc.eventos?.nome || "Campeonato não identificado"}</h4>

                        <div className="flex items-center gap-2 mt-2">
                          <span className="bg-black border border-white/5 text-zinc-300 text-[10px] font-bold px-3 py-1.5 rounded-md">Categoria: <strong className="text-white">{insc.categoria}</strong></span>
                          {insc.absoluto && <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-[10px] font-bold px-3 py-1.5 rounded-md">Absoluto incluso</span>}
                        </div>
                      </div>

                      <div className="w-full md:w-auto flex flex-col gap-2.5 shrink-0 md:min-w-[220px]">
                        <button onClick={() => abrirEditorInscricao(insc)} className="cursor-pointer w-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 text-cyan-200 px-4 py-2.5 rounded-xl font-black uppercase tracking-widest transition-colors text-[9px] text-center flex items-center justify-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                          Editar Inscrição
                        </button>

                        {!insc.pagamento_ok ? (
                          <>
                            {/* BOTAO DE PAGAMENTO SE PENDENTE */}
                            <button onClick={() => window.location.href = "/pagamento"} className="cursor-pointer w-full bg-red-600 hover:bg-red-500 text-white px-4 py-3.5 rounded-xl font-black uppercase tracking-widest transition-colors text-[10px] text-center shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center justify-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                              Fazer Pagamento
                            </button>
                          </>
                        ) : (
                          <>
                            {/* BOTAO DO QR CODE PASSAPORTE SE PAGO */}
                            <button onClick={() => window.location.href = `/ingresso/${insc.evento_id}/${insc.user_id}`} className="cursor-pointer w-full bg-green-600 hover:bg-green-500 text-white px-4 py-3.5 rounded-xl font-black uppercase tracking-widest transition-colors text-[10px] text-center shadow-[0_0_15px_rgba(22,163,74,0.2)] flex items-center justify-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                              Ver Passaporte (QR)
                            </button>

                            {/* BOTAO DA CHAVE MENOR */}
                            <button onClick={() => window.location.href = `/evento/${insc.evento_id}/publico`} className="cursor-pointer w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2.5 rounded-xl font-bold uppercase tracking-widest transition-colors text-[9px] text-center flex items-center justify-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                              Checar Chave
                            </button>
                          </>
                        )}
                        <button onClick={() => window.location.href = `/evento/${insc.evento_id}/ao-vivo`} className="cursor-pointer w-full bg-red-600 hover:bg-red-500 border border-red-400/30 text-white px-4 py-3 rounded-xl font-black uppercase tracking-widest transition-colors text-[10px] text-center shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center justify-center gap-2">
                          <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                          Lutas ao Vivo
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 🔥 ABA 4: PAINEL DA EQUIPE (EXCLUSIVO PROFESSOR) */}
          {abaAtiva === "equipe" && role === "professor" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <svg className="w-6 h-6 text-yellow-500 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    Alunos Vinculados à Equipe
                  </h3>
                  <p className="text-zinc-400 text-xs mt-1">Bandeira Local: <strong className="text-yellow-500">{academia ? `${equipe} - ${academia}` : equipe || "Configuração Pendente"}</strong></p>
                </div>
              </div>

              {!equipe ? (
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-6 rounded-2xl text-center">
                  <span className="text-3xl mb-3 block pointer-events-none">⚠️</span>
                  <h4 className="text-yellow-500 font-black text-sm uppercase tracking-widest mb-2">Equipe não configurada</h4>
                  <p className="text-zinc-400 text-xs max-w-md mx-auto mb-4">Para seus alunos aparecerem aqui, vá na aba "Dados da Academia" e preencha a Bandeira e o nome do seu CT.</p>
                  <button onClick={() => setAbaAtiva("editar")} className="cursor-pointer bg-yellow-600 text-black px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-yellow-500 transition-colors">Configurar Agora</button>
                </div>
              ) : minhaEquipe.length === 0 ? (
                <div className="bg-black/30 border border-dashed border-white/10 p-10 rounded-2xl text-center">
                  <p className="text-zinc-500 text-sm font-medium">Ainda não há alunos cadastrados no sistema sob a sua supervisão.</p>
                  <p className="text-zinc-600 text-[10px] mt-2 uppercase tracking-widest">Peça para seus alunos escolherem o seu nome na lista durante o cadastro.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {minhaEquipe.map(aluno => (
                    <div key={aluno.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-4 hover:border-yellow-500/30 transition-colors group cursor-default">

                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-800 rounded-full overflow-hidden shrink-0 border-2 border-zinc-700 group-hover:border-yellow-500 transition-colors">
                          {aluno.foto_url ? <img src={aluno.foto_url} className="w-full h-full object-cover pointer-events-none" /> : <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs font-black">{aluno.nome?.charAt(0) || "?"}</div>}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h5 className="text-white font-black text-sm truncate">{aluno.nome}</h5>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded pointer-events-none ${getCorFaixa(aluno.faixa)}`}>{aluno.faixa || "S/ Faixa"}</span>
                            <span className="text-zinc-500 text-[10px] font-bold">{aluno.peso ? `${aluno.peso}kg` : "S/ Peso"}</span>
                          </div>
                        </div>
                      </div>

                      {/* 🔥 QUADRO DE MEDALHAS DO ALUNO */}
                      <div className="flex items-center gap-3 mt-1 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-1.5" title="Ouros">
                          <div className="w-6 h-6 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20"><span className="text-[10px]">🥇</span></div>
                          <span className="text-yellow-500 text-xs font-black">{aluno.ouro || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5" title="Pratas">
                          <div className="w-6 h-6 rounded-full bg-zinc-400/10 flex items-center justify-center border border-zinc-400/20"><span className="text-[10px]">🥈</span></div>
                          <span className="text-zinc-300 text-xs font-black">{aluno.prata || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5" title="Bronzes">
                          <div className="w-6 h-6 rounded-full bg-orange-700/10 flex items-center justify-center border border-orange-700/20"><span className="text-[10px]">🥉</span></div>
                          <span className="text-orange-500 text-xs font-black">{aluno.bronze || 0}</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/5">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <svg className="w-3 h-3 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          Inscrições Ativas
                        </span>

                        {aluno.inscricoes && aluno.inscricoes.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {aluno.inscricoes.map((insc: any) => (
                              <div key={insc.id} className="bg-black/50 rounded-xl p-2.5 flex items-center justify-between border border-white/5">
                                <div className="flex flex-col truncate pr-2">
                                  <span className="text-white text-[11px] font-bold truncate">{insc.eventos?.nome || "Evento Padrão"}</span>
                                  <span className="text-zinc-500 text-[9px] truncate">{insc.categoria}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${insc.pagamento_ok ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    {insc.pagamento_ok ? 'Pago' : 'Pendente'}
                                  </span>
                                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${insc.pesagem_ok ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                                    {insc.pesagem_ok ? 'Peso OK' : 'S/ Peso'}
                                  </span>
                                  <button onClick={() => window.location.href = `/evento/${insc.evento_id}/ao-vivo`} className="cursor-pointer bg-red-600 hover:bg-red-500 border border-red-400/30 text-white px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-colors">
                                    Ao vivo
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-600 font-medium">Nenhuma inscrição no momento.</span>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* MODAL DE EDIÇÃO DE INSCRIÇÃO BLINDADO */}
      {editandoInscricao && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0a0e] border border-white/10 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-1">Ajuste de checagem</p>
                <h3 className="text-xl font-black text-white">Mudar de Peso</h3>
              </div>
              <button onClick={() => setEditandoInscricao(null)} className="text-zinc-500 hover:text-white text-xl leading-none">?</button>
            </div>
            
            <div className="mb-4 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
              <p className="text-red-400 text-[10px] font-medium leading-relaxed">
                <strong className="font-black uppercase tracking-widest block mb-1">Regra Oficial:</strong>
                Durante a checagem, você só tem permissão para migrar para categorias de peso <strong>superiores</strong> à sua inscrição original.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1.5">Escolha o Novo Peso</label>
                <select 
                  value={editandoInscricao.categoriaNova} 
                  onChange={(event) => setEditandoInscricao({ ...editandoInscricao, categoriaNova: event.target.value })} 
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-3 text-white text-xs font-bold outline-none focus:border-cyan-400 cursor-pointer"
                >
                  {/* Usa as categorias limitadas criadas na função abrirEditorInscricao */}
                  {editandoInscricao.categoriasDisponiveis.map((categoria: string) => (
                    <option key={categoria} value={categoria}>{categoria}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-start gap-3 bg-black/50 border border-white/10 rounded-xl p-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(editandoInscricao.absolutoNovo)} onChange={(event) => setEditandoInscricao({ ...editandoInscricao, absolutoNovo: event.target.checked })} className="mt-0.5 w-4 h-4 accent-yellow-500 cursor-pointer" />
                <span>
                  <strong className="block text-white text-xs uppercase tracking-widest">Manter no Absoluto</strong>
                  <span className="block text-zinc-500 text-[10px] mt-1 leading-relaxed">O absoluto continua permitido se você confirmar a mudança de peso.</span>
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button onClick={() => setEditandoInscricao(null)} className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest">Cancelar</button>
              <button onClick={salvarEdicaoInscricao} disabled={salvandoInscricao} className="cursor-pointer disabled:opacity-60 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl py-3 text-[10px] font-black uppercase tracking-widest">{salvandoInscricao ? "Salvando..." : "Confirmar Mudança"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 NOVO: MODAL POPUP DE NOTIFICAÇÕES IQUAL AO PRINT */}
      {mostrarPopupNotificacao && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setMostrarPopupNotificacao(false)}></div>
          <div className="bg-[#0a0a0e] border border-white/10 rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-sm shadow-2xl relative z-10 p-6 pt-8 flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
            <button onClick={() => setMostrarPopupNotificacao(false)} className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            <div className="flex items-center gap-4 mb-2">
              <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                <span className="absolute top-2.5 right-3 w-2 h-2 rounded-full bg-red-500 border border-[#0a0a0e]"></span>
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">Ativar Notificações</h2>
                <p className="text-zinc-400 text-xs mt-0.5">Fique por dentro de tudo que acontece</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-red-500 text-lg leading-none mt-0.5">•</span>
                <p className="text-zinc-300 text-xs font-medium leading-relaxed">Receba alertas do horário e tatame das suas lutas</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 text-lg leading-none mt-0.5">•</span>
                <p className="text-zinc-300 text-xs font-medium leading-relaxed">Acompanhe os resultados das suas chaves ao vivo</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 text-lg leading-none mt-0.5">•</span>
                <p className="text-zinc-300 text-xs font-medium leading-relaxed">Saiba imediatamente se o seu peso foi aprovado</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 text-lg leading-none mt-0.5">•</span>
                <p className="text-zinc-300 text-xs font-medium leading-relaxed">Não perca os prazos de virada de lote e checagem</p>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setMostrarPopupNotificacao(false)} className="flex-1 py-3.5 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 font-black text-[10px] uppercase tracking-widest transition-colors cursor-pointer">
                Agora Não
              </button>
              <button onClick={inscreverParaNotificacoes} className="flex-1 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg> Ativar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
