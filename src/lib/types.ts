export type Ingredient = { 
  qty?: number; 
  unit?: string; 
  name: string; 
  mod?: string 
};

export type RecipeJson = {
  title: string;
  yield?: string;
  total_time?: string;
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
};

export type Substitution = {
  ingredientName: string;
  suggested_product: string;
  brand: string;
  product_url?: string;
  rationale: string;
};

export type RecipeVersion = {
  id: string;
  recipe_id: string;
  kind: 'ocr' | 'parsed' | 'gf_converted';
  payload: RecipeJson;
  created_at: string;
};

export type Recipe = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};
