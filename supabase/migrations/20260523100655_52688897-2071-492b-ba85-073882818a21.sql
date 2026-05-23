
-- 1) Profiles: remove public read, allow only owner to read
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2) Quiz attempts: tighten INSERT to validate quiz exists and user_id matches caller (or is null for anonymous)
DROP POLICY IF EXISTS "Everyone can create attempts" ON public.quiz_attempts;

CREATE POLICY "Users can create valid attempts"
ON public.quiz_attempts
FOR INSERT
TO public
WITH CHECK (
  EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_attempts.quiz_id AND q.is_active = true)
  AND (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL)
  )
);
