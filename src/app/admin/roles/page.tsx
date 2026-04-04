"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLocale } from "@/components/admin/LocaleContext";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Textarea } from "@/components/shared/Textarea";
import { Modal } from "@/components/shared/Modal";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/components/shared/Toast";

interface Permissions {
  orders: { view: boolean; edit: boolean; delete: boolean };
  products: { view: boolean; edit: boolean; delete: boolean };
  customers: { view: boolean; edit: boolean };
  analytics: { view: boolean };
  discounts: { view: boolean; edit: boolean; delete: boolean };
  settings: { view: boolean; edit: boolean };
  backups: { view: boolean; create: boolean };
  roles: { view: boolean; edit: boolean };
}

const defaultPermissions: Permissions = {
  orders: { view: false, edit: false, delete: false },
  products: { view: false, edit: false, delete: false },
  customers: { view: false, edit: false },
  analytics: { view: false },
  discounts: { view: false, edit: false, delete: false },
  settings: { view: false, edit: false },
  backups: { view: false, create: false },
  roles: { view: false, edit: false },
};

const permissionLabels: Record<string, { de: string; en: string }> = {
  orders: { de: "Bestellungen", en: "Orders" },
  products: { de: "Produkte", en: "Products" },
  customers: { de: "Kunden", en: "Customers" },
  analytics: { de: "Analysen", en: "Analytics" },
  discounts: { de: "Rabatte", en: "Discounts" },
  settings: { de: "Einstellungen", en: "Settings" },
  backups: { de: "Backups", en: "Backups" },
  roles: { de: "Rollen", en: "Roles" },
};

