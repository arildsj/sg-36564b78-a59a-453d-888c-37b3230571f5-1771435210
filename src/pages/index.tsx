import React from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Clock, Users, ArrowRight } from "lucide-react";

// Mock data for dashboard
const STATS = [
  { label: "Ubehandlede meldinger", value: "12", icon: MessageSquare, color: "text-blue-600" },
  { label: "Gjennomsnittlig svartid", value: "4m 30s", icon: Clock, color: "text-green-600" },
  { label: "Aktive operatører", value: "3", icon: Users, color: "text-purple-600" },
];

export default function DashboardPage() {
  return (
    <>
      <Head>
        <title>Oversikt | SeMSe</title>
        <meta name="description" content="Dashboard oversikt for SeMSe" />
      </Head>

      <AppLayout>
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Oversikt</h2>
            <p className="text-muted-foreground mt-2">Velkommen tilbake. Her er status for dine innbokser.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-3">
            {STATS.map((stat, index) => (
              <Card key={index} className="border-l-4 border-l-primary shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Activity / Actions */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4 shadow-sm">
              <CardHeader>
                <CardTitle>Innboks Status</CardTitle>
                <CardDescription>
                  Innbokser som krever din oppmerksomhet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Mock Inbox Item */}
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-primary">Kundeservice (Operativ)</span>
                        <span className="text-sm text-muted-foreground">Siste melding for 15 min siden</span>
                      </div>
                      <Button variant="outline" className="gap-2 group">
                        Gå til innboks
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-3 shadow-sm">
              <CardHeader>
                <CardTitle>Dine Vakter</CardTitle>
                <CardDescription>
                  Du er logget på følgende grupper.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <span className="font-medium">Support Nivå 1</span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">Logg av</Button>
                   </div>
                   <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="h-3 w-3 rounded-full bg-gray-300" />
                        <span className="font-medium text-muted-foreground">Salg (Stengt)</span>
                      </div>
                      <Button variant="ghost" size="sm">Logg på</Button>
                   </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    </>
  );
}