-- Create recipes table
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recipe_versions table
CREATE TABLE public.recipe_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('ocr', 'parsed', 'gf_converted')),
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ingredients table
CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty NUMERIC,
  unit TEXT,
  mod TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create substitutions table
CREATE TABLE public.substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  suggested_product TEXT NOT NULL,
  brand TEXT NOT NULL,
  product_url TEXT,
  rationale TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create jobs table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ocr', 'parse', 'convert')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recipes
CREATE POLICY "Users can view their own recipes"
ON public.recipes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recipes"
ON public.recipes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes"
ON public.recipes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes"
ON public.recipes FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for recipe_versions
CREATE POLICY "Users can view versions of their recipes"
ON public.recipe_versions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.recipes 
  WHERE recipes.id = recipe_versions.recipe_id 
  AND recipes.user_id = auth.uid()
));

CREATE POLICY "Users can create versions for their recipes"
ON public.recipe_versions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.recipes 
  WHERE recipes.id = recipe_versions.recipe_id 
  AND recipes.user_id = auth.uid()
));

-- RLS Policies for ingredients
CREATE POLICY "Users can view ingredients of their recipes"
ON public.ingredients FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.recipes 
  WHERE recipes.id = ingredients.recipe_id 
  AND recipes.user_id = auth.uid()
));

CREATE POLICY "Users can create ingredients for their recipes"
ON public.ingredients FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.recipes 
  WHERE recipes.id = ingredients.recipe_id 
  AND recipes.user_id = auth.uid()
));

-- RLS Policies for substitutions
CREATE POLICY "Users can view substitutions of their recipes"
ON public.substitutions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.recipes 
  WHERE recipes.id = substitutions.recipe_id 
  AND recipes.user_id = auth.uid()
));

CREATE POLICY "Users can create substitutions for their recipes"
ON public.substitutions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.recipes 
  WHERE recipes.id = substitutions.recipe_id 
  AND recipes.user_id = auth.uid()
));

-- RLS Policies for jobs
CREATE POLICY "Users can view jobs for their recipes"
ON public.jobs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.recipes 
  WHERE recipes.id = jobs.recipe_id 
  AND recipes.user_id = auth.uid()
));

CREATE POLICY "Users can create jobs for their recipes"
ON public.jobs FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.recipes 
  WHERE recipes.id = jobs.recipe_id 
  AND recipes.user_id = auth.uid()
));

CREATE POLICY "Users can update jobs for their recipes"
ON public.jobs FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.recipes 
  WHERE recipes.id = jobs.recipe_id 
  AND recipes.user_id = auth.uid()
));

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for recipes updated_at
CREATE TRIGGER update_recipes_updated_at
BEFORE UPDATE ON public.recipes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();