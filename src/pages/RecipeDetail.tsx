import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Recipe, RecipeVersion, Substitution } from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeft, Download, RefreshCw, ExternalLink } from "lucide-react";

const RecipeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [versions, setVersions] = useState<RecipeVersion[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (id) {
      loadRecipe();
    }
  }, [id]);

  const loadRecipe = async () => {
    if (!id) return;
    
    setLoading(true);
    
    const { data: recipeData, error: recipeError } = await supabase
      .from("recipes")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (recipeError || !recipeData) {
      toast.error("Recipe not found");
      navigate("/");
      return;
    }

    const { data: versionsData } = await supabase
      .from("recipe_versions")
      .select("*")
      .eq("recipe_id", id)
      .order("created_at", { ascending: false });

    const { data: subsData } = await supabase
      .from("substitutions")
      .select("*")
      .eq("recipe_id", id);

    setRecipe(recipeData);
    setVersions((versionsData as RecipeVersion[]) || []);
    setSubstitutions(subsData?.map(s => ({
      ingredientName: s.ingredient_name,
      suggested_product: s.suggested_product,
      brand: s.brand,
      product_url: s.product_url || undefined,
      rationale: s.rationale
    })) || []);
    setLoading(false);
  };

  const handleConvert = async () => {
    if (!id) return;
    
    setConverting(true);
    const { data, error } = await supabase.functions.invoke(`convert-recipe`, {
      body: { recipeId: id }
    });

    if (error) {
      toast.error("Failed to convert recipe");
      console.error(error);
    } else {
      toast.success("Recipe converted to gluten-free!");
      await loadRecipe();
    }
    setConverting(false);
  };

  const handleExportPDF = async () => {
    const gfVersion = versions.find(v => v.kind === "gf_converted");
    if (!gfVersion) {
      toast.error("No gluten-free version available");
      return;
    }

    const { data, error } = await supabase.functions.invoke('export-pdf', {
      body: { recipeVersionId: gfVersion.id }
    });

    if (error) {
      toast.error("Failed to export PDF");
      console.error(error);
    } else {
      toast.success("PDF exported!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background flex items-center justify-center">
        <div className="text-center">Loading recipe...</div>
      </div>
    );
  }

  const parsedVersion = versions.find(v => v.kind === "parsed");
  const gfVersion = versions.find(v => v.kind === "gf_converted");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-4xl font-bold">{recipe?.title}</h1>
          <div className="flex gap-2">
            {!gfVersion && (
              <Button onClick={handleConvert} disabled={converting}>
                <RefreshCw className={`w-4 h-4 mr-2 ${converting ? 'animate-spin' : ''}`} />
                Convert to GF
              </Button>
            )}
            {gfVersion && (
              <Button variant="outline" onClick={handleExportPDF}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="original" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="original">Original</TabsTrigger>
            <TabsTrigger value="gf" disabled={!gfVersion}>
              Gluten-Free {!gfVersion && "(Convert first)"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="original">
            {parsedVersion && (
              <RecipeView 
                recipe={parsedVersion.payload} 
                substitutions={[]}
              />
            )}
          </TabsContent>

          <TabsContent value="gf">
            {gfVersion && (
              <RecipeView 
                recipe={gfVersion.payload} 
                substitutions={substitutions}
                originalRecipe={parsedVersion?.payload}
              />
            )}
          </TabsContent>
        </Tabs>

        {gfVersion && substitutions.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Canadian Brand Substitutions</CardTitle>
              <CardDescription>
                Recommended gluten-free products available in Canada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {substitutions.map((sub, index) => (
                <div key={index} className="border-l-4 border-secondary pl-4 py-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{sub.ingredientName}</Badge>
                        <span className="text-sm">→</span>
                        <Badge variant="success">{sub.suggested_product}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Brand: <strong>{sub.brand}</strong>
                      </p>
                      <p className="text-sm">{sub.rationale}</p>
                    </div>
                    {sub.product_url && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.open(sub.product_url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

interface RecipeViewProps {
  recipe: any;
  substitutions: Substitution[];
  originalRecipe?: any;
}

const RecipeView = ({ recipe, substitutions, originalRecipe }: RecipeViewProps) => {
  const isIngredientChanged = (ingredientName: string) => {
    if (!originalRecipe) return false;
    const originalIngredient = originalRecipe.ingredients.find(
      (ing: any) => ing.name.toLowerCase() === ingredientName.toLowerCase()
    );
    return !originalIngredient;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Ingredients</CardTitle>
          {recipe.yield && <CardDescription>Yield: {recipe.yield}</CardDescription>}
          {recipe.total_time && <CardDescription>Time: {recipe.total_time}</CardDescription>}
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing: any, index: number) => {
              const changed = isIngredientChanged(ing.name);
              return (
                <li 
                  key={index} 
                  className={`flex items-start gap-2 ${changed ? 'bg-success/10 p-2 rounded-md border-l-4 border-success' : ''}`}
                >
                  <span className="font-mono text-sm mt-0.5">•</span>
                  <span>
                    {ing.qty && <strong>{ing.qty} </strong>}
                    {ing.unit && <span>{ing.unit} </span>}
                    <span>{ing.name}</span>
                    {ing.mod && <span className="text-muted-foreground">, {ing.mod}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {recipe.steps.map((step: string, index: number) => (
              <li key={index} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </span>
                <span className="flex-1">{step}</span>
              </li>
            ))}
          </ol>
          {recipe.notes && (
            <div className="mt-6 p-4 bg-muted rounded-md">
              <p className="text-sm font-semibold mb-1">Notes:</p>
              <p className="text-sm text-muted-foreground">{recipe.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RecipeDetail;
