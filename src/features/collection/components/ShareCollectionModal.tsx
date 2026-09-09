"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useT } from "@/lib/i18n/context";
import { toast } from "sonner";
import type { DemoCollection } from "@/lib/demo/types";
import type {
  CollectionInviteDto,
  CollectionMemberDto,
} from "@/lib/data/server/collaboration-service";

interface ShareCollectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: DemoCollection | null;
}

export function ShareCollectionModal({
  open,
  onOpenChange,
  collection,
}: ShareCollectionModalProps) {
  const t = useT();
  const { isSupabaseMode } = useAppConfig();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [members, setMembers] = useState<CollectionMemberDto[]>([]);
  const [invites, setInvites] = useState<CollectionInviteDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!collection || !isSupabaseMode) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/app/collections/members?collectionId=${encodeURIComponent(collection.id)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load members");
      setMembers(json.members ?? []);
      setInvites(json.invites ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("share.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [collection, isSupabaseMode, t]);

  useEffect(() => {
    if (open && collection) {
      void load();
      setEmail("");
      setRole("editor");
    }
  }, [open, collection, load]);

  const handleInvite = async () => {
    if (!collection || !email.trim()) return;
    if (!isSupabaseMode) {
      toast.error(t("share.cloudOnly"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/app/collections/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId: collection.id,
          email: email.trim(),
          role,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to invite");
      setEmail("");
      toast.success(t("share.inviteSent"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("share.inviteFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!collection) return;
    try {
      const res = await fetch("/api/app/collections/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId: collection.id, memberUserId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to remove");
      toast.success(t("share.memberRemoved"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("share.removeFailed"));
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!collection) return;
    try {
      const res = await fetch("/api/app/collections/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId: collection.id, inviteId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to cancel invite");
      toast.success(t("share.inviteCancelled"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("share.removeFailed"));
    }
  };

  const isOwner = collection?.memberRole === "owner" || collection?.ownerUserId == null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("share.title")}
      description={
        collection
          ? t("share.description", { name: collection.name })
          : undefined
      }
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("common.close")}
        </Button>
      }
    >
      {!isSupabaseMode ? (
        <p className="py-2 text-sm text-muted-foreground">{t("share.cloudOnly")}</p>
      ) : (
        <div className="space-y-4 py-2">
          {isOwner && (
            <div className="space-y-2">
              <Label htmlFor="share-email">{t("share.emailLabel")}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="share-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("share.emailPlaceholder")}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && void handleInvite()}
                />
                <ResponsiveSelect
                  value={role}
                  onValueChange={(v) => setRole(v as "editor" | "viewer")}
                  options={[
                    { value: "editor", label: t("share.roleEditor") },
                    { value: "viewer", label: t("share.roleViewer") },
                  ]}
                  triggerClassName="w-full sm:w-[140px]"
                />
                <Button
                  onClick={() => void handleInvite()}
                  disabled={!email.trim() || submitting}
                >
                  {t("share.invite")}
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("share.members")}
                </p>
                <ul className="space-y-2">
                  {members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.isOwner
                            ? t("share.roleOwner")
                            : m.role === "viewer"
                              ? t("share.roleViewer")
                              : t("share.roleEditor")}
                        </p>
                      </div>
                      {isOwner && !m.isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void handleRemoveMember(m.userId)}
                        >
                          {t("share.remove")}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {invites.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("share.pendingInvites")}
                  </p>
                  <ul className="space-y-2">
                    {invites.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{inv.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {inv.role === "viewer"
                              ? t("share.roleViewer")
                              : t("share.roleEditor")}
                          </p>
                        </div>
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleCancelInvite(inv.id)}
                          >
                            {t("share.cancelInvite")}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
