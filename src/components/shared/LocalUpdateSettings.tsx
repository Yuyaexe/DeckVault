"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LocalUpdateStatus } from "@/types/electron";

export function LocalUpdateSettings({ disabled }: { disabled: boolean }) {
  const [status, setStatus] = useState<LocalUpdateStatus>({ state: "idle", message: "" });
  const [pending, setPending] = useState(false);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const desktop = window.deckvaultDesktop;
    if (!desktop?.getLocalUpdate) return;
    setAvailable(true);
    let receivedEvent = false;
    let mounted = true;
    const unsubscribe = desktop.onLocalUpdateStatus((value) => {
      receivedEvent = true;
      setStatus(value);
    });
    void desktop.getLocalUpdate().then((value) => {
      if (mounted && !receivedEvent) setStatus(value);
    }).catch((error: Error) => {
      if (mounted) setStatus({ state: "error", message: error.message });
    });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  if (!available) return null;
  const busy = pending || ["building", "waiting", "backup", "installing"].includes(status.state);
  async function act(choose: boolean) {
    const desktop = window.deckvaultDesktop;
    if (!desktop) return;
    setPending(true);
    try {
      if (choose) {
        const source = await desktop.chooseLocalUpdateSource();
        if (source) setStatus((value) => ({ ...value, source, state: "idle", message: "Pasta selecionada." }));
      } else await desktop.startLocalUpdate();
    } catch (error) {
      setStatus((value) => ({ ...value, state: "error", message: error instanceof Error ? error.message : "Não foi possível atualizar." }));
    } finally { setPending(false); }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="font-medium">Atualizar pelos meus arquivos</h3>
      <p className="text-sm text-muted-foreground">
        Usa as alterações salvas na pasta do projeto para gerar e instalar a atualização.
        Ao terminar a compilação, o DeckVault fecha, faz um backup verificado da coleção e reabre atualizado.
      </p>
      <p className="break-all text-sm">Pasta: {status.source || "Escolha a pasta DeckVault na primeira atualização."}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={disabled || busy} onClick={() => void act(false)}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {busy ? "Atualização em andamento…" : "Atualizar pela pasta DeckVault"}
        </Button>
        <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => void act(true)}>
          <FolderOpen className="mr-2 h-4 w-4" /> Trocar pasta
        </Button>
        {status.log && <Button type="button" variant="ghost" onClick={() => {
          void window.deckvaultDesktop?.openLocalUpdateLog().then((error) => {
            if (error) setStatus((value) => ({ ...value, state: "error", message: error }));
          }).catch((error: Error) => setStatus((value) => ({ ...value, state: "error", message: error.message })));
        }}>Ver log</Button>}
      </div>
      {status.message && <p role="status" className={`text-sm ${status.state === "error" ? "text-destructive" : "text-muted-foreground"}`}>{status.message}</p>}
      {status.backup && <p className="break-all text-xs text-muted-foreground">Backup: {status.backup}</p>}
      <p className="text-xs text-muted-foreground">Pode levar alguns minutos. Mantenha o programa aberto e aguarde. A geração pode precisar de internet para baixar ferramentas.</p>
    </div>
  );
}
