import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, Target, TrendingUp, Clock, Award, 
  CheckCircle2, XCircle, Loader2, Calendar
} from "lucide-react";
import { toast } from "sonner";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format } from "date-fns";

interface AttemptData {
  id: string;
  quiz_id: string;
  score: number;
  is_completed: boolean;
  created_at: string;
  end_time: string | null;
  quizzes: {
    title: string;
    categories: { name: string };
  } | null;
}

interface Stats {
  totalAttempts: number;
  completedQuizzes: number;
  averageScore: number;
  totalTimeSpent: number;
  bestScore: number;
  badges: string[];
}

const UserDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptData[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalAttempts: 0,
    completedQuizzes: 0,
    averageScore: 0,
    totalTimeSpent: 0,
    bestScore: 0,
    badges: [],
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth?redirect=/dashboard");
        return;
      }
      await loadDashboardData(session.user.id);
    } catch (error) {
      console.error("Error:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async (userId: string) => {
    try {
      const { data: attemptsData, error } = await supabase
        .from("quiz_attempts")
        .select(`
          *,
          quizzes(
            title,
            categories(name)
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setAttempts(attemptsData || []);
      calculateStats(attemptsData || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const calculateStats = (attemptsData: AttemptData[]) => {
    const completed = attemptsData.filter((a) => a.is_completed);
    const totalScore = completed.reduce((sum, a) => sum + (a.score || 0), 0);
    const avgScore = completed.length > 0 ? Math.round(totalScore / completed.length) : 0;
    const bestScore = completed.length > 0 ? Math.max(...completed.map(a => a.score || 0)) : 0;

    const totalTime = completed.reduce((sum, a) => {
      if (a.end_time && a.created_at) {
        const duration = new Date(a.end_time).getTime() - new Date(a.created_at).getTime();
        return sum + duration / 60000;
      }
      return sum;
    }, 0);

    const badges = [];
    if (completed.length >= 1) badges.push("First Quiz");
    if (completed.length >= 10) badges.push("Quiz Master");
    if (bestScore === 100) badges.push("Perfect Score");
    if (avgScore >= 80) badges.push("High Achiever");

    setStats({
      totalAttempts: attemptsData.length,
      completedQuizzes: completed.length,
      averageScore: avgScore,
      totalTimeSpent: Math.round(totalTime),
      bestScore,
      badges,
    });
  };

  const getScoreChartData = () => {
    return attempts
      .filter(a => a.is_completed)
      .slice(0, 10)
      .reverse()
      .map((a, index) => ({
        name: `Quiz ${index + 1}`,
        score: a.score || 0,
      }));
  };

  const getCategoryData = () => {
    const categoryMap = new Map<string, number>();
    attempts.forEach(a => {
      const category = a.quizzes?.categories?.name || "Other";
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  };

  const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--success))"];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Your Dashboard</h1>
          <p className="text-muted-foreground">Track your progress and achievements</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
              <Target className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.totalAttempts}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.completedQuizzes} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <TrendingUp className="w-4 h-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-secondary">{stats.averageScore}%</div>
              <Progress value={stats.averageScore} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Best Score</CardTitle>
              <Trophy className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{stats.bestScore}%</div>
              <p className="text-xs text-muted-foreground mt-1">Personal best</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Time Spent</CardTitle>
              <Clock className="w-4 h-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{stats.totalTimeSpent}m</div>
              <p className="text-xs text-muted-foreground mt-1">Learning time</p>
            </CardContent>
          </Card>
        </div>

        {/* Badges */}
        {stats.badges.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Your Badges
              </CardTitle>
              <CardDescription>Achievements you've unlocked</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {stats.badges.map((badge) => (
                  <Badge key={badge} variant="secondary" className="px-4 py-2 text-sm">
                    🏆 {badge}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="charts" className="mb-8">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="charts">Performance Charts</TabsTrigger>
            <TabsTrigger value="history">Quiz History</TabsTrigger>
          </TabsList>

          <TabsContent value="charts" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Score Progress</CardTitle>
                  <CardDescription>Your recent quiz scores</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      score: {
                        label: "Score",
                        color: "hsl(var(--primary))",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getScoreChartData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quiz Categories</CardTitle>
                  <CardDescription>Distribution by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      value: {
                        label: "Attempts",
                        color: "hsl(var(--primary))",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getCategoryData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="hsl(var(--primary))"
                          dataKey="value"
                        >
                          {getCategoryData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>All Attempts</CardTitle>
                <CardDescription>Complete history of your quiz attempts</CardDescription>
              </CardHeader>
              <CardContent>
                {attempts.length > 0 ? (
                  <div className="space-y-4">
                    {attempts.map((attempt) => (
                      <div
                        key={attempt.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          {attempt.is_completed ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : (
                            <XCircle className="w-5 h-5 text-destructive" />
                          )}
                          <div>
                            <p className="font-medium">{attempt.quizzes?.title || "Deleted Quiz"}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(attempt.created_at), "MMM d, yyyy")}
                              {attempt.quizzes?.categories?.name && (
                                <Badge variant="outline" className="ml-2">
                                  {attempt.quizzes.categories.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {attempt.is_completed ? (
                            <>
                              <p className="text-2xl font-bold">{attempt.score}%</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/quiz/${attempt.quiz_id}/results/${attempt.id}`)}
                              >
                                View Results
                              </Button>
                            </>
                          ) : (
                            <Badge variant="secondary">In Progress</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No quiz attempts yet. Start taking quizzes to see your progress!</p>
                    <Button className="mt-4" onClick={() => navigate("/quizzes")}>
                      Browse Quizzes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default UserDashboard;
