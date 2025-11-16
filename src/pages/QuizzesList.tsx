import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";

const QuizzesList = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select(`
          *,
          categories(name),
          subcategories(name)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <p className="text-center">Loading quizzes...</p>
        ) : quizzes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No quizzes available yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz) => (
              <Card key={quiz.id} className="border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    {quiz.categories && (
                      <Badge variant="secondary">{quiz.categories.name}</Badge>
                    )}
                    {quiz.is_premium && (
                      <Badge className="bg-accent text-accent-foreground">Premium</Badge>
                    )}
                  </div>
                  <CardTitle>{quiz.title}</CardTitle>
                  {quiz.description && (
                    <CardDescription>{quiz.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        {quiz.num_questions} questions
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {quiz.time_limit} min
                      </span>
                    </div>
                    <Button className="w-full" onClick={() => navigate(`/quiz/${quiz.id}`)}>
                      Start Quiz
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizzesList;
