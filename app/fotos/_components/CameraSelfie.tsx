"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
  onUnavailable: () => void;
};

export default function CameraSelfie({ onCapture, onClose, onUnavailable }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const fallback = useRef(onUnavailable);
  const [pronta, setPronta] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelada = false;
    let stream: MediaStream | null = null;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (cancelada) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
      } catch {
        if (!cancelada) fallback.current();
      }
    })();
    return () => {
      cancelada = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function capturar() {
    const imagem = video.current;
    if (!imagem?.videoWidth || !imagem.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = imagem.videoWidth;
    canvas.height = imagem.videoHeight;
    const contexto = canvas.getContext("2d");
    if (!contexto) { setErro("Não foi possível capturar. Escolha uma foto da galeria."); return; }
    contexto.drawImage(imagem, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
      else setErro("Não foi possível capturar. Tente novamente.");
    }, "image/jpeg", 0.9);
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/95 p-4" role="dialog" aria-modal="true" aria-label="Tirar selfie com a webcam">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-4">
        <div className="mb-3 flex items-center justify-between text-white">
          <h3 className="font-bold">Tirar selfie</h3>
          <button type="button" onClick={onClose} aria-label="Fechar câmera" className="rounded-full p-2"><X size={20} /></button>
        </div>
        {!pronta && <p className="mb-3 flex items-center gap-2 text-xs text-zinc-300"><Loader2 size={16} className="animate-spin" /> Permita o acesso à câmera para tirar sua selfie.</p>}
        <video ref={video} autoPlay muted playsInline onLoadedData={() => setPronta(true)} className="aspect-[4/3] w-full rounded-xl bg-black object-cover [transform:scaleX(-1)]" />
        {erro && <p role="alert" className="mt-2 text-xs text-red-300">{erro}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!pronta} onClick={capturar} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-retratt px-4 py-3 text-sm font-bold text-black disabled:opacity-50"><Camera size={16} /> Capturar selfie</button>
          <button type="button" onClick={onUnavailable} className="rounded-xl border border-white/20 px-4 py-3 text-sm text-white">Usar galeria</button>
        </div>
      </div>
    </div>
  );
}
