-- Create storage bucket for recipe card images
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-cards', 'recipe-cards', false);

-- RLS policies for recipe-cards bucket
CREATE POLICY "Users can upload their own recipe cards"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'recipe-cards' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own recipe cards"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'recipe-cards' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own recipe cards"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'recipe-cards' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);