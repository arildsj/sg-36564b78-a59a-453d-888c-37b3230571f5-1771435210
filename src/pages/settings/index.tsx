import React from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, MessageSquare, Bell, Save, Network } from "lucide-react";
import { RoutingRulesTab } from "@/components/settings/RoutingRulesTab";
import { useLanguage } from "@/contexts/LanguageProvider";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState("hours");
  const { t } = useLanguage();

  return (
    <>
      <Head>
        <title>{t("settings.title")} | SeMSe</title>
        <meta name="description" content={t("settings.description")} />
      </Head>

      <AppLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("settings.title")}</h2>
            <p className="text-muted-foreground mt-2">
              {t("settings.description")}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 lg:w-auto">
              <TabsTrigger value="hours" className="gap-2">
                <Clock className="h-4 w-4" />
                {t("settings.tabs.hours")}
              </TabsTrigger>
              <TabsTrigger value="replies" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                {t("settings.tabs.replies")}
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="h-4 w-4" />
                {t("settings.tabs.notifications")}
              </TabsTrigger>
              <TabsTrigger value="routing" className="gap-2">
                <Network className="h-4 w-4" />
                {t("settings.tabs.routing")}
              </TabsTrigger>
            </TabsList>

            {/* Opening Hours Tab */}
            <TabsContent value="hours" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t("settings.tabs.hours")}</CardTitle>
                  <CardDescription>
                    {t("settings.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="group-select">{t("settings.select_group")}</Label>
                    <Select defaultValue="kundeservice">
                      <SelectTrigger id="group-select" className="focus:ring-2 focus:ring-primary">
                        <SelectValue placeholder="Velg en gruppe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kundeservice">Kundeservice</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="salg">Salg</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4 border rounded-lg p-4">
                    <h3 className="font-semibold">{t("settings.weekly_schedule")}</h3>
                    {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                      <div key={day} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <Label className="font-medium">{t(`days.${day}`)}</Label>
                        <div className="flex items-center gap-2">
                          <Switch id={`${day}-enabled`} defaultChecked={day !== "sunday"} />
                          <Label htmlFor={`${day}-enabled`} className="text-sm text-muted-foreground">
                            {t("settings.open")}
                          </Label>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`${day}-from`} className="text-xs">
                            {t("settings.from")}
                          </Label>
                          <Input
                            type="time"
                            id={`${day}-from`}
                            defaultValue="09:00"
                            className="focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`${day}-to`} className="text-xs">
                            {t("settings.to")}
                          </Label>
                          <Input
                            type="time"
                            id={`${day}-to`}
                            defaultValue="16:00"
                            className="focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 border rounded-lg p-4">
                    <h3 className="font-semibold">{t("settings.special_days")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.special_days_help")}
                    </p>
                    <Button variant="outline">{t("settings.add_exception")}</Button>
                  </div>

                  <div className="flex justify-end">
                    <Button className="gap-2">
                      <Save className="h-4 w-4" />
                      {t("settings.save_hours")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Auto Replies Tab */}
            <TabsContent value="replies" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t("settings.tabs.replies")}</CardTitle>
                  <CardDescription>
                    {t("settings.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="reply-group-select">{t("settings.select_group")}</Label>
                    <Select defaultValue="kundeservice">
                      <SelectTrigger id="reply-group-select" className="focus:ring-2 focus:ring-primary">
                        <SelectValue placeholder={t("settings.select_group")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kundeservice">Kundeservice</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="salg">Salg</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4 border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{t("settings.outside_hours")}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("settings.outside_hours_help")}
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="outside-hours-message">{t("settings.message")}</Label>
                      <Textarea
                        id="outside-hours-message"
                        rows={4}
                        className="focus:ring-2 focus:ring-primary"
                        defaultValue="Takk for din henvendelse. Vi har stengt for i dag, men svarer så snart vi åpner igjen."
                      />
                    </div>
                  </div>

                  <div className="space-y-4 border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{t("settings.first_message")}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("settings.first_message_help")}
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="first-message">{t("settings.message")}</Label>
                      <Textarea
                        id="first-message"
                        rows={4}
                        className="focus:ring-2 focus:ring-primary"
                        defaultValue="Velkommen! Vi har mottatt din melding og svarer så snart som mulig."
                      />
                    </div>
                  </div>

                  <div className="space-y-4 border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{t("settings.keyword_based")}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("settings.keyword_based_help")}
                        </p>
                      </div>
                      <Switch />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="keywords">{t("settings.keywords")}</Label>
                      <Input
                        id="keywords"
                        placeholder="hjelp, support, akutt"
                        className="focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="keyword-message">{t("settings.message")}</Label>
                      <Textarea
                        id="keyword-message"
                        rows={4}
                        className="focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button className="gap-2">
                      <Save className="h-4 w-4" />
                      {t("settings.save_replies")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t("settings.tabs.notifications")}</CardTitle>
                  <CardDescription>
                    {t("settings.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h3 className="font-semibold">{t("settings.email_notifications")}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("settings.email_notifications_help")}
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h3 className="font-semibold">{t("settings.push_notifications")}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("settings.push_notifications_help")}
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h3 className="font-semibold">{t("settings.sms_notifications")}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("settings.sms_notifications_help")}
                        </p>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{t("settings.only_on_duty")}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("settings.only_on_duty_help")}
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button className="gap-2">
                      <Save className="h-4 w-4" />
                      {t("settings.save_settings")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Routing Rules Tab */}
            <TabsContent value="routing" className="space-y-4">
              <RoutingRulesTab />
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </>
  );
}