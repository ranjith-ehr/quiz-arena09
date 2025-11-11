-- Create RPC function to fetch quiz questions WITHOUT correct answers
-- This protects quiz integrity by hiding answers until after completion
CREATE OR REPLACE FUNCTION public.get_quiz_questions_safe(p_quiz_id uuid)
RETURNS TABLE (
  id uuid,
  quiz_id uuid,
  question_text text,
  question_image_url text,
  order_num integer,
  explanation text,
  options jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    q.id,
    q.quiz_id,
    q.question_text,
    q.question_image_url,
    q.order_num,
    q.explanation,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', qo.id,
          'option_label', qo.option_label,
          'option_text', qo.option_text,
          'option_image_url', qo.option_image_url
        )
        ORDER BY qo.option_label
      )
      FROM question_options qo
      WHERE qo.question_id = q.id
    ) as options
  FROM questions q
  WHERE q.quiz_id = p_quiz_id
  ORDER BY q.order_num;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_quiz_questions_safe(uuid) TO authenticated, anon;