import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BarChart3, Users, TrendingUp, Clock, ArrowLeft, Download, Filter } from "lucide-react";
import { format } from "date-fns";

interface AttemptStats {
  total_attempts: number;
  completed_attempts: number;
  average_score: number;
  average_time: number;
}

interface QuizStats {
  quiz_id: string;
  quiz_title: string;
  attempt_count: number;
  avg_score: number;
}

interface UserAttempt {
  id: string;
  user_id: string | null;
  score: number;
  is_completed: boolean;
  created_at: string;
  end_time: string | null;
  profiles?: {
    full_name: string;
    email: string;
  } | null;
}

interface QuestionResponse {
  id: string;
  question_id: string;
  selected_option: string;
  is_correct: boolean;
  questions: {
    question_text: string;
    correct_option: string;
    explanation: string | null;
    question_options: Array<{
      option_label: string;
      option_text: string;
    }>;
  };
}

const AdminAnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AttemptStats>({
    total_attempts: 0,
    completed_attempts: 0,
    average_score: 0,
    average_time: 0,
  });
  const [topQuizzes, setTopQuizzes] = useState<QuizStats[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<UserAttempt[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<string | null>(null);
  const [attemptDetails, setAttemptDetails] = useState<QuestionResponse[]>([]);
  
  // Filters
  const [filterUser, setFilterUser] = useState("");
  const [filterMinScore, setFilterMinScore] = useState("");
  const [filterMaxScore, setFilterMaxScore] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const { data: attempts, error: attemptsError } = await supabase
        .from("quiz_attempts")
        .select("*");

      if (attemptsError) throw attemptsError;

      const completed = attempts?.filter((a) => a.is_completed) || [];
      const totalScore = completed.reduce((sum, a) => sum + (a.score || 0), 0);
      const totalTime = completed.reduce((sum, a) => {
        if (a.end_time && a.start_time) {
          const duration = new Date(a.end_time).getTime() - new Date(a.start_time).getTime();
          return sum + duration / 60000;
        }
        return sum;
      }, 0);

      setStats({
        total_attempts: attempts?.length || 0,
        completed_attempts: completed.length,
        average_score: completed.length > 0 ? Math.round(totalScore / completed.length) : 0,
        average_time: completed.length > 0 ? Math.round(totalTime / completed.length) : 0,
      });

      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select(`
          id,
          title,
          quiz_attempts(id, score, is_completed)
        `);

      if (quizError) throw quizError;

      const quizStats: QuizStats[] = quizData?.map((quiz: any) => {
        const completedAttempts = quiz.quiz_attempts.filter((a: any) => a.is_completed);
        const avgScore = completedAttempts.length > 0
          ? Math.round(
              completedAttempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) /
                completedAttempts.length
            )
          : 0;

        return {
          quiz_id: quiz.id,
          quiz_title: quiz.title,
          attempt_count: quiz.quiz_attempts.length,
          avg_score: avgScore,
        };
      }) || [];

      quizStats.sort((a, b) => b.attempt_count - a.attempt_count);
      setTopQuizzes(quizStats.slice(0, 5));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadQuizAttempts = async (quizId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select(`
          *,
          profiles(full_name)
        `)
        .eq("quiz_id", quizId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get user emails separately
      const attemptsWithEmails = await Promise.all(
        (data || []).map(async (attempt) => {
          if (attempt.user_id) {
            const { data: userData } = await supabase.auth.admin.getUserById(attempt.user_id);
            return {
              ...attempt,
              profiles: attempt.profiles ? {
                ...attempt.profiles,
                email: userData?.user?.email || "N/A",
              } : {
                full_name: "N/A",
                email: userData?.user?.email || "N/A",
              },
            };
          }
          return { ...attempt, profiles: null };
        })
      );

      setQuizAttempts(attemptsWithEmails);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAttemptDetails = async (attemptId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("question_responses")
        .select(`
          *,
          questions(
            question_text,
            correct_option,
            explanation,
            question_options(option_label, option_text)
          )
        `)
        .eq("attempt_id", attemptId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setAttemptDetails(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuizClick = (quizId: string) => {
    setSelectedQuiz(quizId);
    setSelectedAttempt(null);
    setAttemptDetails([]);
    loadQuizAttempts(quizId);
  };

  const handleAttemptClick = (attemptId: string) => {
    setSelectedAttempt(attemptId);
    loadAttemptDetails(attemptId);
  };

  const handleBack = () => {
    if (selectedAttempt) {
      setSelectedAttempt(null);
      setAttemptDetails([]);
    } else if (selectedQuiz) {
      setSelectedQuiz(null);
      setQuizAttempts([]);
    }
  };

  const getFilteredAttempts = () => {
    return quizAttempts.filter(attempt => {
      const nameMatch = !filterUser || 
        (attempt.profiles?.full_name || "").toLowerCase().includes(filterUser.toLowerCase());
      
      const minScore = filterMinScore ? parseFloat(filterMinScore) : 0;
      const maxScore = filterMaxScore ? parseFloat(filterMaxScore) : 100;
      const scoreMatch = (!filterMinScore && !filterMaxScore) || 
        ((attempt.score || 0) >= minScore && (attempt.score || 0) <= maxScore);

      return nameMatch && scoreMatch;
    });
  };

  const exportToCSV = () => {
    const filtered = getFilteredAttempts();
    const csvContent = [
      ["User Name", "Email", "Score", "Status", "Date", "Time Taken"].join(","),
      ...filtered.map(attempt => [
        attempt.profiles?.full_name || "Anonymous",
        attempt.profiles?.email || "N/A",
        attempt.score || 0,
        attempt.is_completed ? "Completed" : "In Progress",
        format(new Date(attempt.created_at), "yyyy-MM-dd HH:mm"),
        attempt.end_time ? 
          `${Math.round((new Date(attempt.end_time).getTime() - new Date(attempt.created_at).getTime()) / 60000)}m` 
          : "N/A"
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quiz-attempts-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("CSV exported successfully!");
  };

  if (loading && !selectedQuiz) {
    return <div className="text-center py-8">Loading analytics...</div>;
  }

  // Show attempt detail view
  if (selectedAttempt && attemptDetails.length > 0) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Attempts
        </Button>
        
        <Card>
          <CardHeader>
            <CardTitle>Quiz Review</CardTitle>
            <CardDescription>Detailed question-by-question analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {attemptDetails.map((response, index) => (
              <div key={response.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-medium text-lg">
                    Question {index + 1}: {response.questions.question_text}
                  </h3>
                  {response.is_correct ? (
                    <span className="text-success font-medium">✓ Correct</span>
                  ) : (
                    <span className="text-destructive font-medium">✗ Incorrect</span>
                  )}
                </div>
                
                <div className="space-y-2">
                  {response.questions.question_options.map((option) => {
                    const isSelected = option.option_label === response.selected_option;
                    const isCorrect = option.option_label === response.questions.correct_option;
                    
                    return (
                      <div
                        key={option.option_label}
                        className={`p-3 rounded border ${
                          isCorrect
                            ? "bg-success/10 border-success"
                            : isSelected
                            ? "bg-destructive/10 border-destructive"
                            : "bg-muted"
                        }`}
                      >
                        <span className="font-medium">{option.option_label}.</span> {option.option_text}
                        {isSelected && !isCorrect && " (Your answer)"}
                        {isCorrect && " (Correct answer)"}
                      </div>
                    );
                  })}
                </div>
                
                {response.questions.explanation && (
                  <div className="mt-4 p-3 bg-accent/10 rounded">
                    <p className="text-sm">
                      <strong>Explanation:</strong> {response.questions.explanation}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show quiz attempts view
  if (selectedQuiz) {
    const filteredAttempts = getFilteredAttempts();
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Overview
          </Button>
          <Button onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export to CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>User Name</Label>
                <Input
                  placeholder="Search by name..."
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Score (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={filterMinScore}
                  onChange={(e) => setFilterMinScore(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Score (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="100"
                  value={filterMaxScore}
                  onChange={(e) => setFilterMaxScore(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quiz Attempts</CardTitle>
            <CardDescription>
              {filteredAttempts.length} of {quizAttempts.length} attempts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredAttempts.length > 0 ? (
              <div className="space-y-3">
                {filteredAttempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors cursor-pointer"
                    onClick={() => handleAttemptClick(attempt.id)}
                  >
                    <div>
                      <p className="font-medium">
                        {attempt.profiles?.full_name || "Anonymous User"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {attempt.profiles?.email || "No email"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(attempt.created_at), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                    <div className="text-right">
                      {attempt.is_completed ? (
                        <p className="text-2xl font-bold">{attempt.score}%</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">In Progress</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No attempts match the filters
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show main analytics view
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <p className="text-muted-foreground">Track quiz performance and user engagement</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
            <BarChart3 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats.total_attempts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.completed_attempts} completed
            </p>
          </CardContent>
        </Card>

        <Card className="border-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">
              {stats.total_attempts > 0
                ? Math.round((stats.completed_attempts / stats.total_attempts) * 100)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground mt-1">Quiz completion</p>
          </CardContent>
        </Card>

        <Card className="border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Users className="w-4 h-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{stats.average_score}%</div>
            <p className="text-xs text-muted-foreground mt-1">Across all quizzes</p>
          </CardContent>
        </Card>

        <Card className="border-success/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time</CardTitle>
            <Clock className="w-4 h-4 text-success-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success-foreground">
              {stats.average_time}m
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per quiz</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Quizzes by Attempts</CardTitle>
          <CardDescription>Click on a quiz to see detailed analytics</CardDescription>
        </CardHeader>
        <CardContent>
          {topQuizzes.length > 0 ? (
            <div className="space-y-4">
              {topQuizzes.map((quiz, index) => (
                <div
                  key={quiz.quiz_id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors cursor-pointer"
                  onClick={() => handleQuizClick(quiz.quiz_id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{quiz.quiz_title}</p>
                      <p className="text-sm text-muted-foreground">
                        {quiz.attempt_count} attempts
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{quiz.avg_score}%</p>
                    <p className="text-xs text-muted-foreground">Avg. Score</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No quiz attempts yet. Create some quizzes to see analytics!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalyticsDashboard;
