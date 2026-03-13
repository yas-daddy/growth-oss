-- Add insights_prompt column to review_settings table
ALTER TABLE public.review_settings 
ADD COLUMN IF NOT EXISTS insights_prompt TEXT DEFAULT 'Analyze these customer reviews and provide brief insights.

Answer these two questions in 2 sentences maximum each:

1. **Did users have any specific issues or bugs?**
Look for technical problems, app crashes, features not working, or any bugs mentioned.

2. **What features were users asking for?**
Look for feature requests, missing functionality, or suggestions for improvement.

Be specific and cite examples from the reviews when possible. If there are no relevant complaints for a question, say "No specific issues mentioned."';