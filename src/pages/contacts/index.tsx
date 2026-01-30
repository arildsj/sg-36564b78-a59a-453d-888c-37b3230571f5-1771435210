import React, { useEffect, useState } from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Phone, Mail, UserPlus } from "lucide-react";
import { contactService } from "@/services/contactService";
import { groupService } from "@/services/groupService";

type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  is_whitelisted: boolean;
  groups: Array<{ id: string; name: string }>;
};

type Group = {
  id: string;
  name: string;
  kind: string;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newContact, setNewContact] = useState({
    name: "",
    phone: "",
    email: "",
    is_whitelisted: true,
    group_ids: [] as string[],
  });

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

  const handleCreateContact = async () => {
    try {
      setCreating(true);

      if (!newContact.name.trim() || !newContact.phone.trim()) {
        alert("Vennligst fyll ut navn og telefon");
        return;
      }

      await contactService.createContact({
        name: newContact.name,
        phone: newContact.phone,
        email: newContact.email || null,
        is_whitelisted: newContact.is_whitelisted,
        group_ids: newContact.group_ids,
      });

      setNewContact({
        name: "",
        phone: "",
        email: "",
        is_whitelisted: true,
        group_ids: [],
      });
      setShowCreateDialog(false);
      await loadData();
    } catch (error: any) {
      console.error("Failed to create contact:", error);
      alert(`Feil ved opprettelse: ${error.message || "Ukjent feil"}`);
    } finally {
      setCreating(false);
    }
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery) ||
      (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleGroupSelection = (groupId: string) => {
    setNewContact((prev) => ({
      ...prev,
      group_ids: prev.group_ids.includes(groupId)
        ? prev.group_ids.filter((id) => id !== groupId)
        : [...prev.group_ids, groupId],
    }));
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
            <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              Legg til kontakt
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
                  <Button variant="outline" className="gap-2" onClick={() => setShowCreateDialog(true)}>
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
                      <TableHead>E-post</TableHead>
                      <TableHead>Grupper</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact) => (
                      <TableRow key={contact.id} className="hover:bg-accent">
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {contact.phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact.email ? (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {contact.email}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
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
                            <Badge variant="default">Hvitlistet</Badge>
                          ) : (
                            <Badge variant="outline">Ikke hvitlistet</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="gap-2">
                            Rediger
                          </Button>
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

      {/* Create Contact Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Legg til ny kontakt</DialogTitle>
            <DialogDescription>
              Opprett en ny kontakt og tildel til relevante grupper.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Navn *</Label>
                <Input
                  id="contact-name"
                  placeholder="F.eks. John Doe"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Telefon *</Label>
                <Input
                  id="contact-phone"
                  placeholder="+47 123 45 678"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">E-post (valgfri)</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="john.doe@example.com"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Gruppetilhørighet (valgfri)</Label>
              <div className="border rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen grupper tilgjengelig</p>
                ) : (
                  groups.map((group) => (
                    <label key={group.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newContact.group_ids.includes(group.id)}
                        onChange={() => toggleGroupSelection(group.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{group.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {group.kind === "operational" ? "Operasjonell" : "Strukturell"}
                      </Badge>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="contact-whitelist"
                checked={newContact.is_whitelisted}
                onChange={(e) => setNewContact({ ...newContact, is_whitelisted: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="contact-whitelist" className="cursor-pointer">
                Hvitlist kontakten (tillat meldinger uten moderering)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>
              Avbryt
            </Button>
            <Button onClick={handleCreateContact} disabled={creating}>
              {creating ? "Oppretter..." : "Legg til kontakt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}