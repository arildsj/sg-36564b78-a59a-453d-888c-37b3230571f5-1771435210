import React, { useEffect, useState } from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Phone, User, Building2, Users, Plus, Edit, Trash2, Search, Upload, UserPlus, Pencil, MessageSquare, Edit2, Eye, ChevronDown, ChevronRight } from "lucide-react";
import { contactService, type Contact, type ContactGroup } from "@/services/contactService";
import { useToast } from "@/hooks/use-toast";
import { groupService } from "@/services/groupService";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageProvider";
import { Textarea } from "@/components/ui/textarea";

// CRITICAL FIX: Cast supabase to any to completely bypass "Type instantiation is excessively deep" errors
const db = supabase as any;

type Group = {
  id: string;
  name: string;
  kind: string;
};

export default function ContactsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showGDPRDialog, setShowGDPRDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // GDPR state
  const [gdprData, setGdprData] = useState<any>(null);
  const [gdprDeletionReason, setGdprDeletionReason] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importGroupId, setImportGroupId] = useState<string>("");
  const [importContactGroupId, setImportContactGroupId] = useState<string>("");
  const [importNewContactGroupName, setImportNewContactGroupName] = useState("");
  const [importNewContactGroupDescription, setImportNewContactGroupDescription] = useState("");
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [contactGroupMemberships, setContactGroupMemberships] = useState<Record<string, ContactGroup[]>>({});
  const [showContactGroupDialog, setShowContactGroupDialog] = useState(false);
  const [editingContactGroup, setEditingContactGroup] = useState<ContactGroup | null>(null);
  const [contactGroupForm, setContactGroupForm] = useState({
    group_id: "",
    name: "",
    description: "",
  });
  
  // Edit/Create state
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    group_id: "" as string | null, // FASIT: Single group
    tags: [] as string[]
  });
  const [selectedContactGroupIds, setSelectedContactGroupIds] = useState<string[]>([]);
  const [duplicateContact, setDuplicateContact] = useState<{ id: string; name: string } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  useEffect(() => {
    loadData();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: profile } = await db
        .from("user_profiles")
        .select("role")
        .eq("id", user.user.id)
        .single();

      setIsAdmin(profile?.role === "tenant_admin");
    } catch (error) {
      console.error("Failed to check admin status:", error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [contactsData, groupsData] = await Promise.all([
        contactService.getAllContacts(),
        groupService.getAllGroups(),
      ]);
      setContacts(contactsData as Contact[]);
      setGroups(groupsData as Group[]);
      const [contactGroupsData, membershipsData] = await Promise.all([
        contactService.getContactGroups(),
        contactService.getContactGroupMemberships(),
      ]);
      setContactGroups(contactGroupsData);
      setContactGroupMemberships(membershipsData);
    } catch (error: any) {
      console.error("Failed to load contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingContact(null);
    setFormData({
      name: "",
      phone: "",
      group_id: null,
      tags: [],
    });
    setSelectedContactGroupIds([]);
    setDuplicateContact(null);
    setShowDialog(true);
  };

  const handleOpenEdit = async (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phone: contact.phone,
      group_id: contact.group_id,
      tags: contact.tags || [],
    });
    const membershipIds = (contactGroupMemberships[contact.id] || []).map((group) => group.id);
    setSelectedContactGroupIds(membershipIds);
    
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      if (!formData.name.trim() || !formData.phone.trim()) {
        toast({
          title: "Mangler info",
          description: "Vennligst fyll ut navn og telefon",
          variant: "destructive",
        });
        return;
      }

      if (editingContact) {
        await contactService.updateContact(editingContact.id, {
          name: formData.name,
          phone: formData.phone,
          group_id: formData.group_id,
          tags: formData.tags,
        });
        await contactService.setContactGroupMemberships(editingContact.id, selectedContactGroupIds);
      } else {
        const result = await contactService.createContact({
          name: formData.name,
          phone: formData.phone,
          group_id: formData.group_id,
          tags: formData.tags,
        });
        if (result && result.duplicate) {
          setDuplicateContact(result.existing);
          return;
        }
        await contactService.setContactGroupMemberships(result.id, selectedContactGroupIds);
      }

      setShowDialog(false);
      await loadData();
      toast({
        title: editingContact ? "Kontakt oppdatert" : "Kontakt opprettet",
        description: `${formData.name} er lagret`,
      });
    } catch (error: any) {
      console.error("Failed to save contact:", error);
      toast({
        title: "Feil ved lagring",
        description: error.message || "Ukjent feil",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddExisting = async () => {
    if (!duplicateContact) return;
    setSubmitting(true);
    try {
      await contactService.setContactGroupMemberships(duplicateContact.id, selectedContactGroupIds);
      setDuplicateContact(null);
      setShowDialog(false);
      await loadData();
      toast({ title: t("contacts.duplicate_added"), description: duplicateContact.name });
    } catch (err: any) {
      toast({ title: "Feil", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingContact) return;
    
    try {
      setSubmitting(true);
      await contactService.deleteContact(editingContact.id);
      setShowDeleteDialog(false);
      setEditingContact(null);
      await loadData();
    } catch (error: any) {
      console.error("Failed to delete contact:", error);
      toast({
        title: "Feil ved sletting",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleImport = async () => {
    if (!importFile) return;
    
    try {
      setSubmitting(true);
      if (!importGroupId) {
        throw new Error(t("contacts.import_select_semse_first"));
      }

      let targetContactGroupId = importContactGroupId || undefined;
      if (!targetContactGroupId && importNewContactGroupName.trim()) {
        const createdContactGroup = await contactService.createContactGroup({
          group_id: importGroupId,
          name: importNewContactGroupName.trim(),
          description: importNewContactGroupDescription.trim() || undefined,
        });
        targetContactGroupId = createdContactGroup.id;
      }

      await contactService.importContactsToGroup(importFile, {
        groupId: importGroupId,
        contactGroupId: targetContactGroupId,
      });
      setShowImportDialog(false);
      setImportFile(null);
      setImportGroupId("");
      setImportContactGroupId("");
      setImportNewContactGroupName("");
      setImportNewContactGroupDescription("");
      await loadData();
      toast({
        title: t("contacts.import_success"),
        description: t("contacts.import_success_description"),
      });
    } catch (error: any) {
      console.error("Import failed:", error);
      toast({
        title: t("contacts.import_failed"),
        description: error.message || t("contacts.import_error"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  const confirmDelete = (contact: Contact) => {
    setEditingContact(contact);
    setShowDeleteDialog(true);
  };

  const handleOpenGDPRView = async (contact: Contact) => {
    if (!isAdmin) {
      toast({
        title: "Ingen tilgang",
        description: "Kun administratorer kan se GDPR-informasjon",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      // FASIT: Only fetch contact data, no group memberships lookup needed
      const data = await contactService.getContactData(contact.id);
      setGdprData(data);
      setShowGDPRDialog(true);
    } catch (error: any) {
      console.error("Failed to load GDPR info:", error);
      toast({
        title: "Feil",
        description: error.message || "Kunne ikke hente GDPR-informasjon",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGDPRDeletion = async () => {
    if (!gdprData || !gdprDeletionReason.trim()) {
      toast({
        title: "Mangler informasjon",
        description: "Vennligst oppgi grunn for sletting",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const result = await contactService.deleteContactGDPR(
        gdprData.id,
        gdprDeletionReason
      );

      toast({
        title: "Kontakt slettet (GDPR)",
        description: `${result.contact.name} er fjernet permanent`,
      });

      setShowGDPRDialog(false);
      setGdprData(null);
      setGdprDeletionReason("");
      await loadData();
    } catch (error: any) {
      console.error("GDPR deletion failed:", error);
      toast({
        title: "Feil ved sletting",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearch = () => {
    // Search is already handled by onChange and filteredContacts
  };

  const handleViewHistory = (contact: Contact) => {
    window.location.href = `/inbox?phone=${encodeURIComponent(contact.phone)}`;
  };

  const handleOpenCreateContactGroup = () => {
    setEditingContactGroup(null);
    setContactGroupForm({
      group_id: "",
      name: "",
      description: "",
    });
    setShowContactGroupDialog(true);
  };

  const handleOpenEditContactGroup = (contactGroup: ContactGroup) => {
    setEditingContactGroup(contactGroup);
    setContactGroupForm({
      group_id: contactGroup.group_id,
      name: contactGroup.name,
      description: contactGroup.description || "",
    });
    setShowContactGroupDialog(true);
  };

  const handleSaveContactGroup = async () => {
    try {
      setSubmitting(true);

      if (!contactGroupForm.group_id || !contactGroupForm.name.trim()) {
        throw new Error(t("contacts.contact_group_fill_info"));
      }

      if (editingContactGroup) {
        await contactService.updateContactGroup(editingContactGroup.id, {
          name: contactGroupForm.name.trim(),
          description: contactGroupForm.description.trim() || undefined,
        });
      } else {
        await contactService.createContactGroup({
          group_id: contactGroupForm.group_id,
          name: contactGroupForm.name.trim(),
          description: contactGroupForm.description.trim() || undefined,
        });
      }

      setShowContactGroupDialog(false);
      await loadData();
      toast({
        title: editingContactGroup ? "Kontaktgruppe oppdatert" : "Kontaktgruppe opprettet",
        description: contactGroupForm.name,
      });
    } catch (error: any) {
      toast({
        title: "Kunne ikke lagre kontaktgruppe",
        description: error.message || "Ukjent feil",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone?.includes(searchQuery)
  );

  const operationalGroups = groups.filter(g => g.kind === 'operational');
  const groupedContacts = operationalGroups
    .map(group => ({ group, contacts: filteredContacts.filter(c => c.group_id === group.id) }))
    .filter(({ contacts }) => contacts.length > 0);
  const ungroupedContacts = filteredContacts.filter(c => !c.group_id);

  return (
    <>
      <Head>
        <title>{t("contacts.title")} | SeMSe</title>
        <meta name="description" content={t("contacts.description")} />
      </Head>

      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t("contacts.title")}</h1>
              <p className="text-muted-foreground mt-2">
                {t("contacts.description")}
              </p>
            </div>
            <Button onClick={handleOpenCreate}>
              <UserPlus className="h-4 w-4 mr-2" />
              {t("contacts.new_contact")}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleOpenCreateContactGroup}>
                <Users className="h-4 w-4 mr-2" />
                {t("contacts.new_contact_group")}
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                {t("contacts.import_csv")}
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="mb-4">
              <Label htmlFor="search" className="text-sm font-medium">
                {t("contacts.search_filter")}
              </Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="search"
                  type="text"
                  placeholder={t("contacts.search_placeholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {filteredContacts.length} {t("contacts.count")}
              </h3>
            </div>

            <div className="border rounded-lg overflow-hidden">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t("contacts.no_found")}
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("contacts.col.name")}</TableHead>
                        <TableHead>{t("contacts.col.phone")}</TableHead>
                        <TableHead>{t("contacts.col.contact_groups")}</TableHead>
                        <TableHead>{t("contacts.col.created")}</TableHead>
                        <TableHead className="text-right">{t("contacts.col.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedContacts.map(({ group, contacts: groupContacts }) => (
                        <React.Fragment key={group.id}>
                          <TableRow
                            className="bg-muted/50 hover:bg-muted/70 cursor-pointer select-none"
                            onClick={() => toggleGroup(group.id)}
                          >
                            <TableCell colSpan={5} className="py-2">
                              <div className="flex items-center gap-2 font-semibold text-sm">
                                {collapsedGroups.has(group.id)
                                  ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                {group.name}
                                <Badge variant="secondary" className="font-normal">{groupContacts.length}</Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                          {!collapsedGroups.has(group.id) && groupContacts.map((contact) => (
                            <TableRow key={contact.id}>
                              <TableCell className="font-medium pl-8">{contact.name || "-"}</TableCell>
                              <TableCell>{contact.phone}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {(contactGroupMemberships[contact.id] || []).length === 0 ? (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  ) : (
                                    (contactGroupMemberships[contact.id] || []).map((cg) => (
                                      <Badge key={cg.id} variant="outline" className="text-xs">
                                        {cg.name}
                                      </Badge>
                                    ))
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {contact.created_at ? new Date(contact.created_at).toLocaleDateString("nb-NO") : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => handleOpenEdit(contact)}>
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleViewHistory(contact)}>
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => confirmDelete(contact)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}
                      {ungroupedContacts.length > 0 && (
                        <React.Fragment>
                          <TableRow
                            className="bg-muted/50 hover:bg-muted/70 cursor-pointer select-none"
                            onClick={() => toggleGroup('__ungrouped__')}
                          >
                            <TableCell colSpan={5} className="py-2">
                              <div className="flex items-center gap-2 font-semibold text-sm">
                                {collapsedGroups.has('__ungrouped__')
                                  ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                {t("contacts.without_group")}
                                <Badge variant="secondary" className="font-normal">{ungroupedContacts.length}</Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                          {!collapsedGroups.has('__ungrouped__') && ungroupedContacts.map((contact) => (
                            <TableRow key={contact.id}>
                              <TableCell className="font-medium pl-8">{contact.name || "-"}</TableCell>
                              <TableCell>{contact.phone}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {(contactGroupMemberships[contact.id] || []).length === 0 ? (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  ) : (
                                    (contactGroupMemberships[contact.id] || []).map((cg) => (
                                      <Badge key={cg.id} variant="outline" className="text-xs">
                                        {cg.name}
                                      </Badge>
                                    ))
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {contact.created_at ? new Date(contact.created_at).toLocaleDateString("nb-NO") : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => handleOpenEdit(contact)}>
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleViewHistory(contact)}>
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => confirmDelete(contact)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? t("contacts.edit_dialog_title") : t("contacts.create_dialog_title")}
            </DialogTitle>
            <DialogDescription>
              {editingContact
                ? t("contacts.edit_dialog_description")
                : t("contacts.create_dialog_description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-name">{t("contacts.name_label")}</Label>
                <Input
                  id="contact-name"
                  placeholder="F.eks. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">{t("contacts.phone_label")}</Label>
                <Input
                  id="contact-phone"
                  placeholder="+47 123 45 678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            
                            <div className="space-y-2">
              <Label>{t("contacts.group_required")}</Label>
              <Select
                value={formData.group_id || ""}
                onValueChange={(value) => setFormData({ ...formData, group_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("contacts.select_group")} />
                </SelectTrigger>
                <SelectContent>
                  {groups.filter(g => g.kind === 'operational').map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("contacts.contact_groups_in_semse_group")}</Label>
              {formData.group_id ? (
                <div className="grid grid-cols-2 gap-2 border rounded-md p-3 max-h-[180px] overflow-y-auto">
                  {contactGroups
                    .filter((contactGroup) => contactGroup.group_id === formData.group_id)
                    .map((contactGroup) => (
                      <label key={contactGroup.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedContactGroupIds.includes(contactGroup.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedContactGroupIds((prev) => [...prev, contactGroup.id]);
                            } else {
                              setSelectedContactGroupIds((prev) => prev.filter((id) => id !== contactGroup.id));
                            }
                          }}
                        />
                        {contactGroup.name}
                      </label>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("contacts.select_semse_group_first")}</p>
              )}
            </div>
          </div>

          {/* Duplicate phone warning */}
          {duplicateContact && !editingContact && (
            <div className="rounded-md border border-yellow-500/40 bg-yellow-50/80 dark:bg-yellow-950/20 p-3 text-sm space-y-2">
              <p>
                {t("contacts.duplicate_message_prefix")}{" "}
                <strong>{duplicateContact.name}</strong>
                {t("contacts.duplicate_message_suffix")}
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddExisting} disabled={submitting}>
                  {t("contacts.duplicate_add_existing")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDuplicateContact(null)} disabled={submitting}>
                  {t("contacts.cancel")}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={submitting}>
              {t("contacts.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !!duplicateContact}>
              {submitting ? t("contacts.saving") : (editingContact ? t("contacts.save_changes") : t("contacts.add_contact"))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("contacts.confirm_delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("contacts.confirm_delete_description_prefix")} <strong>{editingContact?.name}</strong> ({editingContact?.phone}) {t("contacts.confirm_delete_description_suffix")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("contacts.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {submitting ? t("contacts.deleting") : t("contacts.confirm_delete_button")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("contacts.import_title")}</DialogTitle>
            <DialogDescription>
              {t("contacts.import_description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("contacts.select_file")}</Label>
              <Input 
                type="file" 
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)} 
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t("contacts.select_semse_group_required")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={importGroupId}
                onChange={(e) => setImportGroupId(e.target.value)}
              >
                <option value="">{t("contacts.select_semse_group_placeholder")}</option>
                {groups.filter(g => g.kind === 'operational').map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("contacts.contact_group_optional")}</Label>
              <Select value={importContactGroupId} onValueChange={setImportContactGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("contacts.select_existing_contact_group")} />
                </SelectTrigger>
                <SelectContent>
                  {contactGroups
                    .filter((contactGroup) => !importGroupId || contactGroup.group_id === importGroupId)
                    .map((contactGroup) => (
                      <SelectItem key={contactGroup.id} value={contactGroup.id}>
                        {contactGroup.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 border rounded-md p-3">
              <Label>{t("contacts.create_contact_group_on_import")}</Label>
              <Input
                placeholder={t("contacts.new_contact_group_name_placeholder")}
                value={importNewContactGroupName}
                onChange={(e) => setImportNewContactGroupName(e.target.value)}
              />
              <Textarea
                placeholder={t("contacts.description_optional")}
                value={importNewContactGroupDescription}
                onChange={(e) => setImportNewContactGroupDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={submitting}>
              {t("contacts.cancel")}
            </Button>
            <Button onClick={handleImport} disabled={!importFile || submitting}>
              {submitting ? t("contacts.importing") : t("contacts.start_import")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showContactGroupDialog} onOpenChange={setShowContactGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContactGroup ? t("contacts.edit_contact_group_title") : t("contacts.create_contact_group_title")}</DialogTitle>
            <DialogDescription>
              {t("contacts.contact_group_description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t("contacts.semse_group_label")}</Label>
              <Select
                value={contactGroupForm.group_id}
                onValueChange={(value) => setContactGroupForm((prev) => ({ ...prev, group_id: value }))}
                disabled={!!editingContactGroup}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("contacts.select_semse_group_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {groups.filter((group) => group.kind === "operational").map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("contacts.name")}</Label>
              <Input
                value={contactGroupForm.name}
                onChange={(e) => setContactGroupForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("contacts.description_label")}</Label>
              <Textarea
                value={contactGroupForm.description}
                onChange={(e) => setContactGroupForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t("contacts.description_placeholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("contacts.existing_contact_groups")}</Label>
              <div className="border rounded-md p-2 max-h-[140px] overflow-y-auto space-y-1">
                {contactGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("contacts.no_contact_groups")}</p>
                ) : (
                  contactGroups.map((contactGroup) => (
                    <button
                      key={contactGroup.id}
                      type="button"
                      onClick={() => handleOpenEditContactGroup(contactGroup)}
                      className="w-full text-left px-2 py-1 rounded hover:bg-secondary text-sm"
                    >
                      {contactGroup.name} • {groups.find((group) => group.id === contactGroup.group_id)?.name || t("contacts.unknown_group")}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactGroupDialog(false)}>
              {t("contacts.cancel")}
            </Button>
            <Button onClick={handleSaveContactGroup} disabled={submitting}>
              {submitting ? t("contacts.saving") : t("contacts.save_contact_group")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GDPR Dialog */}
      <Dialog open={showGDPRDialog} onOpenChange={setShowGDPRDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("contacts.gdpr_title")}</DialogTitle>
            <DialogDescription>
              {t("contacts.gdpr_description")}
            </DialogDescription>
          </DialogHeader>

          {gdprData && (
            <div className="space-y-4">
              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">{t("contacts.contact_details")}</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>{t("contacts.prop_name")}</strong> {gdprData.name}</p>
                  <p><strong>{t("contacts.prop_phone")}</strong> {gdprData.phone}</p>
                  <p><strong>{t("contacts.prop_id")}</strong> {gdprData.id}</p>
                  <p><strong>{t("contacts.prop_group")}</strong> {groups.find(g => g.id === gdprData.group_id)?.name || t("contacts.unknown")}</p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
                  <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    {t("contacts.gdpr_deletion")}
                  </h3>
                  <p className="text-sm text-red-600 dark:text-red-300 mb-3">
                    {t("contacts.gdpr_deletion_warning")}
                  </p>

                  <Label htmlFor="gdpr-reason" className="text-sm font-medium">
                    {t("contacts.deletion_reason_label")}
                  </Label>
                  <Input
                    id="gdpr-reason"
                    placeholder={t("contacts.deletion_reason_placeholder")}
                    value={gdprDeletionReason}
                    onChange={(e) => setGdprDeletionReason(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleGDPRDeletion}
                  disabled={!gdprDeletionReason.trim() || submitting}
                >
                  {submitting ? t("contacts.deleting") : t("contacts.confirm_gdpr_deletion")}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGDPRDialog(false)}>
              {t("contacts.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
