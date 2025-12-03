import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { toast } from "sonner";

interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_image_url: string | null;
  order_num: number;
  explanation: string | null;
  section_number: number | null;
  section_name: string | null;
  options: Array<{
    id: string;
    option_label: string;
    option_text: string;
    option_image_url: string | null;
  }>;
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  num_questions: number;
  time_limit: number;
  categories: { name: string } | null;
  subcategories: { name: string } | null;
}

const Quiz = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (quizId) {
      initializeQuiz();
    }
  }, [quizId]);

  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const initializeQuiz = async () => {
    try {
      // Fetch quiz details
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select(`
          *,
          categories(name),
          subcategories(name)
        `)
        .eq("id", quizId)
        .eq("is_active", true)
        .single();

      if (quizError) throw quizError;
      if (!quizData) {
        toast.error("Quiz not found");
        navigate("/quizzes");
        return;
      }

      // Check if login is required (for both requires_login and premium quizzes)
      if (quizData.requires_login || quizData.is_premium) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error(quizData.is_premium 
            ? "Please login and purchase this premium quiz to continue" 
            : "Please login to take this quiz");
          navigate(`/auth?redirect=/quiz/${quizId}`);
          return;
        }
        
        // For premium quizzes, check if user has purchased (TODO: implement payment check)
        if (quizData.is_premium) {
          // For now, show message that premium quizzes require payment
          toast.error("This is a premium quiz. Payment feature coming soon!");
          navigate("/quizzes");
          return;
        }
      }

      setQuiz(quizData);
      setTimeRemaining(quizData.time_limit * 60);

      // Fetch questions using the secure RPC function
      const { data: questionsData, error: questionsError } = await supabase
        .rpc("get_quiz_questions_safe", { p_quiz_id: quizId });

      if (questionsError) throw questionsError;
      setQuestions((questionsData || []) as QuizQuestion[]);

      // Create quiz attempt
      const { data: user } = await supabase.auth.getUser();
      const { data: attempt, error: attemptError } = await supabase
        .from("quiz_attempts")
        .insert({
          quiz_id: quizId,
          user_id: user.user?.id || null,
          total_questions: questionsData?.length || 0,
        })
        .select()
        .single();

      if (attemptError) throw attemptError;
      setAttemptId(attempt.id);
    } catch (error: any) {
      toast.error(error.message);
      navigate("/quizzes");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, optionLabel: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionLabel,
    }));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      if (!attemptId) throw new Error("No attempt ID");

      // Get user info for email
      const { data: { user } } = await supabase.auth.getUser();
      
      // Submit all answers and calculate score
      let correctCount = 0;
      const questionResults: Array<{
        questionText: string;
        selectedOption: string;
        correctOption: string;
        isCorrect: boolean;
      }> = [];

      // Get correct answers for each question
      const { data: questionsWithAnswers } = await supabase
        .from("questions")
        .select("id, correct_option")
        .in("id", questions.map(q => q.id));

      const correctAnswersMap = new Map(
        questionsWithAnswers?.map(q => [q.id, q.correct_option]) || []
      );

      const responses = questions.map((q) => {
        const selectedAnswer = answers[q.id] || "";
        const correctAnswer = correctAnswersMap.get(q.id) || "";
        const isCorrect = selectedAnswer === correctAnswer;
        
        if (isCorrect) correctCount++;

        const selectedOption = q.options.find(opt => opt.option_label === selectedAnswer);
        const correctOption = q.options.find(opt => opt.option_label === correctAnswer);

        questionResults.push({
          questionText: q.question_text,
          selectedOption: selectedOption?.option_text || selectedAnswer,
          correctOption: correctOption?.option_text || correctAnswer,
          isCorrect,
        });

        return {
          attempt_id: attemptId,
          question_id: q.id,
          selected_option: selectedAnswer,
          is_correct: isCorrect,
        };
      });

      const { error: responsesError } = await supabase
        .from("question_responses")
        .insert(responses);

      if (responsesError) throw responsesError;

      // Mark attempt as completed
      const endTime = new Date();
      const { error: updateError } = await supabase
        .from("quiz_attempts")
        .update({
          is_completed: true,
          end_time: endTime.toISOString(),
          score: correctCount,
        })
        .eq("id", attemptId);

      if (updateError) throw updateError;

      // Send email with results if user is logged in
      if (user?.email) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();

          const startTime = new Date();
          const timeTakenMs = endTime.getTime() - startTime.getTime();
          const minutes = Math.floor(timeTakenMs / 60000);
          const seconds = Math.floor((timeTakenMs % 60000) / 1000);

          await supabase.functions.invoke("send-quiz-results", {
            body: {
              email: user.email,
              userName: profile?.full_name || "User",
              quizTitle: quiz?.title || "Quiz",
              score: correctCount,
              totalQuestions: questions.length,
              percentage: (correctCount / questions.length) * 100,
              timeTaken: `${minutes}m ${seconds}s`,
              results: questionResults,
            },
          });
        } catch (emailError) {
          console.error("Error sending email:", emailError);
        }
      }

      toast.success("Quiz submitted successfully!");
      navigate(`/quiz/${quizId}/results/${attemptId}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <p className="text-lg">Loading quiz...</p>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <div className="text-4xl">📝</div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Quiz Not Ready</h3>
              <p className="text-muted-foreground">
                {!quiz ? "Quiz not found" : "This quiz has no questions yet. Please contact the administrator to add questions."}
              </p>
            </div>
            <Button onClick={() => navigate("/quizzes")}>
              Back to Quizzes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  // Group questions by section
  const questionsBySections = questions.reduce((acc, q, idx) => {
    const sectionNum = q.section_number || 1;
    if (!acc[sectionNum]) {
      acc[sectionNum] = {
        name: q.section_name || `Section ${sectionNum}`,
        questions: []
      };
    }
    acc[sectionNum].questions.push({ ...q, index: idx });
    return acc;
  }, {} as Record<number, { name: string; questions: Array<QuizQuestion & { index: number }> }>);

  const sections = Object.entries(questionsBySections)
    .sort(([a], [b]) => Number(a) - Number(b));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">{quiz.title}</h1>
              {quiz.categories && (
                <Badge variant="secondary" className="mt-1">
                  {quiz.categories.name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                <span className={`font-mono font-semibold ${timeRemaining < 60 ? "text-destructive" : ""}`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
              <Badge variant="outline">
                {answeredCount}/{questions.length} Answered
              </Badge>
            </div>
          </div>
          <Progress value={progress} className="mt-3 h-2" />
          
          {/* Question Navigator */}
          <div className="mt-4 space-y-3">
            {sections.map(([sectionNum, section]) => (
              <div key={sectionNum} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{section.name}</p>
                <div className="flex flex-wrap gap-2">
                  {section.questions.map((q) => (
                    <Button
                      key={q.id}
                      variant={currentQuestionIndex === q.index ? "default" : answers[q.id] ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setCurrentQuestionIndex(q.index)}
                      className="w-10 h-10 p-0"
                    >
                      {q.index + 1}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Question */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <Badge>Question {currentQuestionIndex + 1}</Badge>
              {answers[currentQuestion.id] && (
                <Badge variant="secondary">
                  <Flag className="w-3 h-3 mr-1" />
                  Answered
                </Badge>
              )}
            </div>
            <CardTitle className="text-xl">
              {currentQuestion.question_text}
            </CardTitle>
            {currentQuestion.question_image_url && (
              <img
                src={currentQuestion.question_image_url}
                alt="Question"
                className="mt-4 rounded-lg max-h-64 object-contain"
              />
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={answers[currentQuestion.id] || ""}
              onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
            >
              {currentQuestion.options.map((option) => (
                <div
                  key={option.id}
                  className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => handleAnswerChange(currentQuestion.id, option.option_label)}
                >
                  <RadioGroupItem value={option.option_label} id={option.id} />
                  <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                    <span className="font-semibold">{option.option_label}.</span> {option.option_text}
                    {option.option_image_url && (
                      <img
                        src={option.option_image_url}
                        alt={`Option ${option.option_label}`}
                        className="mt-2 rounded max-h-32 object-contain"
                      />
                    )}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              {currentQuestionIndex === questions.length - 1 ? (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Quiz"}
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Quiz;