const actionLabels: Record<string, { de: string; en: string }> = {
  view: { de: "Ansehen", en: "View" },
  edit: { de: "Bearbeiten", en: "Edit" },
  delete: { de: "Löschen", en: "Delete" },
  create: { de: "Erstellen", en: "Create" },
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export default function AdminRolesPage() {
  const { t, locale } = useLocale();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<any[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [permissions, setPermissions] = useState<Permissions>(defaultPermissions);

  // Delete modal
  const [deleteRole, setDeleteRole] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/roles");
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const openCreateModal = () => {
    setEditingRole(null);
    setRoleName("");
    setRoleDescription("");
    setPermissions(defaultPermissions);
    setShowModal(true);
  };

  const openEditModal = (role: any) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || "");
    setPermissions(role.permissions || defaultPermissions);
    setShowModal(true);
  };

  const togglePermission = (section: string, action: string) => {
    setPermissions((prev) => {
      const sectionPerms = prev[section as keyof Permissions] as Record<string, boolean>;
      return {
        ...prev,
        [section]: {
          ...sectionPerms,
          [action]: !sectionPerms[action],
        },
      };
    });
  };

  const toggleAllSection = (section: string, enable: boolean) => {
    setPermissions((prev) => {
      const sectionPerms = prev[section as keyof Permissions] as Record<string, boolean>;
      const updated: Record<string, boolean> = {};
      for (const key of Object.keys(sectionPerms)) {
        updated[key] = enable;
      }
      return { ...prev, [section]: updated };
    });
  };

  const handleSave = async () => {
    if (!roleName.trim()) {
      addToast("error", locale === "en" ? "Name is required" : "Name ist erforderlich");
      return;
    }

    setSaving(true);
    try {
      if (editingRole) {
        // Update
        const res = await fetch("/api/admin/roles", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleId: editingRole.id,
            name: roleName.trim(),
            description: roleDescription || null,
            permissions,
          }),
        });
        if (res.ok) {
          addToast("success", t("saved"));
          setShowModal(false);
          fetchRoles();
        } else {
          const data = await res.json();
          addToast("error", data.error || "Fehler beim Speichern");
        }
      } else {
        // Create
        const res = await fetch("/api/admin/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: roleName.trim(),
            description: roleDescription || null,
            permissions,
          }),
        });
        if (res.ok) {
          addToast("success", locale === "en" ? "Role created" : "Rolle erstellt");
          setShowModal(false);
          fetchRoles();
        } else {
          const data = await res.json();
          addToast("error", data.error || "Fehler beim Erstellen");
        }
      }
    } catch {
      addToast("error", "Fehler");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRole) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/roles?roleId=${deleteRole.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        addToast("success", locale === "en" ? "Role deleted" : "Rolle gelöscht");
        setDeleteRole(null);
        fetchRoles();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Fehler beim Löschen");
      }
    } catch {
      addToast("error", "Fehler beim Löschen");
    } finally {
      setDeleting(false);
    }
  };

  const countPermissions = (perms: Permissions): number => {
    let count = 0;
    for (const section of Object.values(perms)) {
      for (const val of Object.values(section as Record<string, boolean>)) {
        if (val) count++;
      }
    }
    return count;
  };

  const totalPermissions = (): number => {
    let count = 0;
    for (const section of Object.values(defaultPermissions)) {
      count += Object.keys(section).length;
    }
    return count;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{t("roles")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {locale === "en"
              ? "Manage admin roles and permissions"
              : "Adminrollen und Berechtigungen verwalten"}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={openCreateModal}>
          {t("add")}
        </Button>
      </div>

      {/* Roles Grid */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : roles.length === 0 ? (
          <EmptyState
            title={t("noResults")}
            description={locale === "en" ? "No roles have been created yet." : "Noch keine Rollen erstellt."}
          />
        ) : (
          <div className="divide-y divide-neutral-100">
            {roles.map((role) => {
              const permCount = role.permissions ? countPermissions(role.permissions) : 0;
              const isSuperAdmin = role.name === "Super Admin";
              return (
                <div
                  key={role.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900">{role.name}</h3>
                      {isSuperAdmin && <Badge variant="warning">System</Badge>}
                    </div>
                    {role.description && (
                      <p className="mt-0.5 text-xs text-neutral-500">{role.description}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-neutral-400">
                      <span>
                        {permCount}/{totalPermissions()}{" "}
                        {locale === "en" ? "permissions" : "Berechtigungen"}
                      </span>
                      <span>&middot;</span>
                      <span>
                        {role.userCount || 0} {locale === "en" ? "users" : "Benutzer"}
                      </span>
                      <span>&middot;</span>
                      <span>{formatDate(role.createdAt)}</span>
                    </div>
                  </div>

                  {/* Permission badges summary */}
                  <div className="mx-4 hidden flex-wrap gap-1 lg:flex">
                    {role.permissions &&
                      Object.entries(role.permissions).map(([section, perms]) => {
                        const sectionPerms = perms as Record<string, boolean>;
                        const hasAny = Object.values(sectionPerms).some((v) => v);
                        if (!hasAny) return null;
                        return (
                          <Badge key={section} variant="default">
                            {permissionLabels[section]?.[locale === "en" ? "en" : "de"] || section}
                          </Badge>
                        );
                      })}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditModal(role)}>
                      {t("edit")}
                    </Button>
                    {!isSuperAdmin && (
                      <Button variant="danger" size="sm" onClick={() => setDeleteRole(role)}>
                        {t("delete")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Role Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingRole
          ? (locale === "en" ? "Edit Role" : "Rolle bearbeiten")
          : (locale === "en" ? "Create Role" : "Rolle erstellen")}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label={t("name")}
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder={locale === "en" ? "e.g. Content Manager" : "z.B. Content Manager"}
            disabled={editingRole?.name === "Super Admin"}
          />
          <Textarea
            label={t("description")}
            value={roleDescription}
            onChange={(e) => setRoleDescription(e.target.value)}
            rows={2}
            placeholder={locale === "en" ? "Optional description..." : "Optionale Beschreibung..."}
          />

          {/* Permissions Grid */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">
              {locale === "en" ? "Permissions" : "Berechtigungen"}
            </h3>
            <div className="space-y-2">
              {Object.entries(permissions).map(([section, sectionPerms]) => {
                const perms = sectionPerms as Record<string, boolean>;
                const allEnabled = Object.values(perms).every((v) => v);
                return (
                  <div
                    key={section}
                    className="rounded-lg border border-neutral-200 p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-neutral-700">
                        {permissionLabels[section]?.[locale === "en" ? "en" : "de"] || section}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleAllSection(section, !allEnabled)}
                        className="text-xs text-neutral-500 hover:text-neutral-900"
                      >
                        {allEnabled
                          ? (locale === "en" ? "Disable all" : "Alle deaktivieren")
                          : (locale === "en" ? "Enable all" : "Alle aktivieren")}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(perms).map(([action, enabled]) => (
                        <label
                          key={`${section}-${action}`}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={() => togglePermission(section, action)}
                            className="h-3.5 w-3.5 rounded border-neutral-300 text-black focus:ring-neutral-400"
                          />
                          <span className="text-neutral-600">
                            {actionLabels[action]?.[locale === "en" ? "en" : "de"] || action}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>
              {t("cancel")}
            </Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
              {t("save")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteRole}
        onClose={() => setDeleteRole(null)}
        title={locale === "en" ? "Delete Role" : "Rolle löschen"}
        size="sm"
      >
        <p className="text-sm text-neutral-600">
          {locale === "en"
            ? `Are you sure you want to delete the role "${deleteRole?.name}"? This action cannot be undone.`
            : `Möchten Sie die Rolle "${deleteRole?.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        </p>
        {deleteRole?.userCount > 0 && (
          <p className="mt-2 text-xs text-red-600">
            {locale === "en"
              ? `This role has ${deleteRole.userCount} assigned user(s). Remove assignments first.`
              : `Diese Rolle hat ${deleteRole.userCount} zugewiesene(n) Benutzer. Entfernen Sie zuerst die Zuweisungen.`}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setDeleteRole(null)}>
            {t("cancel")}
          </Button>
          <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
            {t("delete")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
