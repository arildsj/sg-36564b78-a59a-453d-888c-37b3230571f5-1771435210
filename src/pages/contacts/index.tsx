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
import { Phone, Mail, Building2, Users, Plus, Edit, Trash2, Search, Upload, UserPlus, Pencil } from "lucide-react";
import { contactService, type Contact, type ContactGroup } from "@/services/contactService";
import { useToast } from "@/hooks/use-toast";
import { groupService } from "@/services/groupService";

type Group = {
  id: string;
  name: string;
  kind: string;
};

export default function ContactsPage() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importGroupId, setImportGroupId] = useState<string>("");
  
  // Edit/Create state
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    is_whitelisted: true,
    group_ids: [] as string[],
  });
  
  // Relationship state
  const [relationships, setRelationships] = useState<{
    asRelated: any[],
    asSubject: any[]
  }>({ asRelated: [], asSubject: [] });
  const [newRelSubject, setNewRelSubject] = useState("");
  const [newRelType, setNewRelType] = useState("Foresatt");
  const [isSearchingRel, setIsSearchingRel] = useState(false);
  const [relSearchResults, setRelSearchResults] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [contactsData, groupsData] = await Promise.all([
        contactService.getAllContacts(),
        groupService.getAllGroups(),
      ]);
      setContacts(contactsData as Contact[]);
      setGroups(groupsData as Group[]);
    } catch (error) {
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
      email: "",
      is_whitelisted: true,
      group_ids: [],
    });
    setShowDialog(true);
  };

  const handleOpenEdit = async (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || "",
      is_whitelisted: contact.is_whitelisted,
      group_ids: contact.groups.map(g => g.id),
    });
    
    // Load relationships
    try {
      const rels = await contactService.getRelationships(contact.id);
      setRelationships(rels);
    } catch (e) {
      console.error("Failed to load relationships", e);
      setRelationships({ asRelated: [], asSubject: [] });
    }
    
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      if (!formData.name.trim() || !formData.phone.trim()) {
        toast("Vennligst fyll ut navn og telefon", { variant: "destructive" });
        return;
      }

      if (editingContact) {
        await contactService.updateContact(editingContact.id, {
          name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          is_whitelisted: formData.is_whitelisted,
          group_ids: formData.group_ids,
        });
      } else {
        await contactService.createContact({
          name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          is_whitelisted: formData.is_whitelisted,
          group_ids: formData.group_ids,
        });
      }

      setShowDialog(false);
      await loadData();
    } catch (error: any) {
      console.error("Failed to save contact:", error);
      toast(`Feil ved lagring: ${error.message || "Ukjent feil"}`, { variant: "destructive" });
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
      toast(`Feil ved sletting: ${error.message}`, { variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };
  
  const searchPotentialRelations = async (query: string) => {
    setNewRelSubject(query);
    if (query.length < 2) {
      setRelSearchResults([]);
      return;
    }
    
    setIsSearchingRel(true);
    try {
      // Use existing search but filter in UI or backend ideally
      // For now reusing searchContacts which searches whitelisted numbers
      const results = await contactService.searchContacts(query);
      setRelSearchResults(results.filter(c => c.id !== editingContact?.id));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingRel(false);
    }
  };

  const handleAddRelationship = async (subjectId: string) => {
    if (!editingContact) return;
    try {
      await contactService.addRelationship(subjectId, editingContact.id, newRelType);
      const rels = await contactService.getRelationships(editingContact.id);
      setRelationships(rels);
      setNewRelSubject("");
      setRelSearchResults([]);
    } catch (e) {
      console.error(e);
      toast("Kunne ikke legge til relasjon", { variant: "destructive" });
    }
  };

  const handleRemoveRelationship = async (relId: string) => {
    if (!editingContact) return;
    try {
      await contactService.removeRelationship(relId);
      const rels = await contactService.getRelationships(editingContact.id);
      setRelationships(rels);
    } catch (e) {
      console.error(e);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    
    try {
      setSubmitting(true);
      await contactService.importContacts(importFile, importGroupId || undefined);
      setShowImportDialog(false);
      setImportFile(null);
      setImportGroupId("");
      await loadData();
      toast({
        title: "Import fullført!",
        description: "Kontaktene er importert.",
      });
    } catch (error: any) {
      console.error("Import failed:", error);
      toast({
        title: "Import feilet",
        description: error.message || "En feil oppstod under import",
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

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne kontakten?")) return;

    try {
      await contactService.deleteContact(contactId);
      loadContacts();
      toast({
        title: "Kontakt slettet",
        description: "Kontakten er fjernet",
      });
    } catch (error) {
      console.error("Failed to delete contact:", error);
      toast({
        title: "Feil ved sletting",
        description: "Kunne ikke slette kontakt",
        variant: "destructive",
      });
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne gruppen?")) return;

    try {
      await contactService.deleteContactGroup(groupId);
      loadGroups();
      toast({
        title: "Gruppe slettet",
        description: "Gruppen er fjernet",
      });
    } catch (error) {
      console.error("Failed to delete group:", error);
      toast({
        title: "Feil ved sletting",
        description: "Kunne ikke slette gruppe",
        variant: "destructive",
      });
    }
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery) ||
      (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleGroupSelection = (groupId: string) => {
    setFormData((prev) => ({
      ...prev,
      group_ids: prev.group_ids.includes(groupId)
        ? prev.group_ids.filter((id) => id !== groupId)
        : [...prev.group_ids, groupId],
    }));
  };

  const handleSaveGroup = async () => {
    try {
      if (!newGroup.name) {
        toast({
          title: "Mangler navn",
          description: "Gruppenavn er påkrevd",
          variant: "destructive",
        });
        return;
      }

      if (editingGroup) {
        await contactService.updateContactGroup(editingGroup.id, newGroup);
        toast({
          title: "Gruppe oppdatert",
          description: "Gruppen er oppdatert",
        });
      } else {
        await contactService.createContactGroup(newGroup);
        toast({
          title: "Gruppe opprettet",
          description: "Ny gruppe er opprettet",
        });
      }

      setGroupDialogOpen(false);
      resetGroupForm();
      loadGroups();
    } catch (error) {
      console.error("Failed to save group:", error);
      toast({
        title: "Feil ved lagring",
        description: "Kunne ikke lagre gruppe",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Head>
        <title>Kontakter | SeMSe</title>
        <meta name="description" content="Administrer kontakter og hvitlistede nummer" />
      </Head>

      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Kontakter</h2>
              <p className="text-muted-foreground mt-2">
                Administrer kontakter og hvitlistede telefonnummer.
              </p>
            </div>
            <Button className="gap-2" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" />
              Legg til kontakt
            </Button>
            <Button variant="outline" className="gap-2 ml-2" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4" />
              Importer
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Søk i kontakter</CardTitle>
              <CardDescription>
                Finn kontakter basert på navn, telefonnummer eller e-post.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Søk etter navn, telefon eller e-post..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kontaktliste ({filteredContacts.length})</CardTitle>
              <CardDescription>
                Alle registrerte kontakter i systemet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Laster kontakter...</p>
                </div>
              ) : filteredContacts.length === 0 && searchQuery === "" ? (
                <div className="text-center py-12">
                  <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Ingen kontakter registrert ennå</p>
                  <Button variant="outline" className="gap-2" onClick={handleOpenCreate}>
                    <Plus className="h-4 w-4" />
                    Legg til første kontakt
                  </Button>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Ingen kontakter funnet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Navn</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Grupper</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact) => (
                      <TableRow key={contact.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {contact.phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {contact.groups && contact.groups.length > 0 ? (
                              contact.groups.map((group) => (
                                <Badge key={group.id} variant="secondary">
                                  {group.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">Ingen grupper</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact.is_whitelisted ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">Hvitlistet</Badge>
                          ) : (
                            <Badge variant="outline">Ikke hvitlistet</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(contact)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => confirmDelete(contact)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Rediger kontakt" : "Legg til ny kontakt"}
            </DialogTitle>
            <DialogDescription>
              {editingContact 
                ? "Oppdater kontaktinformasjon og gruppetilhørighet."
                : "Opprett en ny kontakt og tildel til relevante grupper."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Navn *</Label>
                <Input
                  id="contact-name"
                  placeholder="F.eks. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Telefon *</Label>
                <Input
                  id="contact-phone"
                  placeholder="+47 123 45 678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Gruppetilhørighet (Routing)</Label>
              <div className="border rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto bg-card">
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen grupper tilgjengelig</p>
                ) : (
                  groups.filter(g => g.kind === 'operational').map((group) => (
                    <label key={group.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-accent rounded-md transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.group_ids.includes(group.id)}
                        onChange={() => toggleGroupSelection(group.id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{group.name}</span>
                        <span className="text-xs text-muted-foreground">Operasjonell gruppe</span>
                      </div>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Velg hvilke grupper denne kontakten tilhører. Meldinger fra dette nummeret vil automatisk bli rutet til disse gruppene.
              </p>
            </div>
            
            {editingContact && (
              <div className="space-y-2 border-t pt-4">
                <Label>Relasjoner</Label>
                <div className="text-sm text-muted-foreground mb-2">
                  Koble denne kontakten til andre (f.eks. barn/elever).
                </div>
                
                {/* List existing relationships */}
                <div className="space-y-2 mb-4">
                  {relationships.asRelated.map((rel: any) => (
                    <div key={rel.id} className="flex items-center justify-between bg-secondary/20 p-2 rounded">
                      <div className="flex items-center gap-2">
                         <Badge variant="outline">{rel.relationship_type}</Badge>
                         <span>til <strong>{rel.subject?.name}</strong></span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveRelationship(rel.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {relationships.asRelated.length === 0 && (
                    <div className="text-sm text-muted-foreground italic">Ingen relasjoner registrert.</div>
                  )}
                </div>

                {/* Add new relationship */}
                <div className="flex flex-col gap-2 p-3 bg-secondary/10 rounded-md">
                  <span className="text-sm font-medium">Legg til ny relasjon:</span>
                  <div className="flex gap-2">
                    <select 
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                      value={newRelType}
                      onChange={(e) => setNewRelType(e.target.value)}
                    >
                      <option value="Foresatt">Foresatt</option>
                      <option value="Mor">Mor</option>
                      <option value="Far">Far</option>
                      <option value="Verge">Verge</option>
                      <option value="Søsken">Søsken</option>
                      <option value="Annet">Annet</option>
                    </select>
                    <div className="relative flex-1">
                      <Input 
                        placeholder="Søk etter navn..." 
                        value={newRelSubject}
                        onChange={(e) => searchPotentialRelations(e.target.value)}
                        className="h-9"
                      />
                      {relSearchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-popover text-popover-foreground border rounded-md shadow-md mt-1 z-50 max-h-40 overflow-y-auto">
                          {relSearchResults.map(res => (
                            <div 
                              key={res.id}
                              className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                              onClick={() => handleAddRelationship(res.id)}
                            >
                              {res.name} {res.phone ? `(${res.phone})` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Søk opp personen denne kontakten er {newRelType?.toLowerCase()} til.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={submitting}>
              Avbryt
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Lagrer..." : (editingContact ? "Lagre endringer" : "Legg til kontakt")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil fjerne <strong>{editingContact?.name}</strong> ({editingContact?.phone}) fra hvitelisten.
              Meldinger fra dette nummeret vil heretter bli behandlet som ukjente og gå til manuell fordeling.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {submitting ? "Sletter..." : "Ja, slett kontakt"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer kontakter</DialogTitle>
            <DialogDescription>
              Last opp en CSV-fil med kontakter. Støtter kolonner som Navn, Telefon, Epost, Gruppe, Relasjon, Tilhører.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Velg fil (CSV)</Label>
              <Input 
                type="file" 
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)} 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Standard gruppe (valgfritt)</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={importGroupId}
                onChange={(e) => setImportGroupId(e.target.value)}
              >
                <option value="">Ingen gruppe valgt</option>
                {groups.filter(g => g.kind === 'operational').map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Alle kontakter i filen vil bli lagt til i denne gruppen hvis ikke "Gruppe" er spesifisert i filen.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={submitting}>
              Avbryt
            </Button>
            <Button onClick={handleImport} disabled={!importFile || submitting}>
              {submitting ? "Importerer..." : "Start import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}