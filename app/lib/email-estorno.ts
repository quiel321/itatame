import { Resend } from "resend";
import { createSupabaseServerClient } from "@/app/lib/supabase-server";

function escapar(valor: unknown) {
  return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[caractere] || caractere);
}

export async function enviarEmailEstorno(inscricao: {
  user_id: string;
  email?: string | null;
  atleta?: string | null;
  evento_id: string;
}, eventoNome: string, valor: number) {
  if (!process.env.RESEND_API_KEY) return { enviado: false, motivo: "RESEND_API_KEY ausente" };
  const supabase = createSupabaseServerClient();
  const { data: perfil } = await supabase.from("atletas").select("email").eq("user_id", inscricao.user_id).maybeSingle();
  let destino = perfil?.email || inscricao.email;
  if (!destino) {
    const { data } = await supabase.auth.admin.getUserById(inscricao.user_id);
    destino = data.user?.email;
  }
  if (!destino) return { enviado: false, motivo: "E-mail do atleta não encontrado" };

  const valorFormatado = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const resposta = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: "iTatame <suporte@itatame.com.br>",
    to: [destino],
    subject: `Estorno da inscrição - ${eventoNome}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#18181b">
      <h1>Estorno da inscrição</h1>
      <p>Olá, ${escapar(inscricao.atleta || "atleta")}.</p>
      <p>O estorno de <strong>${escapar(valorFormatado)}</strong> da inscrição em <strong>${escapar(eventoNome)}</strong> foi solicitado ao Mercado Pago e confirmado pelo iTatame.</p>
      <p>O prazo para o valor aparecer na sua conta ou fatura depende do meio de pagamento e da instituição financeira.</p>
      <p>Seu ingresso para este campeonato não está mais válido. Acompanhe os detalhes em <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://itatame.com.br"}/minhas-inscricoes">Minhas inscrições</a>.</p>
    </div>`,
  });
  if (resposta.error) return { enviado: false, motivo: resposta.error.message };
  return { enviado: true };
}
