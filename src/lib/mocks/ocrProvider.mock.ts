export async function extractTextFromFile(_fileUrl: string): Promise<string> {
  // Return a deterministic, OCR-like text blob.
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
}
