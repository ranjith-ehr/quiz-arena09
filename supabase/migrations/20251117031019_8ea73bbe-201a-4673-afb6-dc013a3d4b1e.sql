-- Add section support to questions table
ALTER TABLE questions 
ADD COLUMN section_number integer DEFAULT 1,
ADD COLUMN section_name text;

-- Add constraint for max 4 sections
ALTER TABLE questions 
ADD CONSTRAINT check_max_sections CHECK (section_number BETWEEN 1 AND 4);

-- Add constraint for max 25 questions per section per quiz
CREATE OR REPLACE FUNCTION check_questions_per_section()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_questions_per_section
BEFORE INSERT OR UPDATE ON questions
FOR EACH ROW
EXECUTE FUNCTION check_questions_per_section();