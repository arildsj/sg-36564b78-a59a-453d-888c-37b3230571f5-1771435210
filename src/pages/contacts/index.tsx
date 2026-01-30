import React from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Phone, Mail, UserPlus } from "lucide-react";

// Mock data
const MOCK_CONTACTS = [
  {
    id: "1",
    name: "John Doe",
    phone: "+47 123 45 678",
    email: "john.doe@example.com",
    groups: ["Kundeservice", "Support"],
    is_whitelisted: true,
  },
  {
    id: "2",
    name: "Jane Smith",
    phone: "+47 987 65 432",
    email: "jane.smith@example.com",
    groups: ["Support"],
    is_whitelisted: true,
  },
  {
    id: "3",
    name: "Ukjent kontakt",
    phone: "+47 555 12 345",
    email: null,
    groups: [],
    is_whitelisted: false,
  },
];

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredContacts = MOCK_CONTACTS.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery) ||
      (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
            <Button className="gap-2">
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
                          {contact.groups.length > 0 ? (
                            contact.groups.map((group, idx) => (
                              <Badge key={idx} variant="secondary">
                                {group}
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

              {filteredContacts.length === 0 && (
                <div className="text-center py-12">
                  <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Ingen kontakter funnet</p>
                  <Button variant="outline" className="mt-4 gap-2">
                    <Plus className="h-4 w-4" />
                    Legg til ny kontakt
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </>
  );
}