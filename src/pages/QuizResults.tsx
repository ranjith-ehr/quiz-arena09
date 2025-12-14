import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, ArrowLeft, RotateCcw, Trophy } from "lucide-react";
import { toast } from "sonner";

interface QuizAttempt {
  id: string;
  quiz_id: string;
  score: number | null;
  total_questions: number;
  start_time: string;
  end_time: string | null;
  quizzes: {
    title: string;
    categories: { name: string } | null;
  };
}

interface QuestionResult {
  question_id: string;
  question_text: string;
  question_image_url: string | null;
  selected_option: string;
  correct_option: string;
  is_correct: boolean;
  explanation: string | null;
  options: Array<{
    id: string;
    option_label: string;
    option_text: string;
    option_image_url: string | null;
  }>;
}

const QuizResults = () => {
  const { quizId, attemptId } = useParams<{ quizId: string; attemptId: string }>();
  const navigate = useNavigate();
  
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (quizId && attemptId) {
      loadResults();
    }
  }, [quizId, attemptId]);

  const loadResults = async () => {
    try {
      // Fetch attempt details
      const { data: attemptData, error: attemptError } = await supabase
        .from("quiz_attempts")
        .select(`
          *,
          quizzes(
            title,
            categories(name)
          )
        `)
        .eq("id", attemptId)
        .single();

      if (attemptError) throw attemptError;
      
      // Fetch responses with questions
      const { data: responsesData, error: responsesError } = await supabase
        .from("question_responses")
        .select(`
          *,
          questions(
            id,
            question_text,
            question_image_url,
            correct_option,
            explanation,
            order_num
          )
        `)
        .eq("attempt_id", attemptId)
        .order("questions(order_num)");

      if (responsesError) throw responsesError;

      // Filter out responses where the question no longer exists
      const validResponses = responsesData?.filter((r: any) => r.questions !== null) || [];

      // Fetch options for each question
      const questionIds = validResponses.map((r: any) => r.questions.id);
      
      let optionsData: any[] = [];
      if (questionIds.length > 0) {
        const { data, error: optionsError } = await supabase
          .from("question_options")
          .select("*")
          .in("question_id", questionIds);

        if (optionsError) throw optionsError;
        optionsData = data || [];
      }

      // Calculate score
      const correctCount = validResponses.filter((r: any) => 
        r.selected_option === r.questions.correct_option
      ).length;

      // Update attempt with score if not already set
      if (attemptData.score === null) {
        await supabase
          .from("quiz_attempts")
          .update({ score: correctCount })
          .eq("id", attemptId);
        
        attemptData.score = correctCount;
      }

      setAttempt(attemptData);

      // Build results with options
      const resultsWithOptions = validResponses.map((response: any) => {
        const question = response.questions;
        const questionOptions = optionsData.filter(
          (opt: any) => opt.question_id === question.id
        ).sort((a: any, b: any) => a.option_label.localeCompare(b.option_label));

        return {
          question_id: question.id,
          question_text: question.question_text,
          question_image_url: question.question_image_url,
          selected_option: response.selected_option,
          correct_option: question.correct_option,
          is_correct: response.selected_option === question.correct_option,
          explanation: question.explanation,
          options: questionOptions,
        };
      });

      setResults(resultsWithOptions);
    } catch (error: any) {
      toast.error(error.message);
      navigate("/quizzes");
    } finally {
      setLoading(false);
    }
  };

  const getScorePercentage = () => {
    if (!attempt || !attempt.total_questions) return 0;
    return Math.round(((attempt.score || 0) / attempt.total_questions) * 100);
  };

  const getScoreColor = () => {
    const percentage = getScorePercentage();
    if (percentage >= 80) return "text-success-foreground";
    if (percentage >= 60) return "text-warning-foreground";
    return "text-destructive";
  };

  const getScoreMessage = () => {
    const percentage = getScorePercentage();
    if (percentage >= 90) return "Outstanding! 🎉";
    if (percentage >= 80) return "Excellent work! 👏";
    if (percentage >= 70) return "Good job! 👍";
    if (percentage >= 60) return "Not bad! 💪";
    return "Keep practicing! 📚";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <p className="text-lg">Loading results...</p>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Results not found</p>
            <Button className="mt-4" onClick={() => navigate("/quizzes")}>
              Back to Quizzes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/quizzes")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Quizzes
          </Button>
          <h1 className="text-xl font-bold">Quiz Results</h1>
          <div className="w-32"></div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Score Card */}
        <Card className="mb-8 border-primary/20">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Trophy className="w-12 h-12 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl mb-2">{attempt.quizzes.title}</CardTitle>
            {attempt.quizzes.categories && (
              <Badge variant="secondary">{attempt.quizzes.categories.name}</Badge>
            )}
          </CardHeader>
          <CardContent className="text-center">
            <div className="mb-6">
              <div className={`text-5xl font-bold mb-2 ${getScoreColor()}`}>
                {getScorePercentage()}%
              </div>
              <p className="text-xl font-semibold text-muted-foreground mb-1">
                {getScoreMessage()}
              </p>
              <p className="text-muted-foreground">
                {attempt.score} out of {attempt.total_questions} correct
              </p>
            </div>
            
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate(`/quiz/${quizId}`)} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Retake Quiz
              </Button>
              <Button variant="outline" onClick={() => navigate("/quizzes")}>
                Browse More Quizzes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Question Review */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Question Review</h2>
          
          {results.map((result, index) => (
            <Card key={result.question_id} className={result.is_correct ? "border-success/30" : "border-destructive/30"}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Question {index + 1}</Badge>
                      {result.is_correct ? (
                        <Badge className="bg-success text-success-foreground">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Correct
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="w-3 h-3 mr-1" />
                          Incorrect
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{result.question_text}</CardTitle>
                    {result.question_image_url && (
                      <img
                        src={result.question_image_url}
                        alt="Question"
                        className="mt-3 rounded-lg max-h-48 object-contain"
                      />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Answer Summary */}
                <div className="flex flex-wrap gap-4 text-sm p-3 bg-muted/30 rounded-lg">
                  <div>
                    <span className="text-muted-foreground">Your answer: </span>
                    <span className={`font-semibold ${result.is_correct ? "text-success-foreground" : "text-destructive"}`}>
                      {result.selected_option}. {result.options.find(o => o.option_label === result.selected_option)?.option_text || "Not answered"}
                    </span>
                  </div>
                  {!result.is_correct && (
                    <div>
                      <span className="text-muted-foreground">Correct answer: </span>
                      <span className="font-semibold text-success-foreground">
                        {result.correct_option}. {result.options.find(o => o.option_label === result.correct_option)?.option_text}
                      </span>
                    </div>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-2">
                  {result.options.map((option) => {
                    const isCorrect = option.option_label === result.correct_option;
                    const isSelected = option.option_label === result.selected_option;
                    
                    let bgColor = "";
                    if (isCorrect) bgColor = "bg-success/10 border-success";
                    else if (isSelected && !isCorrect) bgColor = "bg-destructive/10 border-destructive";
                    
                    return (
                      <div
                        key={option.id}
                        className={`p-4 rounded-lg border-2 ${bgColor}`}
                      >
                        <div className="flex items-start gap-2">
                          {isCorrect && <CheckCircle2 className="w-5 h-5 text-success-foreground mt-0.5 flex-shrink-0" />}
                          {isSelected && !isCorrect && <XCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />}
                          <div className="flex-1">
                            <span className="font-semibold">{option.option_label}.</span> {option.option_text}
                            {option.option_image_url && (
                              <img
                                src={option.option_image_url}
                                alt={`Option ${option.option_label}`}
                                className="mt-2 rounded max-h-32 object-contain"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {result.explanation && (
                  <>
                    <Separator />
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm font-semibold mb-1">Explanation:</p>
                      <p className="text-sm text-muted-foreground">{result.explanation}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Actions */}
        <Card className="mt-8">
          <CardContent className="py-6 flex gap-3 justify-center">
            <Button onClick={() => navigate(`/quiz/${quizId}`)} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Retake Quiz
            </Button>
            <Button variant="outline" onClick={() => navigate("/quizzes")}>
              Browse More Quizzes
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QuizResults;
