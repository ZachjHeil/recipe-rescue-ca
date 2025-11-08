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

    console.log('Processing upload for user:', user.id, 'File URL:', fileUrl);

    // Get signed URL for the uploaded image
    const filePath = fileUrl.split('/').pop();
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('recipe-cards')
      .createSignedUrl(`${user.id}/${filePath}`, 3600);

    if (signedUrlError) {
      console.error('Signed URL error:', signedUrlError);
      throw new Error('Failed to get signed URL');
    }

    console.log('Using Lovable AI to extract recipe from image');

    // Use Lovable AI with vision to extract recipe data
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract the recipe information from this recipe card image. Include title, yield, time, ingredients (with quantities, units, names, and modifiers), and step-by-step instructions.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: signedUrlData.signedUrl
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_recipe',
              description: 'Extract structured recipe data from the image',
              parameters: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  yield: { type: 'string' },
                  total_time: { type: 'string' },
                  ingredients: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        qty: { type: 'number' },
                        unit: { type: 'string' },
                        name: { type: 'string' },
                        mod: { type: 'string' }
                      },
                      required: ['name']
                    }
                  },
                  steps: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  notes: { type: 'string' }
                },
                required: ['title', 'ingredients', 'steps']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_recipe' } }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData));

    // Extract the recipe data from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const parsedRecipe = JSON.parse(toolCall.function.arguments);
    console.log('Parsed recipe:', parsedRecipe);

    const extractedOcrText = `${parsedRecipe.title}\n\nIngredients:\n${parsedRecipe.ingredients.map((i: any) => 
      `- ${i.qty || ''} ${i.unit || ''} ${i.name}${i.mod ? ` (${i.mod})` : ''}`
    ).join('\n')}\n\nSteps:\n${parsedRecipe.steps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`;

    // 1. Create recipe
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        user_id: user.id,
        title: parsedRecipe.title
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

    // 3. Save OCR version
    const { error: ocrVersionError } = await supabase
      .from('recipe_versions')
      .insert({
        recipe_id: recipe.id,
        kind: 'ocr',
        payload: { raw_text: extractedOcrText }
      });

    if (ocrVersionError) {
      console.error('OCR version error:', ocrVersionError);
      throw ocrVersionError;
    }

    // 4. Save parsed version
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

    // 5. Save ingredients
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

    // 6. Update job status
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
