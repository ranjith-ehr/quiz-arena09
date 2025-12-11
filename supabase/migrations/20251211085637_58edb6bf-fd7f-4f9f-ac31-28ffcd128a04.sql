-- Create a secure RPC function to calculate quiz score server-side
-- This prevents users from accessing correct answers directly

CREATE OR REPLACE FUNCTION public.calculate_quiz_score(
  p_attempt_id uuid,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- Get attempt info
  SELECT quiz_id, user_id INTO v_quiz_id, v_attempt_user_id
  FROM quiz_attempts
  WHERE id = p_attempt_id AND is_completed = false;
  
  IF v_quiz_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or already completed attempt';
  END IF;
  
  -- Get current user (may be null for anonymous)
  v_user_id := auth.uid();
  
  -- Verify the attempt belongs to this user (or is anonymous)
  IF v_attempt_user_id IS NOT NULL AND v_attempt_user_id != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized access to attempt';
  END IF;
  
  -- Process each question
  FOR v_question IN
    SELECT q.id, q.question_text, q.correct_option, q.explanation
    FROM questions q
    WHERE q.quiz_id = v_quiz_id
    ORDER BY q.order_num
  LOOP
    v_total_count := v_total_count + 1;
    v_selected_option := p_answers->>v_question.id::text;
    
    -- Check if answer is correct
    IF v_selected_option = v_question.correct_option THEN
      v_correct_count := v_correct_count + 1;
    END IF;
    
    -- Insert question response
    INSERT INTO question_responses (attempt_id, question_id, selected_option, is_correct)
    VALUES (
      p_attempt_id,
      v_question.id,
      COALESCE(v_selected_option, ''),
      v_selected_option = v_question.correct_option
    );
    
    -- Build results array (for email purposes - includes correct answers for post-submission)
    v_results := v_results || jsonb_build_object(
      'questionId', v_question.id,
      'questionText', v_question.question_text,
      'selectedOption', COALESCE(v_selected_option, ''),
      'correctOption', v_question.correct_option,
      'isCorrect', v_selected_option = v_question.correct_option,
      'explanation', v_question.explanation
    );
  END LOOP;
  
  -- Update the attempt as completed
  UPDATE quiz_attempts
  SET 
    is_completed = true,
    end_time = now(),
    score = v_correct_count
  WHERE id = p_attempt_id;
  
  -- Return the results
  RETURN jsonb_build_object(
    'score', v_correct_count,
    'totalQuestions', v_total_count,
    'percentage', CASE WHEN v_total_count > 0 THEN (v_correct_count::numeric / v_total_count::numeric) * 100 ELSE 0 END,
    'results', v_results
  );
END;
$$;

-- Drop the existing public SELECT policy on questions
DROP POLICY IF EXISTS "Everyone can view questions" ON public.questions;

-- Create a new policy that only allows admins to view questions directly
-- Users should use the get_quiz_questions_safe RPC which excludes correct_option
CREATE POLICY "Only admins can view questions directly"
ON public.questions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));