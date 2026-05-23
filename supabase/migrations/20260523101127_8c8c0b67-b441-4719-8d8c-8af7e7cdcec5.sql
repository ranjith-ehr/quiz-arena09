
-- Clean up anonymous attempts (and their responses)
DELETE FROM public.question_responses
WHERE attempt_id IN (SELECT id FROM public.quiz_attempts WHERE user_id IS NULL);

DELETE FROM public.quiz_attempts WHERE user_id IS NULL;

-- Make user_id required
ALTER TABLE public.quiz_attempts ALTER COLUMN user_id SET NOT NULL;

-- Replace permissive policies on quiz_attempts
DROP POLICY IF EXISTS "Users can view their own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can update their own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can create valid attempts" ON public.quiz_attempts;

CREATE POLICY "Users can view their own attempts"
ON public.quiz_attempts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own attempts"
ON public.quiz_attempts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own attempts"
ON public.quiz_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_attempts.quiz_id AND q.is_active = true)
);

-- Tighten responses visibility
DROP POLICY IF EXISTS "Users can view their own responses" ON public.question_responses;

CREATE POLICY "Users can view their own responses"
ON public.question_responses
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.quiz_attempts qa
  WHERE qa.id = question_responses.attempt_id
    AND qa.user_id = auth.uid()
));

-- Update score RPC to require auth
CREATE OR REPLACE FUNCTION public.calculate_quiz_score(p_attempt_id uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quiz_id uuid;
  v_user_id uuid;
  v_attempt_user_id uuid;
  v_question record;
  v_selected_option text;
  v_correct_count integer := 0;
  v_total_count integer := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT quiz_id, user_id INTO v_quiz_id, v_attempt_user_id
  FROM quiz_attempts
  WHERE id = p_attempt_id AND is_completed = false;

  IF v_quiz_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or already completed attempt';
  END IF;

  IF v_attempt_user_id != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized access to attempt';
  END IF;

  FOR v_question IN
    SELECT q.id, q.question_text, q.correct_option, q.explanation
    FROM questions q
    WHERE q.quiz_id = v_quiz_id
    ORDER BY q.order_num
  LOOP
    v_total_count := v_total_count + 1;
    v_selected_option := p_answers->>v_question.id::text;

    IF v_selected_option = v_question.correct_option THEN
      v_correct_count := v_correct_count + 1;
    END IF;

    INSERT INTO question_responses (attempt_id, question_id, selected_option, is_correct)
    VALUES (
      p_attempt_id,
      v_question.id,
      COALESCE(v_selected_option, ''),
      v_selected_option = v_question.correct_option
    );

    v_results := v_results || jsonb_build_object(
      'questionId', v_question.id,
      'questionText', v_question.question_text,
      'selectedOption', COALESCE(v_selected_option, ''),
      'correctOption', v_question.correct_option,
      'isCorrect', v_selected_option = v_question.correct_option,
      'explanation', v_question.explanation
    );
  END LOOP;

  UPDATE quiz_attempts
  SET is_completed = true, end_time = now(), score = v_correct_count
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'score', v_correct_count,
    'totalQuestions', v_total_count,
    'percentage', CASE WHEN v_total_count > 0 THEN (v_correct_count::numeric / v_total_count::numeric) * 100 ELSE 0 END,
    'results', v_results
  );
END;
$function$;
