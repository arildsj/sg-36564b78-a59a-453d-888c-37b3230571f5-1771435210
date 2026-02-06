import React, { useState, useEffect } from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, ChevronDown, ChevronRight, Users, CheckCircle2, XCircle, Clock, Send, Plus, LayoutDashboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { bulkService, BulkCampaign } from "@/services/bulkService";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";

type CampaignWithDetails = BulkCampaign & {
  group_name?: string;
  created_by_name?: string;
};

export default function CampaignsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState<CampaignWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const { data: campaignsData, error } = await supabase
        .from("bulk_campaigns")
        .select(`
          *,
          groups!bulk_campaigns_target_group_id_fkey(name),
          users!bulk_campaigns_created_by_user_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped = (campaignsData || []).map((c: any) => ({
        ...c,
        group_name: c.groups?.name,
        created_by_name: c.users?.name
      }));

      setCampaigns(mapped);
    } catch (error: any) {
      console.error("Failed to load campaigns:", error);
      toast({
        title: "Feil ved lasting",
        description: error.message || "Kunne ikke laste kampanjer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (campaignId: string) => {
    setExpandedCampaign(expandedCampaign === campaignId ? null : campaignId);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "outline", label: t("campaigns.status.draft") },
      scheduled: { variant: "secondary", label: t("campaigns.status.scheduled") },
      sending: { variant: "default", label: t("campaigns.status.sending") },
      completed: { variant: "default", label: t("campaigns.status.completed") },
      failed: { variant: "destructive", label: t("campaigns.status.failed") }
    };

    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getSuccessRate = (campaign: BulkCampaign) => {
    if (campaign.total_recipients === 0) return 0;
    return Math.round((campaign.sent_count / campaign.total_recipients) * 100);
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>{t("campaigns.title")} - SeMSe 2.0</title>
        </Head>
        <AppLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">{t("common.loading")}</div>
          </div>
        </AppLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{t("campaigns.title")} - SeMSe 2.0</title>
      </Head>

      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">{t("campaigns.title")}</h1>
              <p className="text-muted-foreground mt-1">{t("campaigns.description")}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push('/campaigns/dashboard')}>
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <Button onClick={() => router.push("/sending")}>
                <Plus className="h-4 w-4 mr-2" />
                {t("campaigns.createNew")}
              </Button>
            </div>
          </div>

          {campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Megaphone className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">{t("campaigns.no_campaigns")}</h3>
                <p className="text-muted-foreground mb-4">
                  {t("campaigns.first_campaign")}
                </p>
                <Button onClick={() => router.push("/sending")}>
                  <Send className="h-4 w-4 mr-2" />
                  {t("campaigns.send_bulk")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="overflow-hidden">
                  <div
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleExpand(campaign.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-3">
                            {expandedCampaign === campaign.id ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              <CardTitle className="text-lg">
                                {campaign.subject_line || campaign.name}
                              </CardTitle>
                              {campaign.subject_line && campaign.subject_line !== campaign.name && (
                                <CardDescription className="mt-1">
                                  {campaign.name}
                                </CardDescription>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground ml-8">
                            <div className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5" />
                              <span>{campaign.group_name || "Ingen gruppe"}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {format(new Date(campaign.created_at), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}
                              </span>
                            </div>
                            {campaign.bulk_code && (
                              <Badge variant="outline" className="font-mono">
                                #{campaign.bulk_code}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 ml-4">
                          {getStatusBadge(campaign.status)}
                        </div>
                      </div>
                    </CardHeader>
                  </div>

                  {/* Stats bar - always visible */}
                  <div className="px-6 pb-4">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="space-y-1">
                        <div className="text-2xl font-bold">{campaign.total_recipients}</div>
                        <div className="text-xs text-muted-foreground">{t("campaigns.recipients")}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-2xl font-bold text-green-600">{campaign.sent_count}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{t("campaigns.sent")}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-1">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="text-2xl font-bold text-red-600">{campaign.failed_count}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{t("campaigns.failed")}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-bold">{getSuccessRate(campaign)}%</div>
                        <div className="text-xs text-muted-foreground">{t("campaigns.success")}</div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded content - placeholder for next step */}
                  {expandedCampaign === campaign.id && (
                    <div className="border-t bg-muted/20 p-6">
                      <div className="text-sm text-muted-foreground mb-4">
                        <strong>{t("campaigns.message_sent")}:</strong>
                        <div className="mt-2 p-3 bg-background rounded border">
                          {campaign.message_template}
                        </div>
                      </div>
                      
                      <div className="text-center text-muted-foreground py-8">
                        {t("campaigns.responses_coming")}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
    </>
  );
}