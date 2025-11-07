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

    const { recipeVersionId } = await req.json();

    console.log('Exporting PDF for version:', recipeVersionId);

    // Get the version
    const { data: version, error: versionError } = await supabase
      .from('recipe_versions')
      .select('*, recipes!inner(*)')
      .eq('id', recipeVersionId)
      .single();

    if (versionError || !version) {
      throw new Error('Version not found');
    }

    // Get substitutions
    const { data: subs } = await supabase
      .from('substitutions')
      .select('*')
      .eq('recipe_id', version.recipe_id);

    const recipe = version.payload as any;
    
    // Simple PDF generation (mock - in real app would use a PDF library)
    const pdfContent = {
      title: recipe.title,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      substitutions: subs || []
    };

    console.log('PDF export complete (mock)');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'PDF export complete (demo mode)',
        content: pdfContent
      }),
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
