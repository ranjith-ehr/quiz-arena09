import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { BarChart3, Users, TrendingUp, Clock } from "lucide-react";

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

const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AttemptStats>({
    total_attempts: 0,
    completed_attempts: 0,
    average_score: 0,
    average_time: 0,
  });
  const [topQuizzes, setTopQuizzes] = useState<QuizStats[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      // Get overall stats
      const { data: attempts, error: attemptsError } = await supabase
        .from("quiz_attempts")
        .select("*");

      if (attemptsError) throw attemptsError;

      const completed = attempts?.filter((a) => a.is_completed) || [];
      const totalScore = completed.reduce((sum, a) => sum + (a.score || 0), 0);
      const totalTime = completed.reduce((sum, a) => {
        if (a.end_time && a.start_time) {
          const duration = new Date(a.end_time).getTime() - new Date(a.start_time).getTime();
          return sum + duration / 60000; // Convert to minutes
        }
        return sum;
      }, 0);

      setStats({
        total_attempts: attempts?.length || 0,
        completed_attempts: completed.length,
        average_score: completed.length > 0 ? Math.round(totalScore / completed.length) : 0,
        average_time: completed.length > 0 ? Math.round(totalTime / completed.length) : 0,
      });

      // Get top quizzes by attempt count
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

      // Sort by attempt count
      quizStats.sort((a, b) => b.attempt_count - a.attempt_count);
      setTopQuizzes(quizStats.slice(0, 5));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading analytics...</div>;
  }

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
          <CardDescription>Most popular quizzes on your platform</CardDescription>
        </CardHeader>
        <CardContent>
          {topQuizzes.length > 0 ? (
            <div className="space-y-4">
              {topQuizzes.map((quiz, index) => (
                <div
                  key={quiz.quiz_id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
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

export default AnalyticsDashboard;
