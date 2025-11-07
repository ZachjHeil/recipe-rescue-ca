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

    const { recipeId } = await req.json();

    console.log('Converting recipe:', recipeId);

    // Canadian brand catalog
    const CA_BRANDS = {
      flour: { 
        brand: "PC", 
        product: "Gluten-Free 1:1 Baking Flour", 
        url: "https://www.presidentschoice.ca/" 
      },
      soy_sauce: { 
        brand: "San-J", 
        product: "Tamari Gluten Free", 
        url: "https://san-j.com/" 
      },
      pasta_spaghetti: { 
        brand: "Catelli", 
        product: "Gluten Free Spaghetti", 
        url: "https://www.catelli.ca/" 
      },
    };

    // Get the latest parsed version
    const { data: parsedVersion, error: versionError } = await supabase
      .from('recipe_versions')
      .select('*')
      .eq('recipe_id', recipeId)
      .eq('kind', 'parsed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (versionError || !parsedVersion) {
      throw new Error('No parsed version found');
    }

    const recipe = parsedVersion.payload as any;
    const substitutions: any[] = [];
    const convertedRecipe = JSON.parse(JSON.stringify(recipe));

    // Convert ingredients
    convertedRecipe.ingredients = recipe.ingredients.map((ing: any) => {
      const n = ing.name.toLowerCase();

      if (n.includes("all-purpose flour") || n.includes("wheat flour") || n.includes("flour")) {
        substitutions.push({
          recipe_id: recipeId,
          ingredient_name: ing.name,
          suggested_product: CA_BRANDS.flour.product,
          brand: CA_BRANDS.flour.brand,
          product_url: CA_BRANDS.flour.url,
          rationale: "1:1 GF flour maintains texture without changing ratios."
        });
        return { ...ing, name: "gluten-free 1:1 baking flour" };
      }

      if (n.includes("soy sauce")) {
        substitutions.push({
          recipe_id: recipeId,
          ingredient_name: ing.name,
          suggested_product: CA_BRANDS.soy_sauce.product,
          brand: CA_BRANDS.soy_sauce.brand,
          product_url: CA_BRANDS.soy_sauce.url,
          rationale: "Tamari is gluten-free and keeps the same flavour profile."
        });
        return { ...ing, name: "gluten-free tamari" };
      }

      if (n.includes("spaghetti") || n.includes("pasta")) {
        substitutions.push({
          recipe_id: recipeId,
          ingredient_name: ing.name,
          suggested_product: CA_BRANDS.pasta_spaghetti.product,
          brand: CA_BRANDS.pasta_spaghetti.brand,
          product_url: CA_BRANDS.pasta_spaghetti.url,
          rationale: "Catelli GF pasta has excellent texture and cooks similarly to regular pasta."
        });
        return { ...ing, name: "gluten-free spaghetti" };
      }

      return ing;
    });

    // Save GF version
    const { error: gfVersionError } = await supabase
      .from('recipe_versions')
      .insert({
        recipe_id: recipeId,
        kind: 'gf_converted',
        payload: convertedRecipe
      });

    if (gfVersionError) {
      console.error('GF version error:', gfVersionError);
      throw gfVersionError;
    }

    // Save substitutions
    if (substitutions.length > 0) {
      const { error: subsError } = await supabase
        .from('substitutions')
        .insert(substitutions);

      if (subsError) {
        console.error('Substitutions error:', subsError);
        throw subsError;
      }
    }

    console.log('Conversion complete, substitutions:', substitutions.length);

    return new Response(
      JSON.stringify({ success: true }),
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
