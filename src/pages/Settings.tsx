import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <h1 className="text-4xl font-bold mb-6">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Preferred Brands</CardTitle>
            <CardDescription>
              Customize which Canadian gluten-free brands you prefer (Coming soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This feature will allow you to set your preferred Canadian gluten-free brands
              for automatic substitutions.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
