import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, Users, Clock, AlertCircle } from "lucide-react";
import { groupService } from "@/services/groupService";
import { messageService } from "@/services/messageService";
import { userService } from "@/services/userService";

export default function HomePage() {
  const [stats, setStats] = useState({
    unacknowledged: 0,
    operationalGroups: 0,
    onDutyUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [unackMessages, groups] = await Promise.all([
          messageService.getUnacknowledgedMessages(),
          groupService.getOperationalGroups(),
        ]);

        let totalOnDuty = 0;
        for (const group of groups) {
          const onDutyUsers = await userService.getOnDutyUsersForGroup(group.id);
          totalOnDuty += onDutyUsers.length;
        }

        setStats({
          unacknowledged: unackMessages.length,
          operationalGroups: groups.length,
          onDutyUsers: totalOnDuty,
        });
      } catch (error) {
        console.error("Failed to load stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  return (
    <>
      <Head>
        <title>Dashboard - SeMSe 2.0</title>
        <meta name="description" content="SeMSe + FairGateway Dashboard" />
      </Head>

      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Oversikt over meldinger og operasjoner
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-2 hover:border-primary transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Ubehandlede meldinger</CardTitle>
                <Inbox className="h-5 w-5 text-primary" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {loading ? "..." : stats.unacknowledged}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Venter på bekreftelse
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Operative grupper</CardTitle>
                <Users className="h-5 w-5 text-primary" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {loading ? "..." : stats.operationalGroups}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Aktive innbokser
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">On-duty brukere</CardTitle>
                <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {loading ? "..." : stats.onDutyUsers}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Aktive operatører
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Gjennomsnittlig svartid</CardTitle>
                <AlertCircle className="h-5 w-5 text-primary" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">12 min</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Siste 24 timer
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Siste meldinger</CardTitle>
                <CardDescription>
                  Nyeste inngående meldinger på tvers av grupper
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loading ? (
                    <p className="text-muted-foreground text-center py-8">Laster...</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between border-b pb-3">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">+47 987 65 432</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Hei, jeg lurer på status på min bestilling?
                          </p>
                        </div>
                        <Badge variant="outline" className="ml-2">2t siden</Badge>
                      </div>
                      <div className="flex items-start justify-between border-b pb-3">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">+47 998 87 766</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Hva er prisen på deres tjeneste?
                          </p>
                        </div>
                        <Badge variant="destructive" className="ml-2">10 min</Badge>
                      </div>
                    </div>
                  )}
                  <Link href="/inbox">
                    <Button variant="outline" className="w-full mt-4">
                      Se alle meldinger
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vakt-status</CardTitle>
                <CardDescription>
                  Oversikt over on-duty dekning per gruppe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loading ? (
                    <p className="text-muted-foreground text-center py-8">Laster...</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div>
                          <p className="font-medium text-foreground">Kundeservice</p>
                          <p className="text-sm text-muted-foreground">1 on-duty</p>
                        </div>
                        <Badge variant="default">Åpen</Badge>
                      </div>
                      <div className="flex items-center justify-between border-b pb-3">
                        <div>
                          <p className="font-medium text-foreground">Teknisk Support</p>
                          <p className="text-sm text-muted-foreground">1 on-duty</p>
                        </div>
                        <Badge variant="default">Åpen</Badge>
                      </div>
                    </div>
                  )}
                  <Link href="/admin">
                    <Button variant="outline" className="w-full mt-4">
                      Administrer grupper
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    </>
  );
}