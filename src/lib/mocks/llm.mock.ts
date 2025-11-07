import { RecipeJson, Substitution } from "../types";

export function parseRecipeFromOcr(text: string): RecipeJson {
  // Very simple parser tailored to the mock blob above. Good enough for demo.
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
}

// Minimal Canadian brand catalog for demo
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
  breadcrumbs: { 
    brand: "Kinnikinnick", 
    product: "GF Panko-Style", 
    url: "https://www.kinnikinnick.com/" 
  }
};

export function convertToGF(recipe: RecipeJson): { converted: RecipeJson; subs: Substitution[] } {
  const subs: Substitution[] = [];
  const converted = structuredClone(recipe);
  
  converted.ingredients = recipe.ingredients.map((ing) => {
    const n = ing.name.toLowerCase();
    
    if (n.includes("all-purpose flour") || n.includes("wheat flour") || n.includes("flour")) {
      subs.push({
        ingredientName: ing.name,
        suggested_product: CA_BRANDS.flour.product,
        brand: CA_BRANDS.flour.brand,
        product_url: CA_BRANDS.flour.url,
        rationale: "1:1 GF flour maintains texture without changing ratios."
      });
      return { ...ing, name: "gluten-free 1:1 baking flour" };
    }
    
    if (n.includes("soy sauce")) {
      subs.push({
        ingredientName: ing.name,
        suggested_product: CA_BRANDS.soy_sauce.product,
        brand: CA_BRANDS.soy_sauce.brand,
        product_url: CA_BRANDS.soy_sauce.url,
        rationale: "Tamari is gluten-free and keeps the same flavour profile."
      });
      return { ...ing, name: "gluten-free tamari" };
    }
    
    if (n.includes("spaghetti") || n.includes("pasta")) {
      subs.push({
        ingredientName: ing.name,
        suggested_product: CA_BRANDS.pasta_spaghetti.product,
        brand: CA_BRANDS.pasta_spaghetti.brand,
        product_url: CA_BRANDS.pasta_spaghetti.url,
        rationale: "Catelli GF pasta has excellent texture and cooks similarly to regular pasta."
      });
      return { ...ing, name: "gluten-free spaghetti" };
    }
    
    return ing;
  });
  
  return { converted, subs };
}
