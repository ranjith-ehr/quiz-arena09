-- Drop the trigger first
DROP TRIGGER IF EXISTS enforce_questions_per_section ON questions;

-- Drop the function
DROP FUNCTION IF EXISTS check_questions_per_section();

-- Recreate the function with proper search_path
CREATE OR REPLACE FUNCTION check_questions_per_section()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM questions
    WHERE quiz_id = NEW.quiz_id 
    AND section_number = NEW.section_number
  ) >= 25 THEN
    RAISE EXCEPTION 'Maximum 25 questions allowed per section';
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER enforce_questions_per_section
BEFORE INSERT OR UPDATE ON questions
FOR EACH ROW
EXECUTE FUNCTION check_questions_per_section();