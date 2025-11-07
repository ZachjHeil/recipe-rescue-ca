import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the user from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { fileUrl } = await req.json();

    console.log('Processing upload for user:', user.id);

    // Mock OCR extraction
    const extractTextFromFile = async (_fileUrl: string): Promise<string> => {
      return `
Example Banana Bread
Yield: 1 loaf
Time: 1h 10m

Ingredients:
- 1 1/2 cups all-purpose flour
- 1 tsp baking soda
- 1/2 tsp salt
- 3 ripe bananas, mashed
- 1/2 cup melted butter
- 3/4 cup sugar
- 1 egg, beaten

Steps:
1) Preheat oven to 350F.
2) Mix dry ingredients.
3) Mix wet ingredients and fold into dry.
4) Bake 55-60 minutes.
`;
    };

    // Mock parser
    const parseRecipeFromOcr = (text: string) => {
      return {
        title: "Example Banana Bread",
        yield: "1 loaf",
        total_time: "1h 10m",
        ingredients: [
          { qty: 1.5, unit: "cups", name: "all-purpose flour" },
          { qty: 1, unit: "tsp", name: "baking soda" },
          { qty: 0.5, unit: "tsp", name: "salt" },
          { qty: 3, unit: "", name: "ripe bananas", mod: "mashed" },
          { qty: 0.5, unit: "cup", name: "butter", mod: "melted" },
          { qty: 0.75, unit: "cup", name: "sugar" },
          { qty: 1, unit: "", name: "egg", mod: "beaten" }
        ],
        steps: [
          "Preheat oven to 350°F (175°C).",
          "Combine dry ingredients.",
          "Mix wet ingredients; fold into dry.",
          "Bake 55–60 minutes."
        ],
        notes: ""
      };
    };

    // 1. Create recipe
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        user_id: user.id,
        title: 'Example Banana Bread'
      })
      .select()
      .single();

    if (recipeError) {
      console.error('Recipe creation error:', recipeError);
      throw recipeError;
    }

    console.log('Created recipe:', recipe.id);

    // 2. Create OCR job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        recipe_id: recipe.id,
        type: 'ocr',
        status: 'processing'
      })
      .select()
      .single();

    if (jobError) {
      console.error('Job creation error:', jobError);
      throw jobError;
    }

    // 3. Extract text (mock OCR)
    const ocrText = await extractTextFromFile(fileUrl);

    // 4. Save OCR version
    const { error: ocrVersionError } = await supabase
      .from('recipe_versions')
      .insert({
        recipe_id: recipe.id,
        kind: 'ocr',
        payload: { raw_text: ocrText }
      });

    if (ocrVersionError) {
      console.error('OCR version error:', ocrVersionError);
      throw ocrVersionError;
    }

    // 5. Parse recipe
    const parsedRecipe = parseRecipeFromOcr(ocrText);

    // 6. Save parsed version
    const { error: parsedVersionError } = await supabase
      .from('recipe_versions')
      .insert({
        recipe_id: recipe.id,
        kind: 'parsed',
        payload: parsedRecipe
      });

    if (parsedVersionError) {
      console.error('Parsed version error:', parsedVersionError);
      throw parsedVersionError;
    }

    // 7. Save ingredients
    const ingredientsToInsert = parsedRecipe.ingredients.map((ing: any) => ({
      recipe_id: recipe.id,
      name: ing.name,
      qty: ing.qty,
      unit: ing.unit,
      mod: ing.mod
    }));

    const { error: ingredientsError } = await supabase
      .from('ingredients')
      .insert(ingredientsToInsert);

    if (ingredientsError) {
      console.error('Ingredients error:', ingredientsError);
      throw ingredientsError;
    }

    // 8. Update job status
    await supabase
      .from('jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', job.id);

    console.log('Recipe processing complete');

    return new Response(
      JSON.stringify({ recipeId: recipe.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
