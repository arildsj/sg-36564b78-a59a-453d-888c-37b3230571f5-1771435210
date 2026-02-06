import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Send, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageSquare, 
  Users,
  TrendingUp,
  Calendar,
  RefreshCw
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tables } from "@/integrations/supabase/types";

type BulkCampaign = Tables<"bulk_campaigns">;
type BulkRecipient = Tables<"bulk_recipients">;

interface CampaignStats {
  id: string;
  name: string;
  target_group_name: string;
  status: string;
  created_at: string;
  total_recipients: number;
  sent: number;
  delivered: number;
  replied: number;
  failed: number;
  response_rate: number;
}

interface OverallStats {
  total_campaigns: number;
  active_campaigns: number;
  total_sent: number;
  total_replied: number;
  overall_response_rate: number;
  avg_delivery_rate: number;
}

export default function CampaignDashboard() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [campaignStats, setCampaignStats] = useState<CampaignStats[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats>({
    total_campaigns: 0,
    active_campaigns: 0,
    total_sent: 0,
    total_replied: 0,
    overall_response_rate: 0,
    avg_delivery_rate: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch all campaigns with their recipients
      const { data: campaigns, error: campaignsError } = await supabase
        .from("bulk_campaigns")
        .select(`
          *,
          groups!bulk_campaigns_target_group_id_fkey(name),
          bulk_recipients(*)
        `)
        .order("created_at", { ascending: false });

      if (campaignsError) throw campaignsError;

      // Calculate stats for each campaign
      const stats: CampaignStats[] = (campaigns || []).map((campaign: any) => {
        const recipients = campaign.bulk_recipients || [];
        const total = recipients.length;
        const sent = recipients.filter((r: BulkRecipient) => r.status !== "pending").length;
        const delivered = recipients.filter((r: BulkRecipient) => r.status === "delivered" || r.status === "replied").length;
        const replied = recipients.filter((r: BulkRecipient) => r.status === "replied").length;
        const failed = recipients.filter((r: BulkRecipient) => r.status === "failed").length;
        const response_rate = sent > 0 ? Math.round((replied / sent) * 100) : 0;

        return {
          id: campaign.id,
          name: campaign.name,
          target_group_name: campaign.groups?.name || "Unknown",
          status: campaign.status,
          created_at: campaign.created_at,
          total_recipients: total,
          sent,
          delivered,
          replied,
          failed,
          response_rate,
        };
      });

      setCampaignStats(stats);

      // Calculate overall stats
      const totalCampaigns = stats.length;
      const activeCampaigns = stats.filter(s => s.status === "active" || s.status === "running").length;
      const totalSent = stats.reduce((sum, s) => sum + s.sent, 0);
      const totalReplied = stats.reduce((sum, s) => sum + s.replied, 0);
      const overallResponseRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;
      const totalDelivered = stats.reduce((sum, s) => sum + s.delivered, 0);
      const avgDeliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

      setOverallStats({
        total_campaigns: totalCampaigns,
        active_campaigns: activeCampaigns,
        total_sent: totalSent,
        total_replied: totalReplied,
        overall_response_rate: overallResponseRate,
        avg_delivery_rate: avgDeliveryRate,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "Draft", variant: "secondary" as const, icon: Clock },
      active: { label: "Active", variant: "default" as const, icon: Send },
      completed: { label: "Completed", variant: "default" as const, icon: CheckCircle },
      failed: { label: "Failed", variant: "destructive" as const, icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Campaign Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Monitor your bulk SMS campaigns and track performance
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadDashboardData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => router.push("/campaigns")}>
              <Send className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </div>

        {/* Overall Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.total_campaigns}</div>
              <p className="text-xs text-muted-foreground">
                {overallStats.active_campaigns} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.total_sent}</div>
              <p className="text-xs text-muted-foreground">
                {overallStats.avg_delivery_rate}% delivered
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Responses</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.total_replied}</div>
              <p className="text-xs text-muted-foreground">
                {overallStats.overall_response_rate}% response rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.overall_response_rate}%</div>
              <Progress 
                value={overallStats.overall_response_rate} 
                className="mt-2"
              />
            </CardContent>
          </Card>
        </div>

        {/* Campaign List */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>
              Detailed statistics for each bulk SMS campaign
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {campaignStats.length === 0 ? (
                <div className="text-center py-12">
                  <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first bulk SMS campaign to see statistics here
                  </p>
                  <Button onClick={() => router.push("/campaigns")}>
                    Create Campaign
                  </Button>
                </div>
              ) : (
                campaignStats.map((campaign) => (
                  <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{campaign.name}</CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <Users className="h-3 w-3" />
                            {campaign.target_group_name}
                            <span className="text-xs">•</span>
                            {new Date(campaign.created_at).toLocaleDateString("nb-NO", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </CardDescription>
                        </div>
                        {getStatusBadge(campaign.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Statistics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold">{campaign.total_recipients}</div>
                            <div className="text-xs text-muted-foreground">Recipients</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{campaign.sent}</div>
                            <div className="text-xs text-muted-foreground">Sent</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{campaign.delivered}</div>
                            <div className="text-xs text-muted-foreground">Delivered</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">{campaign.replied}</div>
                            <div className="text-xs text-muted-foreground">Replied</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">{campaign.failed}</div>
                            <div className="text-xs text-muted-foreground">Failed</div>
                          </div>
                        </div>

                        {/* Progress Bars */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Delivery Rate</span>
                            <span className="font-medium">
                              {campaign.sent > 0 
                                ? Math.round((campaign.delivered / campaign.sent) * 100)
                                : 0}%
                            </span>
                          </div>
                          <Progress 
                            value={campaign.sent > 0 ? (campaign.delivered / campaign.sent) * 100 : 0}
                            className="h-2"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Response Rate</span>
                            <span className="font-medium">{campaign.response_rate}%</span>
                          </div>
                          <Progress 
                            value={campaign.response_rate}
                            className="h-2"
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => router.push(`/campaigns?view=${campaign.id}`)}
                          >
                            View Details
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => router.push(`/inbox?campaign=${campaign.id}`)}
                          >
                            View Responses
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}