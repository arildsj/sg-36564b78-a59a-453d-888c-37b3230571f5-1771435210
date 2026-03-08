import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function DeployFunctionPage() {
  const [isDeploying, setIsDeploying] = useState(false);
  const { toast } = useToast();

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const response = await fetch("/api/deploy-edge-function", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          functionName: "inbound-message",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Deployment failed");
      }

      toast({
        title: "✅ Deployment Successful",
        description: "Edge Function 'inbound-message' has been deployed successfully!",
      });
    } catch (error: unknown) {
      console.error("Deployment error:", error);
      toast({
        title: "❌ Deployment Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Deploy Edge Function</CardTitle>
          <CardDescription>
            Deploy the updated inbound-message Edge Function to Supabase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Function: inbound-message</h3>
            <p className="text-sm text-muted-foreground">
              This will deploy the latest version of the inbound-message Edge Function with the following fixes:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
              <li>Fixed JSONB conditions field usage</li>
              <li>Removed non-existent rule_type column</li>
              <li>Dynamic rule type detection from conditions</li>
              <li>Improved routing logic</li>
            </ul>
          </div>

          <Button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="w-full"
            size="lg"
          >
            {isDeploying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deploying...
              </>
            ) : (
              "Deploy Now"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Note: This requires SUPABASE_SERVICE_ROLE_KEY in .env.local
          </p>
        </CardContent>
      </Card>
    </div>
  );
}